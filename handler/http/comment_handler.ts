import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer'
import HTTP from "../../common/http";
import { Pagination } from '../../model/common';
import { Comment } from '../../model/comment';
import { CommentService } from "../../service/comment_service";
import logger from "../../util/logger";
import { getProfile } from '../../util/profile';
import { bind, validate } from "../../util/validate";
import { ForumSocket } from '../../handler/socket/forum_socket';
import { NotificationService } from '../../service/notification_service';
import { NotificationSocket } from '../socket/notification_socket';

const upload = multer()

export function newCommentHandler(
    commentService: CommentService,
    notificationService: NotificationService,
    forumSocket: ForumSocket,
    notificationSocket: NotificationSocket,
) {
    const commentHandler = new CommentHandler(commentService, notificationService, forumSocket, notificationSocket)

    const commentRouter = Router()
    commentRouter.get('/:forumUUID', (req, res, next) => commentHandler.getComments(req, res, next))
    commentRouter.get('/:forumUUID/:commentUUID', (req, res, next) => commentHandler.getComment(req, res, next))
    commentRouter.put('', upload.array("files"), (req, res, next) => commentHandler.upsertComment(req, res, next))
    commentRouter.delete('', (req, res, next) => commentHandler.deleteComment(req, res, next))
    commentRouter.patch('/like', (req, res, next) => commentHandler.likeComment(req, res, next))

    return commentRouter
}

export class CommentHandler {
    constructor(
        private commentService: CommentService,
        private notificationService: NotificationService,
        private forumSocket: ForumSocket,
        private notificationSocket: NotificationSocket,
    ) {}

    async getComment(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.comment.getComment")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const forumUUID = req.params['forumUUID'] as string
            if (!forumUUID) {
                logger.error('forumUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "forumUUID is required" })
            }

            const commentUUID = req.params['commentUUID'] as string
            if (!commentUUID) {
                logger.error('commentUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "commentUUID is required" })
            }

            const comment = await this.commentService.getCommentSrv(commentUUID, profile.userUUID)
            if (!comment || !comment.commentUUID) {
                logger.error('comment is not found')
                return res.status(HTTP.StatusNotFound).send({ error: 'comment is not found' })
            }
            delete (comment as any).forumUUID

            logger.info("End http.comment.getComment")
            return res.status(HTTP.StatusOK).send(comment);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getComments(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.comment.getComments")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const forumUUID = req.params['forumUUID'] as string
            if (!forumUUID) {
                logger.error('forumUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "forumUUID is required" })
            }

            const schemas = [
                {field: "sortBy", type: "string", required: false},
                {field: "limit", type: "number", required: false},
                {field: "offset", type: "number", required: false},
            ]

            try {
                validate(schemas, req.query)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const query: Pagination = {
                sortBy: req.query.sortBy as string,
                limit: Number(req.query.limit) || 10,
                offset: Number(req.query.offset) || 0,
            }

            const comments = await this.commentService.getCommentsPaginationSrv(forumUUID, query, profile.userUUID)
            if (!comments || !comments.total) {
                logger.error('comments are not found')
                return res.status(HTTP.StatusNoContent).send()
            }

            logger.info("End http.comment.getComments")
            return res.status(HTTP.StatusOK).send(comments);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async upsertComment(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.comment.upsertComment")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const data = JSON.parse(req.body.data);

            const schemas = [
                {field: "forumUUID", type: "string", required: true},
                {field: "commentUUID", type: "string", required: false},
                {field: "replyCommentUUID", type: "string", required: false},
                {field: "commentText", type: "string", required: true},
            ]

            try {
                validate(schemas, data)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const comment: Comment = bind(data, schemas)
            comment.commenterUUID = profile.userUUID

            const isCreate = comment.commentUUID == undefined

            const response = await this.commentService.upsertCommentSrv(profile.userUUID, comment, req.files as any, data.commentImageUUIDs)

            if (isCreate) {
                this.forumSocket.createComment(profile.sessionUUID, comment.forumUUID, response.commentUUID, comment.replyCommentUUID)
            } else {
                this.forumSocket.updateComment(profile.sessionUUID, comment.forumUUID, response.commentUUID, comment.replyCommentUUID)
            }

            logger.info("End http.comment.upsertComment")
            return res.status(HTTP.StatusOK).send(response);

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async deleteComment(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.comment.deleteComment")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const commentUUID = req.body.commentUUID
            if (!commentUUID) {
                logger.error('commentUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "commentUUID is required" })
            }

            const comment = await this.commentService.getCommentSrv(commentUUID, profile.userUUID)
            if (!comment || !comment.commentUUID) {
                logger.error('comment is not found')
                return res.status(HTTP.StatusNotFound).send({ error: "comment is not found" })
            }

            await this.commentService.deleteCommentSrv(commentUUID)

            this.forumSocket.deleteComment(profile.sessionUUID, comment.forumUUID, comment.commentUUID, comment.replyCommentUUID)

            logger.info("End http.comment.deleteComment")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async likeComment(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.comment.likeComment")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "commentUUID", type: "string", required: true},
                {field: "isLike", type: "boolean", required: true},
            ]

            try {
                validate(schemas, req.body)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const commentUUID = req.body.commentUUID
            const isLike = Boolean(req.body.isLike)

            const comment = await this.commentService.getCommentSrv(commentUUID, profile.userUUID)
            if (!comment || !comment.commentUUID) {
                logger.error('comment is not found')
                return res.status(HTTP.StatusNotFound).send({ error: "comment is not found" })
            }

            await this.commentService.likeCommentSrv(commentUUID, profile.userUUID, isLike)

            this.forumSocket.updateComment(profile.sessionUUID, comment.forumUUID, comment.commentUUID, comment.replyCommentUUID)

            logger.info("End http.comment.likeComment")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}