import { Application, NextFunction, Request, Response } from 'express';
import { UserService } from "@service/user_service";
import HTTP from '@common/http';
import logger from '@util/logger';

export function newUserHandler(app: Application, userService: UserService) {
    const userHandler = new UserHandler(userService)
    app.get('/user', (req, res, next) => userHandler.getUser(req, res, next));
}

interface Handler {
    getUser(req: Request, res: Response, next: NextFunction): any
}

class UserHandler implements Handler {
    constructor(private userService: UserService) {}

    async getUser(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.getUser")

        logger.info("End http.user.getUser")
        res.status(HTTP.StatusOK).send({});
    }
}