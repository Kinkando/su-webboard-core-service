import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer'
import { ForumSocket } from '../socket/forum_socket';
import { NotificationSocket } from '../socket/notification_socket';
import HTTP from "../../common/http";
import { Pagination } from '../../model/common';
import { Comment } from '../../model/comment';
import { Notification, NotificationBody } from '../../model/notification';
import { Report, ReportStatus } from '../../model/report';
import { CommentService } from "../../service/comment_service";
import { ForumService } from '../../service/forum_service';
import { NotificationService } from '../../service/notification_service';
import { ReportService } from '../../service/report_service';
import logger from "../../util/logger";
import { getProfile } from '../../util/profile';
import { bind, validate } from "../../util/validate";

const upload = multer()

export function newCommentHandler(
    commentService: CommentService,
    forumService: ForumService,
    notificationService: NotificationService,
    reportService: ReportService,
    forumSocket: ForumSocket,
    notificationSocket: NotificationSocket,
) {
    const commentHandler = new CommentHandler(commentService, forumService, notificationService, reportService, forumSocket, notificationSocket)

    const commentRouter = Router()
    commentRouter.get('/:forumUUID', (req, res, next) => commentHandler.getComments(req, res, next))
    commentRouter.get('/:forumUUID/:commentUUID', (req, res, next) => commentHandler.getComment(req, res, next))
    commentRouter.put('', upload.array("files"), (req, res, next) => commentHandler.upsertComment(req, res, next))
    commentRouter.delete('', (req, res, next) => commentHandler.deleteComment(req, res, next))
    commentRouter.patch('/like', (req, res, next) => commentHandler.likeComment(req, res, next))
    commentRouter.post('/report/:commentUUID', (req, res, next) => commentHandler.reportComment(req, res, next))

    return commentRouter
}

export class CommentHandler {
    constructor(
        private commentService: CommentService,
        private forumService: ForumService,
        private notificationService: NotificationService,
        private reportService: ReportService,
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

                let replyToUserUUID = ""
                let notiBody = ""
                if (comment.replyCommentUUID) {
                    const cm = await this.commentService.getCommentSrv(comment.replyCommentUUID, profile.userUUID, true)
                    if (cm) {
                        replyToUserUUID = cm.commenterUUID
                        notiBody = NotificationBody.NewReplyComment
                    }
                } else {
                    const forum = await this.forumService.getForumDetailSrv(comment.forumUUID, profile.userUUID, true)
                    if (forum) {
                        replyToUserUUID = forum.authorUUID
                        notiBody = NotificationBody.NewComment
                    }
                }

                if (replyToUserUUID !== profile.userUUID && replyToUserUUID && notiBody) {
                    const noti = {notiBody, notiUserUUID: profile.userUUID, userUUID: replyToUserUUID, forumUUID: comment.forumUUID, commentUUID: response.commentUUID, replyCommentUUID: comment.replyCommentUUID}
                    const { notiUUID, mode } = await this.notificationService.createUpdateDeleteNotificationSrv(noti, 'push')
                    if (mode === 'create') {
                        this.notificationSocket.createNotification(replyToUserUUID, notiUUID)
                    }
                }

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

            const noti: Notification = {forumUUID: comment.forumUUID, commentUUID: comment.commentUUID, replyCommentUUID: comment.replyCommentUUID} as any
            const notifications = await this.notificationService.getNotificationsSrv(noti)
            await this.notificationService.createUpdateDeleteNotificationSrv(noti, 'remove')
            if (notifications) {
                for(const noti of notifications) {
                    this.notificationSocket.refreshNotification(noti.userUUID)
                }
            }

            await this.reportService.invalidReportStatusSrv({commentUUID, replyCommentUUID: comment.replyCommentUUID} as any)

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

            const comment = await this.commentService.getCommentSrv(commentUUID, profile.userUUID, true)
            if (!comment || !comment.commentUUID) {
                logger.error('comment is not found')
                return res.status(HTTP.StatusNotFound).send({ error: "comment is not found" })
            }

            await this.commentService.likeCommentSrv(commentUUID, profile.userUUID, isLike)

            this.forumSocket.updateComment(profile.sessionUUID, comment.forumUUID, comment.commentUUID, comment.replyCommentUUID)

            const action = isLike ? 'push' : 'pop'
            if (profile.userUUID !== comment.commenterUUID) {
                const noti: Notification = {
                    notiBody: NotificationBody.LikeComment,
                    notiUserUUID: profile.userUUID,
                    userUUID: comment.commenterUUID,
                    forumUUID: comment.forumUUID,
                    commentUUID,
                    replyCommentUUID: comment.replyCommentUUID,
                }
                const { notiUUID, mode } = await this.notificationService.createUpdateDeleteNotificationSrv(noti, action)
                if (mode === 'create') {
                    this.notificationSocket.createNotification(comment.commenterUUID, notiUUID)
                } else if (mode === 'update') {
                    this.notificationSocket.updateNotification(comment.commenterUUID, notiUUID, action)
                } else {
                    this.notificationSocket.deleteNotification(comment.commenterUUID, notiUUID)
                }
            }

            logger.info("End http.comment.likeComment")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async reportComment(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.comment.reportComment")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const commentUUID = req.params['commentUUID'] as string
            if (!commentUUID) {
                logger.error('commentUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "commentUUID is required" })
            }

            const reportReason = req.body.reportReason
            if (!reportReason) {
                logger.error('reportReason is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "reportReason is required" })
            }

            const comment = await this.commentService.getCommentSrv(commentUUID, profile.userUUID, true)
            if (!comment || !comment.commentUUID) {
                logger.error('comment is not found')
                return res.status(HTTP.StatusNotFound).send({ error: "comment is not found" })
            }

            if (profile.userUUID === comment.commenterUUID) {
                logger.error('unable to create report: commenter unable to create self report')
                return res.status(HTTP.StatusBadRequest).send({ error: "unable to create report: commenter unable to create self report" })
            }

            const report: Report = {
                forumUUID: comment.forumUUID,
                commentUUID,
                replyCommentUUID: comment.replyCommentUUID,
                reportReason,
                reporterUUID: profile.userUUID,
                reportStatus: ReportStatus.Pending,
                plaintiffUUID: comment.commenterUUID,
            }

            await this.reportService.createReportSrv(report, 'comment')

            logger.info("End http.comment.reportComment")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}