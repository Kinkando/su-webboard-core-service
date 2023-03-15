import { NextFunction, Request, Response, Router } from 'express';
import HTTP from '../../common/http';
import { AuthenService } from "../../service/authen_service";
import { UserService } from '../../service/user_service';
import logger from '../../util/logger';
import { GoogleService } from '../../cloud/google/google';

export function newAuthenHandler(apiKey: string, googleService: GoogleService, authenService: AuthenService, userService: UserService) {
    const authenHandler = new AuthenHandler(apiKey, googleService, authenService, userService)

    const authRouter = Router()
    authRouter.post('/reset-password', (req, res, next) => authenHandler.resetPassword(req, res, next))

    const tokenRouter = authRouter.use('/token', authRouter)
    tokenRouter.post('/google', (req, res, next) => authenHandler.verifyGoogle(req, res, next))
    tokenRouter.post('/verify', (req, res, next) => authenHandler.verifyToken(req, res, next))
    tokenRouter.post('/refresh', (req, res, next) => authenHandler.refreshToken(req, res, next))
    tokenRouter.post('/revoke', (req, res, next) => authenHandler.revokeToken(req, res, next))
    tokenRouter.delete('/revoke', (req, res, next) => authenHandler.revokeExpiredTokens(req, res, next))

    return authRouter
}

class AuthenHandler {
    constructor(
        private apiKey: string,
        private googleService: GoogleService,
        private authenService: AuthenService,
        private userService: UserService,
    ) {}

    async verifyGoogle(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.authen.verifyGoogle")

        try {
            const apiKey = req.get('X-Api-Key')
            if (apiKey !== this.apiKey) {
                throw new Error("apiKey is invalid")
            }

            const accessToken = req.body.accessToken
            if (!accessToken) {
                throw new Error('accessToken is required')
            }

            const profile = await this.googleService.getUserProfile(accessToken)
            const user = await this.userService.getUserSrv({ userEmail: profile.email })
            if (!user) {
                throw Error("user not found")
            }

            await this.userService.updateUserSrv({
                userUUID: user.userUUID,
                isLinkGoogle: true,
                lastLogin: new Date(),
            })

            const jwt = this.authenService.encodeJWTSrv(user.userUUID!, user.userType!)

            await this.authenService.createTokenSrv(jwt.accessToken, 'access')
            await this.authenService.createTokenSrv(jwt.refreshToken, 'refresh')

            logger.info("End http.authen.verifyGoogle")
            return res.status(HTTP.StatusOK).send(jwt)

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusUnauthorized).send({ error: (error as Error).message })
        }
    }

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

            user.lastLogin = new Date()
            await this.userService.updateUserSrv(user)

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
            if (!jwtDecode || jwtDecode.type !== 'refresh' || !jwtDecode.exp) {
                throw Error('accept only refreshToken')
            }

            const now = Math.floor(new Date(jwtDecode.exp).getTime() / 1000)
            if (now > jwtDecode.exp) {
                throw Error('refreshToken is expired')
            }

            const isExist = await this.authenService.isExistToken(jwtDecode)
            if (!isExist) {
                throw Error('refreshToken is not found')
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