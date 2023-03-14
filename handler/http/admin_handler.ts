import { NextFunction, Request, Response, Router } from 'express';
import HTTP from '@common/http';
import { UserType } from '@model/authen';
import logger from '@util/logger';
import { getProfile } from '@util/profile';
import { User, UserPagination } from '@model/user';
import { bind, validate } from '@util/validate';
import { UserService } from '@service/user_service';
import { CategoryService } from '@service/category_service';
import { Category } from '@model/category';

export function newAdminHandler(userService: UserService, categoryService: CategoryService) {
    const adminHandler = new AdminHandler(userService, categoryService)

    const adminRouter = Router()

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
    constructor(private userService: UserService, private categoryService: CategoryService) {}

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
            if (!users || !users.total || !users.data) {
                logger.error('users are not found')
                return res.status(HTTP.StatusNoContent).send()
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
                userFullName: req.body.userFullName,
                userEmail: req.body.userEmail,
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
                {field: "isAnonymous", type: "boolean", required: false},
            ]

            try {
                validate(schemas, req.body)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const user: User = bind(req.body, schemas)

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

            const userUUID = req.body.userUUID
            if (!userUUID) {
                logger.error('userUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: 'userUUID is required' })
            }

            await this.userService.deleteUserSrv(userUUID)

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

            const filter: UserPagination = {
                search: req.query.search?.toString() || "",
                limit: Number(req.query.limit) || 10,
                offset: Number(req.query.offset) || 0,
            }

            const data = await this.categoryService.getCategoriesPaginationSrv(filter.limit, filter.offset, filter.search)

            logger.info("End http.admin.getCategories")
            return res.status(data ? HTTP.StatusOK : HTTP.StatusNoContent).send(data);

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

            await this.categoryService.upsertCategorySrv(category)

            logger.info("End http.admin.upsertCategory")
            return res.status(HTTP.StatusOK).send({ message: "success" });

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

            if (!req.body.categoryID) {
                logger.error('categoryID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "categoryID is required" })
            }

            await this.categoryService.deleteCategorySrv(req.body.categoryID)

            logger.info("End http.admin.deleteCategory")
            return res.status(HTTP.StatusOK).send({ message: "success" });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}