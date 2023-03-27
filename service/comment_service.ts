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
    getCommentSrv(commentUUID: string, userUUID: string): Promise<CommentView>
    getCommentsSrv(commentUUID: string, filter: Pagination, userUUID: string): Promise<{ total: number, data: CommentView[] }>
    upsertCommentSrv(comment: Comment, files: File[], commentImageUUIDs?: string[]): Promise<{ commentUUID: string, documents: Document[] }>
    deleteCommentSrv(commentUUID: string): void
    deleteCommentsByForumUUIDSrv(forumUUID: string): void
    likeCommentSrv(commentUUID: string, userUUID: string, isLike: boolean): void
}

export class CommentService implements Service {
    constructor(private repository: CommentRepository, private storage: CloudStorage) {}

    private async assertAnonymousSrv(comment: CommentView, userUUID: string) {
        const injectAnonymous = async (comment: CommentView) => {
            if (comment.isAnonymous) {
                comment.commenterName = 'ไม่ระบุตัวตน'
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

    async getCommentSrv(commentUUID: string, userUUID: string) {
        logger.info(`Start service.comment.getCommentSrv, "input": ${JSON.stringify({commentUUID, userUUID})}`)

        const comment = await this.repository.getCommentRepo(commentUUID)

        if (comment?.commentImages) {
            for(let i=0; i<comment.commentImages.length; i++) {
                comment.commentImages[i].url = this.storage.publicURL(comment.commentImages[i].url)
            }
            await this.assertAnonymousSrv(comment, userUUID)
        }

        logger.info(`End service.comment.getCommentSrv, "output": ${JSON.stringify(comment)}`)
        return comment
    }

    async getCommentsSrv(commentUUID: string, filter: Pagination, userUUID: string) {
        logger.info(`Start service.comment.getCommentsSrv, "input": ${JSON.stringify({commentUUID, filter, userUUID})}`)

        const comments = await this.repository.getCommentsRepo(commentUUID, filter, userUUID)

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

        logger.info(`End service.comment.getCommentsSrv, "output": {"total": ${comments?.total || 0}, "data.length": ${comments?.data?.length || 0}}`)
        return comments
    }

    async upsertCommentSrv(comment: Comment, files: File[], commentImageUUIDs?: string[]) {
        logger.info(`Start service.comment.upsertCommentSrv, "input": ${JSON.stringify({comment, commentImageUUIDs})}`)

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
            const commentReq = await this.repository.getCommentRepo(comment.commentUUID)
            if (!commentReq || !commentReq.commentUUID) {
                throw Error('commentUUID is not found')
            }
            if (commentImageUUIDs && commentReq.commentImages) {
                const commentImageReq = commentReq.commentImages.filter(doc => commentImageUUIDs.includes(doc.uuid))
                if (commentImageReq) {
                    for (const commentImage of commentImageReq) {
                        try {
                            await this.storage.deleteFile(commentImage.url)
                        } catch (error) {
                            logger.error(error)
                        }
                    }
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
        logger.info(`Start service.comment.deleteCommentSrv, "input": ${JSON.stringify(commentUUID)}`)

        const comments = await this.repository.getCommentAndReplyRepo(commentUUID)
        if (!comments || !comments.length) {
            throw Error('commentUUID is not found')
        }

        for (const comment of comments) {
            if (comment.commentImages) {
                for (const commentImage of comment.commentImages) {
                    try {
                        await this.storage.deleteFile(commentImage.url)
                    } catch (error) {
                        logger.error(error)
                    }
                }
            }
        }

        await this.repository.deleteCommentRepo(commentUUID)

        logger.info(`End service.comment.deleteCommentSrv`)
    }

    async deleteCommentsByForumUUIDSrv(forumUUID: string) {
        logger.info(`Start service.comment.deleteCommentsByForumUUIDSrv, "input": ${JSON.stringify(forumUUID)}`)

        const comments = await this.repository.getCommentsByForumUUIDRepo(forumUUID)

        if (comments) {
            for (const comment of comments) {
                if (comment.commentImages) {
                    for (const commentImage of comment.commentImages) {
                        try {
                            await this.storage.deleteFile(commentImage.url)
                        } catch (error) {
                            logger.error(error)
                        }
                    }
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
}