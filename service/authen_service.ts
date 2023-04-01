import { Auth } from 'firebase-admin/lib/auth/auth';
import {v4 as uuidv4} from 'uuid';
import jwt, { Secret } from 'jsonwebtoken';
import { AccessToken, RefreshToken, UserType } from "../model/authen";
import logger from "../util/logger";
import { CacheRepository } from '../repository/redis/cache_repository';
import { AppConfiguration } from '../config/config';

export function newAuthenService(appConfig: AppConfiguration, firebaseAuth: Auth, cacheRepository: CacheRepository) {
    return new AuthenService(appConfig, firebaseAuth, cacheRepository)
}

interface Service {
    verifyFirebaseTokenSrv(idToken: string): Promise<{uid: string, email: string} | undefined>
    encodeJWTSrv(userUUID: string, userType: string): { accessToken: string, refreshToken: string }
    decodeJWTSrv(token: string, type: 'access' | 'refresh'): AccessToken | RefreshToken
    createTokenSrv(token: string, type: 'access' | 'refresh'): void
    revokeTokenSrv(token: string, type: 'access' | 'refresh'): void
    revokeExpiredTokensSrv(): void
    revokeTokensByAdminSrv(userUUIDs: string[]): void
    isExistToken(jwt: AccessToken | RefreshToken): Promise<boolean>
}

export class AuthenService implements Service {
    constructor(
        private appConfig: AppConfiguration,
        private firebaseAuth: Auth,
        private cacheRepository: CacheRepository,
    ) {}

    async verifyFirebaseTokenSrv(idToken: string) {
        logger.info(`Start service.authen.verifyFirebaseTokenSrv, "input": ${JSON.stringify({idToken})}`)

        try {
            const token = await this.firebaseAuth.verifyIdToken(idToken)
            if (!token) {
                throw new Error("idToken is invalid")
            }
            const res = { uid: token.uid, email: token.email! }

            logger.info(`End service.authen.verifyFirebaseTokenSrv, "output": ${JSON.stringify(res)}`)
            return res

        } catch (error) {
            logger.error(error)
            throw new Error(error as string)
        }
    }

    encodeJWTSrv(userUUID: string, userType: UserType): { accessToken: string, refreshToken: string } {
        logger.info(`Start service.authen.encodeJWTSrv, "input": ${JSON.stringify({ userUUID, userType })}`)

        const accessJWT: AccessToken = {
            userType,
            userUUID,
            sessionUUID: uuidv4(),
            type: 'access',
        }
        const refreshJWT: RefreshToken = {
            userType,
            userUUID,
            sessionUUID: uuidv4(),
            type: 'refresh',
        }

        const accessToken = jwt.sign(accessJWT, this.appConfig.jwtSecretKey, {
            algorithm: 'HS256',
            expiresIn: this.appConfig.jwtAccessExpire,
        })
        const refreshToken = jwt.sign(refreshJWT, this.appConfig.jwtSecretKey, {
            algorithm: 'HS256',
            expiresIn: this.appConfig.jwtRefreshExpire,
        })

        logger.info(`End service.authen.encodeJWTSrv, "output": ${JSON.stringify({ accessToken, refreshToken })}`)
        return { accessToken, refreshToken }
    }

    decodeJWTSrv(token: string, type: 'access' | 'refresh'): AccessToken | RefreshToken {
        logger.info(`Start service.authen.decodeJWTSrv, "input": ${JSON.stringify({ token, type })}`)

        jwt.verify(token, this.appConfig.jwtSecretKey, { algorithms: ['HS256'] })

        let jsonWebToken: AccessToken | RefreshToken
        if (type === 'access') {
            jsonWebToken = jwt.decode(token) as AccessToken
        } else {
            jsonWebToken = jwt.decode(token) as RefreshToken
        }

        logger.info(`End service.authen.decodeJWTSrv, "output": ${JSON.stringify(jsonWebToken)}`)
        return jsonWebToken
    }

    async createTokenSrv(token: string, type: 'access' | 'refresh') {
        logger.info(`Start service.authen.createTokenSrv, "input": ${JSON.stringify({ token })}`)

        try {
            const jwtClaim = this.decodeJWTSrv(token, type)
            if (type === 'access') {
                await this.cacheRepository.createAccessTokenRepo(jwtClaim as AccessToken)
            } else {
                await this.cacheRepository.createRefreshTokenRepo(jwtClaim as RefreshToken)
            }

        } catch (error) {
            logger.error(error)
        }

        logger.info(`End service.authen.createTokenSrv`)
    }

    async revokeTokenSrv(token: string, type: 'access' | 'refresh') {
        logger.info(`Start service.authen.revokeTokenSrv, "input": ${JSON.stringify({ token, type })}`)

        try {
            const jwtClaim = this.decodeJWTSrv(token, type)
            if (type === 'access') {
                await this.cacheRepository.revokeAccessTokenRepo(jwtClaim as AccessToken)
            } else {
                await this.cacheRepository.revokeRefreshTokenRepo(jwtClaim as RefreshToken)
            }

        } catch (error) {
            logger.error(error)
        }

        logger.info(`End service.authen.revokeTokenSrv`)
    }

    async revokeExpiredTokensSrv() {
        logger.info(`Start service.authen.revokeExpiredTokensSrv`)

        try {
            await this.cacheRepository.revokeExpiredTokensRepo()
        } catch (error) {
            logger.error(error)
        }

        logger.info(`End service.authen.revokeExpiredTokensSrv`)
    }

    async revokeTokensByAdminSrv(userUUIDs: string[]) {
        logger.info(`Start service.authen.revokeTokensByAdminSrv, "input": ${JSON.stringify(userUUIDs)}`)

        try {
            for (const userUUID of userUUIDs) {
                logger.warn(`revoke token by userUUID: ${userUUID}, success: ${await this.cacheRepository.revokeTokenRepo(userUUID)} token(s)`)
            }
        } catch (error) {
            logger.error(error)
        }

        logger.info(`End service.authen.revokeTokensByAdminSrv`)
    }

    async isExistToken(jwt: AccessToken | RefreshToken) {
        logger.info(`Start service.authen.isExistToken, "input": ${JSON.stringify({ jwt })}`)

        const isExist = await this.cacheRepository.isExistToken(jwt)

        logger.info(`End service.authen.isExistToken, "output": ${JSON.stringify({ isExist })}`)
        return isExist
    }
}