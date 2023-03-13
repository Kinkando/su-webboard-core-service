import { NextFunction, Request, Response, Router } from 'express';
import HTTP from '@common/http';
import { AuthenService } from "@service/authen_service";
import { UserService } from '@service/user_service';
import logger from '@util/logger';

export function newAuthenHandler(apiKey: string, authenService: AuthenService, userService: UserService) {
    const authenHandler = new AuthenHandler(apiKey, authenService, userService)

    const router = Router()
    router.use('/token', router)
    router.post('/verify', (req, res, next) => authenHandler.verifyToken(req, res, next));
    router.post('/refresh', (req, res, next) => authenHandler.refreshToken(req, res, next));

    return router
}

interface Handler {
    verifyToken(req: Request, res: Response, next: NextFunction): any
    refreshToken(req: Request, res: Response, next: NextFunction): any
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
            const firebaseID = await this.authenService.verifyFirebaseToken(idToken)
            const user = await this.userService.getUser({ firebaseID })
            if (!user) {
                throw Error("user not found")
            }

            const jwt = this.authenService.encodeJWT(user.userUUID!, user.userType!)

            logger.info("End http.authen.verifyToken")
            return res.status(HTTP.StatusOK).send(jwt)

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusUnauthorized).send({ error: (error as Error).message })
        }
    }

    async refreshToken(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.authen.refreshToken")

        try {
            const refreshToken = req.body.refreshToken!
            if (!refreshToken) {
                return res.status(HTTP.StatusBadRequest).send({ error: "refreshToken is required" })
            }

            const jwtDecode = this.authenService.decodeJWT(refreshToken, 'refresh')
            if (!jwtDecode || jwtDecode.type !== 'refresh') {
                throw Error('accept only refreshToken')
            }

            const jwt = this.authenService.encodeJWT(jwtDecode.userUUID, jwtDecode.userType)

            logger.info("End http.authen.verifyToken")
            return res.status(HTTP.StatusOK).send(jwt)

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusUnauthorized).send({ error: (error as Error).message })
        }
    }
}