import { NextFunction, Request, Response, Router } from 'express';
import { CloudStorage } from '@cloud/google/storage';
import HTTP from '@common/http';
import { AdminService } from "@service/admin_service";
import logger from '@util/logger';
import { getProfile } from '@util/profile';

export function newAdminHandler(adminService: AdminService, storage: CloudStorage) {
    const adminHandler = new AdminHandler(adminService, storage)

    const router = Router()
    router.use('/user', router)
    router.get('', (req, res, next) => adminHandler.getUsers(req, res, next));

    return router
}

interface Handler {
    getUsers(req: Request, res: Response, next: NextFunction): any
}

class AdminHandler implements Handler {
    constructor(private adminService: AdminService, private storage: CloudStorage) {}

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
}