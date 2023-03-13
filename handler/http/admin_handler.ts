import { NextFunction, Request, Response, Router } from 'express';
import { CloudStorage } from '@cloud/google/storage';
import HTTP from '@common/http';
import { UserType } from '@model/authen';
import { AdminService } from "@service/admin_service";
import logger from '@util/logger';
import { getProfile } from '@util/profile';
import { User } from '@model/user';
import { validate } from '@util/validate';
import { AuthenService } from '@service/authen_service';

export function newAdminHandler(adminService: AdminService) {
    const adminHandler = new AdminHandler(adminService)

    const router = Router()
    router.use('/user', router)
    router.get('', (req, res, next) => adminHandler.getUsers(req, res, next));
    router.post('/:userType', (req, res, next) => adminHandler.createUser(req, res, next));

    return router
}

interface Handler {
    getUsers(req: Request, res: Response, next: NextFunction): any
    createUser(req: Request, res: Response, next: NextFunction): any
}

class AdminHandler implements Handler {
    constructor(private adminService: AdminService) {}

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
            const users = await this.adminService.getUsers(filter.search, filter.limit, filter.offset)
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

            const isExistEmail = await this.adminService.isExistEmail(user.userEmail!)
            if (isExistEmail) {
                logger.error(`email: ${user.userEmail!} is exist`)
                return res.status(HTTP.StatusBadRequest).send({ error: `email: ${user.userEmail!} is exist` })
            }

            await this.adminService.createUser(user)

            logger.info("End http.admin.createUser")
            return res.status(HTTP.StatusCreated).send();

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}