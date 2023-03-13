import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer'
import { CloudStorage } from '@cloud/google/storage';
import HTTP from '@common/http';
import { User } from '@model/user';
import { UserService } from "@service/user_service";
import logger from '@util/logger';
import { getProfile } from '@util/profile';
const upload = multer()

export function newUserHandler(userService: UserService, storage: CloudStorage) {
    const userHandler = new UserHandler(userService, storage)

    const router = Router()
    router.use('/profile', router)
    router.get('', (req, res, next) => userHandler.getProfile(req, res, next));
    router.patch('', upload.array("file"), (req, res, next) => userHandler.updateProfile(req, res, next))

    return router
}

interface Handler {
    getProfile(req: Request, res: Response, next: NextFunction): any
}

class UserHandler implements Handler {
    constructor(private userService: UserService, private storage: CloudStorage) {}

    async getProfile(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.getProfile")

        try {
            const profile = getProfile(req)
            const user = await this.userService.getUser({ userUUID: profile.userUUID })
            if (!user) {
                throw Error("user not found")
            }

            logger.info("End http.user.getProfile")
            return res.status(HTTP.StatusOK).send(user);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async updateProfile(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.updateProfile")

        try {
            const profile = getProfile(req)
            if (req.files && req.files.length > 1) {
                return res.status(HTTP.StatusBadRequest).send({ error: "file is limit at 1" })
            }
            const data = JSON.parse(req.body.data);
            let user: User = {userUUID: profile.userUUID}
            if (data.userDisplayName && typeof data.userDisplayName === 'string') {
                user.userDisplayName = data.userDisplayName
            }
            if (data.isAnonymous && typeof data.isAnonymous === 'boolean') {
                user.isAnonymous = data.isAnonymous
            }
            await this.userService.updateUser(user)

            logger.info("End http.user.updateProfile")
            return res.status(HTTP.StatusCreated).send();

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}