import { v4 as uuid } from "uuid";
import { CloudStorage, File } from '../cloud/google/storage';
import { filePath } from "../common/file_path";
import { Comment, CommentView } from "../model/comment";
import { Pagination, Document } from "../model/common";
import { CommentRepository } from "../repository/mongo/comment_repository";
import logger from "../util/logger";

const storageFolder = "comment"

export function newCommentService(repository: CommentRepository, storage: CloudStorage) {
    return new CommentService(repository, storage)
}

interface Service {
    getCommentSrv(commentUUID: string, userUUID: string, isRaw: boolean): Promise<CommentView>
    getCommentsPaginationSrv(commentUUID: string, filter: Pagination, userUUID: string): Promise<{ total: number, data: CommentView[] }>
    getCommentsSrv(key: { forumUUID?: string, commenterUUID?: string, likeUserUUID?: string }): Promise<Comment[]>
    upsertCommentSrv(userUUID: string, comment: Comment, files: File[], commentImageUUIDs?: string[]): Promise<{ commentUUID: string, documents: Document[] }>
    deleteCommentSrv(commentUUID: string): void
    deleteCommentsByForumUUIDSrv(forumUUID: string): void
    likeCommentSrv(commentUUID: string, userUUID: string, isLike: boolean): void
    pullLikeUserUUIDFromCommentSrv(userUUID: string): void
}

export class CommentService implements Service {
    constructor(private repository: CommentRepository, private storage: CloudStorage) {}

    private async deleteCommentImagesSrv(...documents: Document[]) {
        for (const document of documents) {
            try {
                await this.storage.deleteFile(document.url)
                logger.warn(`delete comment image from cloud storage with object: ${document.url}`)
            } catch (error) {
                logger.error(error)
            }
        }
    }

    private async assertAnonymousSrv(comment: CommentView, userUUID: string) {
        const injectAnonymous = async (comment: CommentView) => {
            if (comment.isAnonymous) {
                comment.commenterName = 'ผู้ใช้นิรนาม'
                if (comment.commenterUUID === userUUID) {
                    comment.commenterName += ' (คุณ)'
                } else {
                    comment.commenterUUID = "unknown"
                }
            }
            comment.commenterImageURL = await this.storage.signedURL(comment.isAnonymous ? filePath.anonymousAvatar : comment.commenterImageURL)
            // delete comment.isAnonymous
        }
        await injectAnonymous(comment)
        if (comment.replyComments) {
            for(const replyComment of comment.replyComments) {
                await injectAnonymous(replyComment)
            }
        }
    }

    async getCommentSrv(commentUUID: string, userUUID: string, isRaw: boolean = false) {
        logger.info(`Start service.comment.getCommentSrv, "input": ${JSON.stringify({commentUUID, userUUID})}`)

        const comment = await this.repository.getCommentRepo(commentUUID, userUUID)

        if (!isRaw) {
            if (comment?.commentImages) {
                for(let i=0; i<comment.commentImages.length; i++) {
                    comment.commentImages[i].url = this.storage.publicURL(comment.commentImages[i].url)
                }
                await this.assertAnonymousSrv(comment, userUUID)
            }
        }

        logger.info(`End service.comment.getCommentSrv, "output": ${JSON.stringify(comment)}`)
        return comment
    }

    async getCommentsPaginationSrv(commentUUID: string, filter: Pagination, userUUID: string) {
        logger.info(`Start service.comment.getCommentsPaginationSrv, "input": ${JSON.stringify({commentUUID, filter, userUUID})}`)

        const comments = await this.repository.getCommentsPaginationRepo(commentUUID, filter, userUUID)

        if(comments?.data) {
            for(let comment of comments.data) {
                if (comment.commentImages) {
                    for(let i=0; i<comment.commentImages.length; i++) {
                        comment.commentImages[i].url = this.storage.publicURL(comment.commentImages[i].url)
                    }
                }
                if (comment.replyComments) {
                    for (let replyComment of comment.replyComments) {
                        if (replyComment.commentImages) {
                            for(let i=0; i<replyComment.commentImages.length; i++) {
                                replyComment.commentImages[i].url = this.storage.publicURL(replyComment.commentImages[i].url)
                            }
                        }
                    }
                }
                await this.assertAnonymousSrv(comment, userUUID)
            }
        }

        logger.info(`End service.comment.getCommentsPaginationSrv, "output": {"total": ${comments?.total || 0}, "data.length": ${comments?.data?.length || 0}}`)
        return comments
    }

    async getCommentsSrv(key: { forumUUID?: string, commenterUUID?: string, likeUserUUID?: string }) {
        logger.info(`Start service.comment.getCommentsSrv, "input": ${JSON.stringify(key)}`)

        const comments = await this.repository.getCommentsRepo(key)

        logger.info(`End service.comment.getCommentsSrv, "output": ${JSON.stringify(comments)}`)
        return comments
    }

    async upsertCommentSrv(userUUID: string, comment: Comment, files: File[], commentImageUUIDs?: string[]) {
        logger.info(`Start service.comment.upsertCommentSrv, "input": ${JSON.stringify({userUUID, comment, commentImageUUIDs, totalFile: files?.length || 0})}`)

        const uploadCommentImage = async (comment: Comment, images?: Document[]): Promise<Document[]> => {
            if (files) {
                comment.commentImages = images ? [...images] : []
                if (commentImageUUIDs) {
                    comment.commentImages = comment.commentImages.filter(doc => !commentImageUUIDs.includes(doc.uuid))
                }
                const newDocuments: Document[] = []
                for (const file of files) {
                    const { fileUUID, fileName } = await this.storage.uploadFile(file, `${storageFolder}/${comment.forumUUID}/${comment.commentUUID}`)
                    await this.storage.setPublic(fileName)
                    const document = {
                        uuid: fileUUID,
                        url: fileName,
                    }
                    newDocuments.push({...document})
                    comment.commentImages.push({...document})
                }
                for (const newDocument of newDocuments) {
                    newDocument.url = await this.storage.signedURL(newDocument.url)
                }
                return newDocuments
            }
            return []
        }

        let newDocuments: Document[] = []
        if (comment.commentUUID) {
            const commentReq = await this.repository.getCommentRepo(comment.commentUUID, userUUID)
            if (!commentReq || !commentReq.commentUUID) {
                throw Error('commentUUID is not found')
            }

            if (commentReq.commenterUUID !== userUUID) {
                throw Error('unable to update comment: permission is denied')
            }

            if (commentImageUUIDs && commentReq.commentImages) {
                const commentImageReq = commentReq.commentImages.filter(doc => commentImageUUIDs.includes(doc.uuid))
                if (commentImageReq) {
                    await this.deleteCommentImagesSrv(...commentImageReq)
                }
            }
            newDocuments = await uploadCommentImage(comment, commentReq?.commentImages)
            await this.repository.updateCommentRepo(comment)

        } else {
            comment.commentUUID = uuid()
            newDocuments = await uploadCommentImage(comment)
            await this.repository.createCommentRepo(comment)
        }

        const res = { commentUUID: comment.commentUUID, documents: newDocuments }
        logger.info(`End service.comment.upsertCommentSrv, "output": ${JSON.stringify(res)}`)
        return res
    }

    async deleteCommentSrv(commentUUID: string) {
        logger.info(`Start service.comment.deleteCommentSrv, "input": ${JSON.stringify({commentUUID})}`)

        const comments = await this.repository.getCommentAndReplyRepo(commentUUID)
        if (!comments || !comments.length) {
            throw Error('commentUUID is not found')
        }

        for (const comment of comments) {
            if (comment.commentImages) {
                await this.deleteCommentImagesSrv(...comment.commentImages)
            }
        }

        await this.repository.deleteCommentRepo(commentUUID)

        logger.info(`End service.comment.deleteCommentSrv`)
    }

    async deleteCommentsByForumUUIDSrv(forumUUID: string) {
        logger.info(`Start service.comment.deleteCommentsByForumUUIDSrv, "input": ${JSON.stringify(forumUUID)}`)

        const comments = await this.repository.getCommentsRepo({forumUUID})

        if (comments) {
            for (const comment of comments) {
                if (comment.commentImages) {
                    await this.deleteCommentImagesSrv(...comment.commentImages)
                }
            }
        }

        await this.repository.deleteCommentsByForumUUIDRepo(forumUUID)

        logger.info(`End service.comment.deleteCommentsByForumUUIDSrv`)
    }

    async likeCommentSrv(commentUUID: string, userUUID: string, isLike: boolean) {
        logger.info(`Start service.comment.likeCommentSrv, "input": ${JSON.stringify({commentUUID, userUUID, isLike})}`)

        await this.repository.likeCommentRepo(commentUUID, userUUID, isLike)

        logger.info(`End service.comment.likeCommentSrv`)
    }

    async pullLikeUserUUIDFromCommentSrv(userUUID: string) {
        logger.info(`Start service.forum.pullLikeUserUUIDFromCommentSrv, "input": ${JSON.stringify({ userUUID })}`)

        await this.repository.pullLikeUserUUIDFromCommentRepo(userUUID)

        logger.info(`End service.forum.pullLikeUserUUIDFromCommentSrv`)
    }
}