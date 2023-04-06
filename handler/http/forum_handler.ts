import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer'
import { ForumSocket } from '../socket/forum_socket';
import { NotificationSocket } from '../socket/notification_socket';
import HTTP from "../../common/http";
import { FilterForum, Forum } from '../../model/forum';
import { Report, ReportStatus } from '../../model/report';
import { NotificationBody } from '../../model/notification';
import { CommentService } from '../../service/comment_service';
import { ForumService } from "../../service/forum_service";
import { NotificationService } from '../../service/notification_service';
import { ReportService } from '../../service/report_service';
import { UserService } from '../../service/user_service';
import logger from "../../util/logger";
import { getProfile } from '../../util/profile';
import { bind, validate } from "../../util/validate";

const upload = multer()

export function newForumHandler(
    forumService: ForumService,
    commentService: CommentService,
    notificationService: NotificationService,
    reportService: ReportService,
    userService: UserService,
    forumSocket: ForumSocket,
    notificationSocket: NotificationSocket,
) {
    const forumHandler = new ForumHandler(forumService, commentService, notificationService, reportService, userService, forumSocket, notificationSocket)

    const forumRouter = Router()
    forumRouter.get('', (req, res, next) => forumHandler.getForums(req, res, next))
    forumRouter.get('/:forumUUID', (req, res, next) => forumHandler.getForumDetail(req, res, next))
    forumRouter.put('', upload.array("files"), (req, res, next) => forumHandler.upsertForum(req, res, next))
    forumRouter.delete('', (req, res, next) => forumHandler.deleteForum(req, res, next))
    forumRouter.patch('/like', (req, res, next) => forumHandler.likeForum(req, res, next))
    forumRouter.patch('/favorite', (req, res, next) => forumHandler.favoriteForum(req, res, next))
    forumRouter.post('/report/:forumUUID', (req, res, next) => forumHandler.reportForum(req, res, next))

    return forumRouter
}

export class ForumHandler {
    constructor(
        private forumService: ForumService,
        private commentService: CommentService,
        private notificationService: NotificationService,
        private reportService: ReportService,
        private userService: UserService,
        private forumSocket: ForumSocket,
        private notificationSocket: NotificationSocket,
    ) {}

    async getForums(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.getForums")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "favoriteUserUUID", type: "string", required: false},
                {field: "userUUID", type: "string", required: false},
                {field: "search", type: "string", required: false},
                {field: "categoryID", type: "number", required: false},
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

            const query: FilterForum = {
                limit: Number(req.query.limit) || 10,
                offset: Number(req.query.offset) || 0,
                userUUID: req.query.userUUID?.toString(),
                favoriteUserUUID: req.query.favoriteUserUUID?.toString(),
                categoryID: Number(req.query.categoryID),
                sortBy: req.query.sortBy?.toString() || 'createdAt@DESC',
                search: req.query.search?.toString(),
                selfUUID: profile.userUUID,
            }

            const forums = await this.forumService.getForumsPaginationSrv(query, false, profile.userUUID)
            if (!forums || !forums.total) {
                logger.error('forums are not found')
                return res.status(HTTP.StatusNoContent).send()
            }

            logger.info("End http.forum.getForums")
            return res.status(HTTP.StatusOK).send(forums);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getForumDetail(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.getForumDetail")

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

            const forum = await this.forumService.getForumDetailSrv(forumUUID, profile.userUUID)
            if (!forum || !forum.forumUUID) {
                logger.error('forumUUID is not found')
                return res.status(HTTP.StatusNotFound).send({ error: 'forumUUID is not found' })
            }

            forum.isLike = forum.likeUserUUIDs?.includes(profile.userUUID) || false
            delete forum.likeUserUUIDs

            logger.info("End http.forum.getForumDetail")
            return res.status(HTTP.StatusOK).send(forum);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async upsertForum(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.upsertForum")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const data = JSON.parse(req.body.data);

            const schemas = [
                {field: "forumUUID", type: "string", required: false},
                {field: "title", type: "string", required: true},
                {field: "description", type: "string", required: true},
                {field: "categoryIDs", type: "array<number>", required: true},
                {field: "isAnonymous", type: "boolean", required: false},
            ]

            try {
                validate(schemas, data)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const forum: Forum = bind(data, schemas)
            forum.authorUUID = profile.userUUID
            forum.title = forum.title.trim()

            let isUpdate = forum.forumUUID !== undefined

            if (forum.categoryIDs.length > 5) {
                logger.error('categoryIDs is limit at 5')
                return res.status(HTTP.StatusBadRequest).send({ error: "categoryIDs is limit at 5" })
            }

            const response = await this.forumService.upsertForumSrv(profile.userUUID, forum, req.files as any, data.forumImageUUIDs)

            if (isUpdate) {
                this.forumSocket.updateForum(profile.sessionUUID, response.forumUUID)
            } else {
                const notiUsers = await this.userService.getUsersSrv({notiUserUUID: profile.userUUID})
                if (notiUsers) {
                    for(const notiUser of notiUsers) {
                        const noti = {notiBody: NotificationBody.NewForum, notiUserUUID: profile.userUUID, userUUID: notiUser.userUUID!, forumUUID: response.forumUUID}
                        const { notiUUID, mode } = await this.notificationService.createUpdateDeleteNotificationSrv(noti as any, 'push')
                        if (mode === 'create') {
                            this.notificationSocket.createNotification(notiUser.userUUID!, notiUUID)
                        }
                    }
                }
            }

            logger.info("End http.forum.upsertForum")
            return res.status(HTTP.StatusOK).send(response);

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async deleteForum(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.deleteForum")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const forumUUID = req.body.forumUUID
            if (!forumUUID) {
                logger.error('forumUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "forumUUID is required" })
            }

            const forum = await this.forumService.getForumDetailSrv(forumUUID, profile.userUUID, true)
            if (!forumUUID) {
                logger.error('forumUUID is not found')
                return res.status(HTTP.StatusNotFound).send({ error: "forumUUID is not found" })
            }

            await this.forumService.deleteForumSrv(forumUUID, profile.userUUID)
            await this.commentService.deleteCommentsByForumUUIDSrv(forumUUID)
            this.forumSocket.deleteForum(profile.sessionUUID, forumUUID)

            const notifications = await this.notificationService.getNotificationsSrv({forumUUID: forum.forumUUID} as any)
            await this.notificationService.createUpdateDeleteNotificationSrv({forumUUID: forum.forumUUID} as any, 'remove')
            if (notifications) {
                for(const noti of notifications) {
                    this.notificationSocket.refreshNotification(noti.userUUID)
                }
            }

            await this.reportService.invalidReportStatusSrv({forumUUID} as any)

            logger.info("End http.forum.deleteForum")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async likeForum(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.likeForum")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "forumUUID", type: "string", required: true},
                {field: "isLike", type: "boolean", required: true},
            ]

            try {
                validate(schemas, req.body)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const forumUUID = req.body.forumUUID
            const isLike = Boolean(req.body.isLike)

            const forum = await this.forumService.getForumDetailSrv(forumUUID, profile.userUUID, true)
            if (!forum || !forum.forumUUID) {
                logger.error('forumUUID is not found')
                return res.status(HTTP.StatusBadRequest).send({ error: 'forumUUID is not found' })
            }

            await this.forumService.likeForumSrv(forumUUID, profile.userUUID, isLike)

            this.forumSocket.updateForum(profile.sessionUUID, forumUUID)

            const action = isLike ? 'push' : 'pop'
            if (profile.userUUID !== forum.authorUUID) {
                const noti = {notiBody: NotificationBody.LikeForum, notiUserUUID: profile.userUUID, userUUID: forum.authorUUID, forumUUID: forum.forumUUID}
                const { notiUUID, mode } = await this.notificationService.createUpdateDeleteNotificationSrv(noti, action)
                if (mode === 'create') {
                    this.notificationSocket.createNotification(forum.authorUUID, notiUUID)
                } else if (mode === 'update') {
                    this.notificationSocket.updateNotification(forum.authorUUID, notiUUID, action)
                } else {
                    this.notificationSocket.deleteNotification(forum.authorUUID, notiUUID)
                }
            }

            logger.info("End http.forum.likeForum")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async favoriteForum(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.favoriteForum")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "forumUUID", type: "string", required: true},
                {field: "isFavorite", type: "boolean", required: true},
            ]

            try {
                validate(schemas, req.body)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const forumUUID = req.body.forumUUID
            const isFavorite = Boolean(req.body.isFavorite)

            await this.forumService.favoriteForumSrv(forumUUID, profile.userUUID, isFavorite)

            logger.info("End http.forum.favoriteForum")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async reportForum(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.reportForum")

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

            const reportReason = req.body.reportReason
            if (!reportReason) {
                logger.error('reportReason is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "reportReason is required" })
            }

            const forum = await this.forumService.getForumDetailSrv(forumUUID, profile.userUUID, true)
            if (!forum || !forum.forumUUID) {
                logger.error('forum is not found')
                return res.status(HTTP.StatusNotFound).send({ error: "forum is not found" })
            }

            if (profile.userUUID === forum.authorUUID) {
                logger.error('unable to create report: forum author unable to create self report')
                return res.status(HTTP.StatusBadRequest).send({ error: "unable to create report: forum author unable to create self report" })
            }

            const report: Report = {
                forumUUID,
                reportReason,
                reporterUUID: profile.userUUID,
                reportStatus: ReportStatus.Pending,
                plaintiffUUID: forum.authorUUID
            }

            await this.reportService.createReportSrv(report, 'forum')

            logger.info("End http.forum.favoriteForum")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}