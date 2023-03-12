import { Application, NextFunction, Request, Response } from 'express';
import { UserService } from "@service/user_service";
import HTTP from '@common/http';
import logger from '@util/logger';

export function newUserHandler(app: Application, userService: UserService) {
    const userHandler = new UserHandler(userService)
    app.get('/', (req, res, next) => userHandler.getUser(req, res, next));
}

interface UserHdl {
    getUser(req: Request, res: Response, next: NextFunction): any
}

class UserHandler implements UserHdl {
    constructor(private userService: UserService) {}

    async getUser(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.getUser")

        const user = await this.userService.getUser()

        logger.info("End http.getUser", JSON.stringify(user))
        res.status(HTTP.StatusOK).send(user);
    }
}