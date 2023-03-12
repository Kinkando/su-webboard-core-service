import { Application, NextFunction, Request, Response } from 'express';
import HTTP from '@common/http';
import { AuthenService } from "@service/authen_service";
import { UserService } from '@service/user_service';
import logger from '@util/logger';

export function newAuthenHandler(app: Application, apiKey: string, authenService: AuthenService, userService: UserService) {
    const authenHandler = new AuthenHandler(apiKey, authenService, userService)
    app.post('/authen/token/verify', (req, res, next) => authenHandler.verifyToken(req, res, next));
}

interface Handler {
    verifyToken(req: Request, res: Response, next: NextFunction): any
}

class AuthenHandler implements Handler {
    constructor(
        private apiKey: string,
        private authenService: AuthenService,
        private userService: UserService,
    ) {}

    async verifyToken(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.authen.verifyToken")

        try {
            const apiKey = req.get('X-Api-Key')
            if (apiKey !== this.apiKey) {
                throw new Error("apiKey is invalid")
            }
            const idToken = req.body.idToken!
            const firebaseID = await this.authenService.verifyToken(idToken)
            const user = await this.userService.getUser({ firebaseID })
            if (!user) {
                throw Error("user not found")
            }

            const jwt = this.authenService.genJWT(user.userUUID, user.userType)

            logger.info("End http.authen.verifyToken")
            return res.status(HTTP.StatusOK).send(jwt)

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusUnauthorized).send({ error: (error as Error).message })
        }
    }
}