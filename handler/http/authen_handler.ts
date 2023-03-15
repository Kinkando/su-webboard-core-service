import { getProfile } from '../../util/profile';
import { NextFunction, Request, Response, Router } from 'express';
import HTTP from '../../common/http';
import { AuthenService } from "../../service/authen_service";
import { UserService } from '../../service/user_service';
import logger from '../../util/logger';

export function newAuthenHandler(apiKey: string, authenService: AuthenService, userService: UserService) {
    const authenHandler = new AuthenHandler(apiKey, authenService, userService)

    const authRouter = Router()
    authRouter.post('/reset-password', (req, res, next) => authenHandler.resetPassword(req, res, next))

    const tokenRouter = authRouter.use('/token', authRouter)
    tokenRouter.post('/verify', (req, res, next) => authenHandler.verifyToken(req, res, next))
    tokenRouter.post('/refresh', (req, res, next) => authenHandler.refreshToken(req, res, next))
    tokenRouter.post('/revoke', (req, res, next) => authenHandler.revokeToken(req, res, next))
    tokenRouter.delete('/revoke', (req, res, next) => authenHandler.revokeExpiredTokens(req, res, next))

    return authRouter
}

class AuthenHandler {
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
            const firebaseID = await this.authenService.verifyFirebaseTokenSrv(idToken)
            const user = await this.userService.getUserSrv({ firebaseID })
            if (!user) {
                throw Error("user not found")
            }

            const jwt = this.authenService.encodeJWTSrv(user.userUUID!, user.userType!)

            await this.authenService.createTokenSrv(jwt.accessToken, 'access')
            await this.authenService.createTokenSrv(jwt.refreshToken, 'refresh')

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

            const jwtDecode = this.authenService.decodeJWTSrv(refreshToken, 'refresh')
            if (!jwtDecode || jwtDecode.type !== 'refresh') {
                throw Error('accept only refreshToken')
            }

            const jwt = this.authenService.encodeJWTSrv(jwtDecode.userUUID, jwtDecode.userType)

            await this.authenService.revokeTokenSrv(refreshToken, 'refresh')
            await this.authenService.createTokenSrv(jwt.accessToken, 'access')
            await this.authenService.createTokenSrv(jwt.refreshToken, 'refresh')

            logger.info("End http.authen.refreshToken")
            return res.status(HTTP.StatusOK).send(jwt)

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusUnauthorized).send({ error: (error as Error).message })
        }
    }

    async revokeToken(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.authen.revokeToken")

        try {
            const accessToken = req.body.accessToken!
            if (accessToken) {
                await this.authenService.revokeTokenSrv(accessToken, 'access')
            }

            const refreshToken = req.body.refreshToken!
            if (refreshToken) {
                await this.authenService.revokeTokenSrv(refreshToken, 'refresh')
            }

            logger.info("End http.authen.revokeToken")
            return res.status(HTTP.StatusOK).send({ message: "success" })

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusUnauthorized).send({ error: (error as Error).message })
        }
    }

    async revokeExpiredTokens(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.authen.revokeExpiredTokens")

        try {
            await this.authenService.revokeExpiredTokensSrv()

            logger.info("End http.authen.revokeExpiredTokens")
            return res.status(HTTP.StatusOK).send({ message: "success" })

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async resetPassword(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.authen.resetPassword")

        try {
            await this.userService.resetPasswordSrv("tokenID ???")

            logger.info("End http.authen.resetPassword")
            return res.status(HTTP.StatusOK).send({ message: "success" })

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusUnauthorized).send({ error: (error as Error).message })
        }
    }
}