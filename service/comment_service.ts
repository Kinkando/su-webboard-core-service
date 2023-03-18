import { v4 as uuid } from "uuid";
import { Comment, CommentView } from "../model/comment";
import { CloudStorage, File } from '../cloud/google/storage';
import { CommentRepository } from "../repository/mongo/comment_repository";
import logger from "../util/logger";
import { Pagination } from "../model/common";

const storageFolder = "comment"

export function newCommentService(repository: CommentRepository, storage: CloudStorage) {
    return new CommentService(repository, storage)
}

interface Service {
    getCommentsSrv(commentUUID: string, filter: Pagination): Promise<{ total: number, data: CommentView[] }>
    upsertCommentSrv(comment: Comment, files: File[]): void
    deleteCommentSrv(commentUUID: string): void
    deleteCommentsByForumUUIDSrv(forumUUID: string): void
    likeCommentSrv(commentUUID: string, userUUID: string, isLike: boolean): void
}

export class CommentService implements Service {
    constructor(private repository: CommentRepository, private storage: CloudStorage) {}

    async getCommentsSrv(commentUUID: string, filter: Pagination) {
        logger.info(`Start service.comment.getCommentsSrv, "input": ${JSON.stringify({commentUUID, filter})}`)

        const comments = await this.repository.getCommentsRepo(commentUUID, filter)

        if(comments?.data) {
            for(let comment of comments.data) {
                if (comment.commentImageURLs) {
                    for(let i=0; i<comment.commentImageURLs.length; i++) {
                        comment.commentImageURLs[i] = this.storage.publicURL(comment.commentImageURLs[i])
                    }
                }
                if (comment.replyComments) {
                    for (let replyComment of comment.replyComments) {
                        if (replyComment.commentImageURLs) {
                            for(let i=0; i<replyComment.commentImageURLs.length; i++) {
                                replyComment.commentImageURLs[i] = this.storage.publicURL(replyComment.commentImageURLs[i])
                            }
                        }
                        replyComment.commenterImageURL = await this.storage.signedURL(replyComment.commenterImageURL)
                    }
                }
                comment.commenterImageURL = await this.storage.signedURL(comment.commenterImageURL)
            }
        }

        logger.info(`End service.comment.getCommentsSrv, "output": {"total": ${comments?.total || 0}, "data.length": ${comments?.data?.length || 0}}`)
        return comments
    }

    async upsertCommentSrv(comment: Comment, files: File[]) {
        logger.info(`Start service.comment.upsertCommentSrv, "input": ${JSON.stringify(comment)}`)

        const uploadCommentImage = async (comment: Comment) => {
            if (files) {
                comment.commentImageURLs = []
                for (const file of files) {
                    const fileName = await this.storage.uploadFile(file, `${storageFolder}/${comment.forumUUID}/${comment.commentUUID}`)
                    await this.storage.setPublic(fileName)
                    comment.commentImageURLs.push(fileName)
                }
            }
        }

        if (comment.commentUUID) {
            const commentReq = await this.repository.getCommentRepo(comment.commentUUID)
            if (!commentReq || !commentReq.commentUUID) {
                throw Error('commentUUID is not found')
            }
            if (commentReq.commentImageURLs) {
                for (const commentImageURL of commentReq.commentImageURLs) {
                    try {
                        await this.storage.deleteFile(commentImageURL)
                    } catch (error) {
                        logger.error(error)
                    }
                }
            }
            await uploadCommentImage(comment)
            await this.repository.updateCommentRepo(comment)

        } else {
            comment.commentUUID = uuid()
            await uploadCommentImage(comment)
            await this.repository.createCommentRepo(comment)
        }

        logger.info(`End service.comment.upsertCommentSrv, "output": ${JSON.stringify({ commentUUID: comment.commentUUID })}`)
        return comment.commentUUID
    }

    async deleteCommentSrv(commentUUID: string) {
        logger.info(`Start service.comment.deleteCommentSrv, "input": ${JSON.stringify(commentUUID)}`)

        const comment = await this.repository.getCommentRepo(commentUUID)
        if (!comment) {
            throw Error('commentUUID is not found')
        }

        if (comment.commentImageURLs) {
            for (const commentImageURL of comment.commentImageURLs) {
                try {
                    await this.storage.deleteFile(commentImageURL)
                } catch (error) {
                    logger.error(error)
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
                if (comment.commentImageURLs) {
                    for (const commentImageURL of comment.commentImageURLs) {
                        try {
                            await this.storage.deleteFile(commentImageURL)
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