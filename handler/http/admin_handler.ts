import { NextFunction, Request, Response, Router } from 'express';
import HTTP from '../../common/http';
import { ForumSocket } from '../../handler/socket/forum_socket';
import { NotificationSocket } from '../../handler/socket/notification_socket';
import { UserType } from '../../model/authen';
import { Category } from '../../model/category';
import { Pagination } from '../../model/common';
import { User, UserPagination } from '../../model/user';
import { AnnouncementService } from '../../service/announcement_service';
import { AuthenService } from '../../service/authen_service';
import { CategoryService } from '../../service/category_service';
import { CommentService } from '../../service/comment_service';
import { ForumService } from '../../service/forum_service';
import { UserService } from '../../service/user_service';
import logger from '../../util/logger';
import { getProfile } from '../../util/profile';
import { bind, validate } from '../../util/validate';
import { NotificationService } from '../../service/notification_service';

export function newAdminHandler(
    announcementService: AnnouncementService,
    authenService: AuthenService,
    categoryService: CategoryService,
    commentService: CommentService,
    forumService: ForumService,
    userService: UserService,
    notificationService: NotificationService,
    forumSocket: ForumSocket,
    notificationSocket: NotificationSocket,
) {
    const adminHandler = new AdminHandler(
        announcementService,
        authenService,
        categoryService,
        commentService,
        forumService,
        userService,
        notificationService,
        forumSocket,
        notificationSocket,
    )

    const adminRouter = Router()

    adminRouter.post('/user/revoke', (req, res, next) => adminHandler.revokeUsers(req, res, next))
    adminRouter.get('/user', (req, res, next) => adminHandler.getUsers(req, res, next))
    adminRouter.post('/user/:userType', (req, res, next) => adminHandler.createUser(req, res, next))
    adminRouter.patch('/user', (req, res, next) => adminHandler.updateUser(req, res, next))
    adminRouter.delete('/user', (req, res, next) => adminHandler.deleteUser(req, res, next))

    adminRouter.get('/category', (req, res, next) => adminHandler.getCategories(req, res, next))
    adminRouter.put('/category', (req, res, next) => adminHandler.upsertCategory(req, res, next))
    adminRouter.delete('/category', (req, res, next) => adminHandler.deleteCategory(req, res, next))

    return adminRouter
}

class AdminHandler {
    constructor(
        private announcementService: AnnouncementService,
        private authenService: AuthenService,
        private categoryService: CategoryService,
        private commentService: CommentService,
        private forumService: ForumService,
        private userService: UserService,
        private notificationService: NotificationService,
        private forumSocket: ForumSocket,
        private notificationSocket: NotificationSocket,
    ) {}

    async revokeUsers(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.revokeUsers")

        try {
            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            if (req.body?.userUUIDs) {
                await this.authenService.revokeTokensByAdminSrv(req.body?.userUUIDs)
            }

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
            }
            if (filter.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusBadRequest).send({ error: "permission is denied" })
            }
            const users = await this.userService.getUsersSrv(filter)
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

            for(const userUUID of userUUIDs) {
                await this.authenService.revokeTokensByAdminSrv(req.body?.userUUIDs)

                await this.userService.deleteUserSrv(userUUID)
                const forums = await this.forumService.getForumsSrv({ authorUUID: userUUID })
                if (forums) {
                    for(const forum of forums) {
                        await this.forumService.deleteForumSrv(forum.forumUUID!)
                        await this.commentService.deleteCommentsByForumUUIDSrv(forum.forumUUID!)
                        this.forumSocket.deleteForum(profile.sessionUUID, forum.forumUUID!)
                    }
                }
                const comments = await this.commentService.getCommentsSrv({ commenterUUID: userUUID })
                if (comments) {
                    for (const comment of comments) {
                        await this.commentService.deleteCommentSrv(comment.commentUUID!)
                        this.forumSocket.deleteComment(profile.sessionUUID, comment.forumUUID, comment.commentUUID!, comment.replyCommentUUID)
                    }
                }
                const announcements = await this.announcementService.getAnnouncementsByAuthorUUIDSrv(userUUID)
                if (announcements) {
                    for (const announcement of announcements) {
                        await this.announcementService.deleteAnnouncementSrv(announcement.announcementUUID!)
                    }
                }

                const likeForums = await this.forumService.getForumsSrv({ likeUserUUID: userUUID })
                await this.forumService.pullFavoriteAndLikeUserUUIDFromForumSrv(userUUID)
                if (likeForums) {
                    for (const forum of likeForums) {
                        this.forumSocket.updateForum(profile.sessionUUID, forum.forumUUID!)
                    }
                }
                const likeComments = await this.commentService.getCommentsSrv({ likeUserUUID: userUUID })
                await this.commentService.pullLikeUserUUIDFromCommentSrv(userUUID)
                if (likeComments) {
                    for (const comment of likeComments) {
                        this.forumSocket.updateComment(profile.sessionUUID, comment.forumUUID!, comment.commentUUID!, comment.replyCommentUUID)
                    }
                }
                await this.announcementService.pullSeeCountUUIDFromAnnouncementSrv(userUUID)
                // delete all noti and update report status invalid
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
            ]

            try {
                validate(schemas, req.query)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const filter: Pagination = {
                search: req.query.search?.toString() || "",
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

            for (const categoryID of categoryIDs) {
                const forums = await this.forumService.getForumsSrv({ categoryID })
                if (forums) {
                    for(const forum of forums) {
                        if (forum.categoryIDs.length == 1 && forum.categoryIDs[0] === categoryID) {
                            await this.forumService.deleteForumSrv(forum.forumUUID!)
                            await this.commentService.deleteCommentsByForumUUIDSrv(forum.forumUUID!)
                            this.forumSocket.deleteForum(profile.sessionUUID, forum.forumUUID!)
                        } else {
                            await this.forumService.deleteCategoryIDToForumSrv(forum.forumUUID!, categoryID)
                        }
                    }
                }
                await this.categoryService.deleteCategorySrv(categoryID)
            }


            logger.info("End http.admin.deleteCategory")
            return res.status(HTTP.StatusOK).send({ message: "success" });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}