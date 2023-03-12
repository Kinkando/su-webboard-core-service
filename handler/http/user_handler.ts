import { Application, NextFunction, Request, Response } from 'express';
import { UserService } from "@service/user_service";
import HTTP from '@common/http';
import logger from '@util/logger';
import { getProfile } from '@util/profile';

export function newUserHandler(app: Application, userService: UserService) {
    const userHandler = new UserHandler(userService)
    app.get('/user/profile', (req, res, next) => userHandler.getProfile(req, res, next));
}

interface Handler {
    getProfile(req: Request, res: Response, next: NextFunction): any
}

class UserHandler implements Handler {
    constructor(private userService: UserService) {}

    async getProfile(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.getProfile")

        try {
            const profile = getProfile(req)
            const user = await this.userService.getUser({ userUUID: profile.userUUID })
            if (!user) {
                throw Error("user not found")
            }

            logger.info("End http.user.getProfile")
            res.status(HTTP.StatusOK).send(user);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusUnauthorized).send({ error: (error as Error).message })
        }
    }
}