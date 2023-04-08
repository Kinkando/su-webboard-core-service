import { NextFunction, Request, Response, Router } from 'express';
import { ForumSocket } from '../socket/forum_socket';
import { NotificationSocket } from '../socket/notification_socket';
import HTTP from '../../common/http';
import { AdminSocket } from '../../handler/socket/admin_socket';
import { UserType } from '../../model/authen';
import { Category } from '../../model/category';
import { Pagination } from '../../model/common';
import { Notification } from '../../model/notification';
import { User, UserPagination } from '../../model/user';
import { FilterReport, ReportDetail, ReportStatus } from '../../model/report';
import { AnnouncementService } from '../../service/announcement_service';
import { AuthenService } from '../../service/authen_service';
import { CategoryService } from '../../service/category_service';
import { CommentService } from '../../service/comment_service';
import { ForumService } from '../../service/forum_service';
import { NotificationService } from '../../service/notification_service';
import { ReportService } from '../../service/report_service';
import { UserService } from '../../service/user_service';
import logger from '../../util/logger';
import { getProfile } from '../../util/profile';
import { bind, validate } from '../../util/validate';

export function newAdminHandler(
    announcementService: AnnouncementService,
    authenService: AuthenService,
    categoryService: CategoryService,
    commentService: CommentService,
    forumService: ForumService,
    notificationService: NotificationService,
    reportService: ReportService,
    userService: UserService,
    adminSocket: AdminSocket,
    forumSocket: ForumSocket,
    notificationSocket: NotificationSocket,
) {
    const adminHandler = new AdminHandler(
        announcementService,
        authenService,
        categoryService,
        commentService,
        forumService,
        notificationService,
        reportService,
        userService,
        adminSocket,
        forumSocket,
        notificationSocket,
    )

    const adminRouter = Router()

    adminRouter.get('/home', (req, res, next) => adminHandler.home(req, res, next))

    adminRouter.post('/user/revoke', (req, res, next) => adminHandler.revokeUsers(req, res, next))
    adminRouter.get('/user', (req, res, next) => adminHandler.getUsers(req, res, next))
    adminRouter.post('/user/:userType', (req, res, next) => adminHandler.createUser(req, res, next))
    adminRouter.patch('/user', (req, res, next) => adminHandler.updateUser(req, res, next))
    adminRouter.delete('/user', (req, res, next) => adminHandler.deleteUser(req, res, next))

    adminRouter.get('/category', (req, res, next) => adminHandler.getCategories(req, res, next))
    adminRouter.put('/category', (req, res, next) => adminHandler.upsertCategory(req, res, next))
    adminRouter.delete('/category', (req, res, next) => adminHandler.deleteCategory(req, res, next))

    adminRouter.get('/report', (req, res, next) => adminHandler.getReports(req, res, next))
    adminRouter.get('/report/:reportUUID', (req, res, next) => adminHandler.getReportDetail(req, res, next))
    adminRouter.patch('/report/:reportUUID/:reportStatus', (req, res, next) => adminHandler.updateReportStatus(req, res, next))
    adminRouter.delete('/report', (req, res, next) => adminHandler.deleteReport(req, res, next))

    return adminRouter
}

class AdminHandler {
    constructor(
        private announcementService: AnnouncementService,
        private authenService: AuthenService,
        private categoryService: CategoryService,
        private commentService: CommentService,
        private forumService: ForumService,
        private notificationService: NotificationService,
        private reportService: ReportService,
        private userService: UserService,
        private adminSocket: AdminSocket,
        private forumSocket: ForumSocket,
        private notificationSocket: NotificationSocket,
    ) {}

    async home(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.home")

        try {
            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const fromDate = req.query.fromDate ? new Date(req.query.fromDate.toString()) : new Date();

            const countReportStatus = await this.reportService.countReportStatusSrv()

            // const countForumDocs = await this.forumService.countForumDocumentsSrv()
            // const countCategoryOccurrence = await this.categoryService.getCategoryDetailsSrv()
            // const uniqueOccurrence = [... new Set(countCategoryOccurrence.map(category => category.forumCount))].sort((a, b) => b-a)
            // countCategoryOccurrence.forEach(category => {
            //     category.total = countForumDocs
            //     category.ranking = uniqueOccurrence.findIndex(oc => oc === category.forumCount)+1
            // })

            const countForumOccurrence = await this.forumService.countForumBackToLatestSrv(fromDate, 7)

            const resp = {
                reportStatus: countReportStatus,
                // categories: countCategoryOccurrence.sort((a, b) => a.ranking! - b.ranking!),
                forums: countForumOccurrence,
            }

            logger.info("End http.admin.home")
            return res.status(HTTP.StatusOK).send(resp);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async revokeUsers(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.revokeUsers")

        try {
            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const userUUIDs = req.body?.userUUIDs as string[]
            if (!userUUIDs || !userUUIDs.length) {
                logger.error('userUUIDs is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "userUUIDs is required" })
            }

            await this.authenService.revokeTokensByAdminSrv(userUUIDs)
            userUUIDs.forEach(userUUID => {
                this.notificationSocket.refreshNotification(userUUID)
                this.adminSocket.userDisconnected({userUUID})
            })

            logger.info("End http.admin.revokeUsers")
            return res.status(HTTP.StatusOK).send({ message: "success" });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getUsers(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.getUsers")

        try {
            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "userType", type: "string", required: false},
                {field: "search", type: "string", required: false},
                {field: "limit", type: "number", required: false},
                {field: "offset", type: "number", required: false},
                {field: "sortBy", type: "string", required: false},
            ]

            try {
                validate(schemas, req.query)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const filter: UserPagination = {
                userType: req.query.userType?.toString(),
                search: req.query.search?.toString() || "",
                limit: Number(req.query.limit) || 10,
                offset: Number(req.query.offset) || 0,
                sortBy: req.query.sortBy?.toString(),
            }
            if (filter.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusBadRequest).send({ error: "permission is denied" })
            }
            const users = await this.userService.getUsersPaginationSrv(filter)
            if (!users || !users.total) {
                logger.error('users are not found')
                return res.status(HTTP.StatusNoContent).send()
            }

            if (users.data) {
                users.data.forEach(user => {
                    delete (user as any)._id
                    delete (user as any).createdAt
                    delete (user as any).updatedAt
                    delete (user as any).firebaseID
                })
            }

            logger.info("End http.admin.getUsers")
            return res.status(HTTP.StatusOK).send(users);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async createUser(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.createUser")

        try {
            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const userType = req.params['userType'] as UserType
            if (userType !== 'std' && userType !== 'tch') {
                logger.error('userType is invalid')
                return res.status(HTTP.StatusBadRequest).send({ error: "userType is invalid" })
            }

            const schemas = [
                {field: "userFullName", type: "string", required: true},
                {field: "userEmail", type: "email", required: true},
                {field: "studentID", type: "string", required: false},
            ]

            try {
                validate(schemas, req.body)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const user: User = {
                userFullName: req.body.userFullName.trim(),
                userEmail: req.body.userEmail.trim(),
                userType,
            }

            if (userType === 'std') {
                if (!req.body.studentID || typeof req.body.studentID !== 'string') {
                    logger.error('studentID is invalid')
                    return res.status(HTTP.StatusBadRequest).send({ error: "studentID is invalid" })
                }
                user.studentID = req.body.studentID
            }

            const isExistEmail = await this.userService.isExistEmailSrv(user.userEmail!)
            if (isExistEmail) {
                logger.error(`email: ${user.userEmail!} is exist`)
                return res.status(HTTP.StatusBadRequest).send({ error: `email: ${user.userEmail!} is exist` })
            }

            await this.userService.createUserSrv(user)

            logger.info("End http.admin.createUser")
            return res.status(HTTP.StatusCreated).send({ message: "success" });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async updateUser(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.updateUser")

        try {
            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "userUUID", type: "string", required: true},
                {field: "userDisplayName", type: "string", required: false},
                {field: "userFullName", type: "string", required: false},
                {field: "userEmail", type: "email", required: false},
                {field: "studentID", type: "string", required: false},
            ]

            try {
                validate(schemas, req.body)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const user: User = bind(req.body, schemas)
            user.userDisplayName = user.userDisplayName?.trim()
            user.userFullName = user.userFullName?.trim()
            user.userEmail = user.userEmail?.trim()

            await this.userService.updateUserSrv(user)

            this.adminSocket.userUpdated(user.userUUID!)

            logger.info("End http.admin.updateUser")
            return res.status(HTTP.StatusOK).send({ message: "success" });

        } catch (error) {
            const errorMessage = (error as Error).message
            const httpStatus = errorMessage.includes('user is not found') || errorMessage.includes('is exist') ? HTTP.StatusBadRequest : HTTP.StatusInternalServerError
            logger.error(errorMessage)
            return res.status(httpStatus).send({ error: errorMessage })
        }
    }

    async deleteUser(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.deleteUser")

        try {
            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const userUUIDs: string[] = req.body.userUUIDs
            if (!userUUIDs || !userUUIDs.length) {
                logger.error('userUUIDs is required')
                return res.status(HTTP.StatusBadRequest).send({ error: 'userUUIDs is required' })
            }

            const notiUserUUIDs = new Set<string>()

            for(const userUUID of userUUIDs) {
                await this.authenService.revokeTokensByAdminSrv(req.body?.userUUIDs)
                await this.userService.deleteUserSrv(userUUID)
                this.notificationSocket.refreshNotification(userUUID)

                const forums = await this.forumService.getForumsSrv({ authorUUID: userUUID })
                if (forums) {
                    for(const forum of forums) {
                        await this.forumService.deleteForumSrv(forum.forumUUID!)
                        await this.commentService.deleteCommentsByForumUUIDSrv(forum.forumUUID!)
                        this.forumSocket.deleteForum(profile.sessionUUID, forum.forumUUID!)

                        const notifications = await this.notificationService.getNotificationsSrv({forumUUID: forum.forumUUID} as any)
                        if (notifications) {
                            for(const noti of notifications) {
                                notiUserUUIDs.add(noti.userUUID)
                            }
                        }
                        this.notificationService.createUpdateDeleteNotificationSrv({forumUUID: forum.forumUUID!} as any, 'remove')

                        await this.reportService.invalidReportStatusSrv({forumUUID: forum.forumUUID!} as any)
                    }
                }
                const comments = await this.commentService.getCommentsSrv({ commenterUUID: userUUID })
                if (comments) {
                    for (const comment of comments) {
                        await this.commentService.deleteCommentSrv(comment.commentUUID!)
                        this.forumSocket.deleteComment(profile.sessionUUID, comment.forumUUID, comment.commentUUID!, comment.replyCommentUUID)

                        const noti: any = {forumUUID: comment.forumUUID, commentUUID: comment.commentUUID, replyCommentUUID: comment.replyCommentUUID} as Notification
                        const notifications = await this.notificationService.getNotificationsSrv(noti)
                        if (notifications) {
                            for(const noti of notifications) {
                                notiUserUUIDs.add(noti.userUUID)
                            }
                        }
                        await this.notificationService.createUpdateDeleteNotificationSrv(noti, 'remove')

                        await this.reportService.invalidReportStatusSrv(noti)
                    }
                }
                const announcements = await this.announcementService.getAnnouncementsByAuthorUUIDSrv(userUUID)
                if (announcements) {
                    for (const announcement of announcements) {
                        await this.announcementService.deleteAnnouncementSrv(announcement.announcementUUID!)

                        const notifications = await this.notificationService.getNotificationsSrv({announcementUUID: announcement.announcementUUID} as any)
                        if (notifications) {
                            for(const noti of notifications) {
                                notiUserUUIDs.add(noti.userUUID)
                            }
                        }
                        await this.notificationService.createUpdateDeleteNotificationSrv({announcementUUID: announcement.announcementUUID!} as any, 'remove')
                    }
                }

                const likeForums = await this.forumService.getForumsSrv({ likeUserUUID: userUUID })
                await this.forumService.pullFavoriteAndLikeUserUUIDFromForumSrv(userUUID)
                if (likeForums) {
                    for (const forum of likeForums) {
                        this.forumSocket.updateForum(profile.sessionUUID, forum.forumUUID!)

                        const notifications = await this.notificationService.getNotificationsSrv({forumUUID: forum.forumUUID} as any)
                        if (notifications) {
                            for(const noti of notifications) {
                                notiUserUUIDs.add(noti.userUUID)
                            }
                        }
                        const noti: any = {
                            // notiBody: NotificationBody.LikeForum,
                            notiUserUUID: userUUID,
                            userUUID: forum.authorUUID,
                            forumUUID: forum.forumUUID,
                        }
                        await this.notificationService.createUpdateDeleteNotificationSrv(noti, 'pop')
                    }
                }
                const likeComments = await this.commentService.getCommentsSrv({ likeUserUUID: userUUID })
                await this.commentService.pullLikeUserUUIDFromCommentSrv(userUUID)
                if (likeComments) {
                    for (const comment of likeComments) {
                        this.forumSocket.updateComment(profile.sessionUUID, comment.forumUUID!, comment.commentUUID!, comment.replyCommentUUID)

                        const notifications = await this.notificationService.getNotificationsSrv({forumUUID: comment.forumUUID, commentUUID: comment.commentUUID, replyCommentUUID: comment.replyCommentUUID} as any)
                        if (notifications) {
                            for(const noti of notifications) {
                                notiUserUUIDs.add(noti.userUUID)
                            }
                        }
                        const noti: any = {
                            // notiBody: NotificationBody.LikeComment,
                            notiUserUUID: userUUID,
                            userUUID: comment.commenterUUID,
                            forumUUID: comment.forumUUID,
                            commentUUID: comment.commentUUID,
                            replyCommentUUID: comment.replyCommentUUID,
                        }
                        await this.notificationService.createUpdateDeleteNotificationSrv(noti, 'pop')
                    }
                }
                await this.announcementService.pullSeeCountUUIDFromAnnouncementSrv(userUUID)

                await this.notificationService.createUpdateDeleteNotificationSrv({userUUID} as any, 'remove')

                // delete noti for user that this deleted user is following
                const notifications = await this.notificationService.getNotificationsSrv({followerUserUUID: userUUID} as any)
                if (notifications) {
                    for(const noti of notifications) {
                        notiUserUUIDs.add(noti.userUUID)
                    }
                }
                await this.notificationService.createUpdateDeleteNotificationSrv({followerUserUUID: userUUID} as any, 'remove')

                this.adminSocket.userDisconnected({userUUID})

                if (notiUserUUIDs) {
                    for (const userUUID of notiUserUUIDs) {
                        this.notificationSocket.refreshNotification(userUUID)
                    }
                }
            }

            logger.info("End http.admin.deleteUser")
            return res.status(HTTP.StatusOK).send({ message: "success" });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getCategories(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.getCategories")
        try {
            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "search", type: "string", required: false},
                {field: "limit", type: "number", required: false},
                {field: "offset", type: "number", required: false},
                {field: "sortBy", type: "string", required: false},
            ]

            try {
                validate(schemas, req.query)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const filter: Pagination = {
                search: req.query.search?.toString() || "",
                sortBy: req.query.sortBy?.toString(),
                limit: Number(req.query.limit) || 10,
                offset: Number(req.query.offset) || 0,
            }

            const data = await this.categoryService.getCategoriesPaginationSrv(filter)
            if (!data || !data.total) {
                logger.error('categories are not found')
                return res.status(HTTP.StatusNoContent).send()
            }

            logger.info("End http.admin.getCategories")
            return res.status(HTTP.StatusOK).send(data);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async upsertCategory(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.upsertCategory")
        try {

            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const isUpdate = req.body.categoryID != undefined

            const schemas = [
                {field: "categoryID", type: "number", required: isUpdate},
                {field: "categoryName", type: "string", required: !isUpdate},
                {field: "categoryHexColor", type: "hexColor", required: !isUpdate},
            ]

            try {
                validate(schemas, req.body)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const category: Category = bind(req.body, schemas)
            category.categoryName = category.categoryName.trim()
            category.categoryHexColor = category.categoryHexColor.trim()

            const isCreate = category.categoryID == undefined

            await this.categoryService.upsertCategorySrv(category)

            logger.info("End http.admin.upsertCategory")
            return res.status(isCreate ? HTTP.StatusCreated : HTTP.StatusOK).send({ message: "success" });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async deleteCategory(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.deleteCategory")
        try {

            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const categoryIDs = req.body.categoryIDs as number[]
            if (!categoryIDs) {
                logger.error('categoryIDs is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "categoryIDs is required" })
            }

            const notiUserUUIDs = new Set<string>()
            for (const categoryID of categoryIDs) {
                const forums = await this.forumService.getForumsSrv({ categoryID })
                if (forums) {
                    for(const forum of forums) {
                        if (forum.categoryIDs.length == 1 && forum.categoryIDs[0] === categoryID) {
                            await this.forumService.deleteForumSrv(forum.forumUUID!)
                            await this.commentService.deleteCommentsByForumUUIDSrv(forum.forumUUID!)
                            this.forumSocket.deleteForum(profile.sessionUUID, forum.forumUUID!)

                            const notifications = await this.notificationService.getNotificationsSrv({forumUUID: forum.forumUUID} as any)
                            if (notifications) {
                                for(const noti of notifications) {
                                    notiUserUUIDs.add(noti.userUUID)
                                }
                            }
                            this.notificationService.createUpdateDeleteNotificationSrv({forumUUID: forum.forumUUID!} as any, 'remove')

                            // delete report
                            // this.reportService.deleteReportSrv({forumUUID: forum.forumUUID!} as any)
                        } else {
                            await this.forumService.deleteCategoryIDToForumSrv(forum.forumUUID!, categoryID)
                        }
                    }
                }
                await this.categoryService.deleteCategorySrv(categoryID)
            }

            if (notiUserUUIDs) {
                for (const userUUID of notiUserUUIDs) {
                    this.notificationSocket.refreshNotification(userUUID)
                }
            }

            logger.info("End http.admin.deleteCategory")
            return res.status(HTTP.StatusOK).send({ message: "success" });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getReports(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.getReports")
        try {

            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "search", type: "string", required: false},
                {field: "offset", type: "number", required: false},
                {field: "limit", type: "number", required: false},
                {field: "sortBy", type: "string", required: false},
                {field: "reportStatus", type: "string", required: false},
                {field: "type", type: "string", required: false},
            ]

            try {
                validate(schemas, req.query)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const query: FilterReport = bind(req.query, schemas)

            const data = await this.reportService.getReportsPaginationSrv(query)
            if (!data || !data.total) {
                logger.error('reports are not found')
                return res.status(HTTP.StatusNoContent).send()
            }

            logger.info("End http.admin.getReports")
            return res.status(HTTP.StatusOK).send(data);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getReportDetail(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.getReportDetail")
        try {

            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const reportUUID = req.params['reportUUID'] as string
            if (!reportUUID) {
                logger.error('reportUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "reportUUID is required" })
            }

            const report = await this.reportService.getReportSrv(reportUUID)
            if (!report) {
                logger.error('reportUUID is not found')
                return res.status(HTTP.StatusNotFound).send({ error: 'reportUUID is not found' })
            }

            if (report.reportStatus !== ReportStatus.Pending) {
                logger.error('unable to get report detail: only report status: "pending" can access data')
                return res.status(HTTP.StatusBadRequest).send({ error: 'unable to get report detail: only report status: "pending" can access data' })
            }

            let result: ReportDetail = {
                reportUUID,
                createdAt: (report as any).createdAt,
                updatedAt: (report as any).updatedAt,
            };
            if (report.commentUUID) {
                const comment = await this.commentService.getCommentSrv(report.commentUUID, profile.userUUID)
                result.description = comment.commentText
                result.imageURLs = comment.commentImages?.map(image => image.url)
                result.userDisplayName = comment.commenterName
                result.userUUID = comment.commenterUUID
                result.userImageURL = comment.commenterImageURL
                result.createdAt = comment.createdAt
                result.updatedAt = comment.updatedAt as any
            } else {
                const forum = await this.forumService.getForumDetailSrv(report.forumUUID, profile.userUUID)
                result.categories = forum.categories
                result.title = forum.title
                result.description = forum.description
                result.imageURLs = forum.forumImages?.map(image => image.url)
                result.userDisplayName = forum.authorName
                result.userUUID = forum.authorUUID
                result.userImageURL = forum.authorImageURL
                result.createdAt = forum.createdAt!
                result.updatedAt = forum.updatedAt as any
            }

            logger.info("End http.admin.getReportDetail")
            return res.status(HTTP.StatusOK).send(result);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async updateReportStatus(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.updateReportStatus")
        try {

            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const reportUUID = req.params['reportUUID'] as string
            if (!reportUUID) {
                logger.error('reportUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "reportUUID is required" })
            }

            const reportStatus: ReportStatus.Rejected | ReportStatus.Resolved = req.params['reportStatus'] as any
            if (!reportStatus) {
                logger.error('reportStatus is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "reportStatus is required" })
            } else if (reportStatus !== ReportStatus.Rejected && reportStatus !== ReportStatus.Resolved) {
                logger.error(`reportStatus is unsupported for status: ${reportStatus}`)
                return res.status(HTTP.StatusBadRequest).send({ error: `reportStatus is unsupported for status: ${reportStatus}` })
            }

            const report = await this.reportService.getReportSrv(reportUUID)
            if (!report || !report.reportUUID) {
                logger.error('reportUUID is not found')
                return res.status(HTTP.StatusNotFound).send({ error: "reportUUID is not found" })
            }

            if (report.reportStatus !== ReportStatus.Pending) {
                logger.error(`unable to update report status: expect "pending", but get ${report.reportStatus}`)
                return res.status(HTTP.StatusBadRequest).send({ error: `unable to update report status: expect: 'pending', but get: '${report.reportStatus}'` })
            }

            report.reportStatus = reportStatus
            await this.reportService.updateReportStatusSrv(report)

            if (reportStatus === ReportStatus.Resolved) {
                let noti!: Notification;
                if (report.commentUUID) {
                    await this.commentService.deleteCommentSrv(report.commentUUID)
                    this.forumSocket.deleteComment(profile.sessionUUID, report.forumUUID, report.commentUUID, report.replyCommentUUID)

                    noti = {forumUUID: report.forumUUID, commentUUID: report.commentUUID, replyCommentUUID: report.replyCommentUUID} as any

                } else {
                    await this.forumService.deleteForumSrv(report.forumUUID)
                    await this.commentService.deleteCommentsByForumUUIDSrv(report.forumUUID)
                    this.forumSocket.deleteForum(profile.sessionUUID, report.forumUUID)

                    noti = {forumUUID: report.forumUUID} as any
                }

                if (noti) {
                    const notifications = await this.notificationService.getNotificationsSrv(noti)
                    this.notificationService.createUpdateDeleteNotificationSrv(noti, 'remove')
                    if (notifications) {
                        for(const noti of notifications) {
                            this.notificationSocket.refreshNotification(noti.userUUID)
                        }
                    }
                }

                // sendgrid send email
            }

            logger.info("End http.admin.updateReportStatus")
            return res.status(HTTP.StatusOK).send({ message: "success" });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async deleteReport(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.deleteReport")
        try {

            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const reportUUIDs = req.body.reportUUIDs as string[]
            if (!reportUUIDs) {
                logger.error('reportUUIDs is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "reportUUIDs is required" })
            }

            for (const reportUUID of reportUUIDs) {
                await this.reportService.deleteReportSrv({reportUUID} as any)
            }

            logger.info("End http.admin.deleteReport")
            return res.status(HTTP.StatusOK).send({ message: "success" });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}