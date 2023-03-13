import { NextFunction, Request, Response, Router } from 'express';
import HTTP from '@common/http';
import { UserType } from '@model/authen';
import logger from '@util/logger';
import { getProfile } from '@util/profile';
import { User } from '@model/user';
import { bind, validate } from '@util/validate';
import { UserService } from '@service/user_service';

export function newAdminHandler(userService: UserService) {
    const adminHandler = new AdminHandler(userService)

    const adminRouter = Router()

    const userRouter = adminRouter.use('/user', adminRouter)
    userRouter.get('', (req, res, next) => adminHandler.getUsers(req, res, next))
    userRouter.post('/:userType', (req, res, next) => adminHandler.createUser(req, res, next))
    userRouter.patch('', (req, res, next) => adminHandler.updateUser(req, res, next))
    userRouter.delete('', (req, res, next) => adminHandler.deleteUser(req, res, next))

    const categoryRouter = adminRouter.use('/category', adminRouter)

    return adminRouter
}

class AdminHandler {
    constructor(private userService: UserService) {}

    async getUsers(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.admin.getUsers")

        try {
            const profile = getProfile(req)
            if (profile.userType !== 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const filter = {
                search: req.query.search?.toString() || "",
                limit: Number(req.query.limit) || 10,
                offset: Number(req.query.offset) || 0,
            }
            const users = await this.userService.getUsers(filter.search, filter.limit, filter.offset)
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

            const isExistEmail = await this.userService.isExistEmail(user.userEmail!)
            if (isExistEmail) {
                logger.error(`email: ${user.userEmail!} is exist`)
                return res.status(HTTP.StatusBadRequest).send({ error: `email: ${user.userEmail!} is exist` })
            }

            await this.userService.createUser(user)

            logger.info("End http.admin.createUser")
            return res.status(HTTP.StatusCreated).send();

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

            await this.userService.updateUser(user)

            logger.info("End http.admin.updateUser")
            return res.status(HTTP.StatusOK).send({ message: "success" });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
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

            await this.userService.deleteUser(userUUID)

            logger.info("End http.admin.deleteUser")
            return res.status(HTTP.StatusOK).send({ message: "success" });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}