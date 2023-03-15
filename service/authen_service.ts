import * as admin from 'firebase-admin';
import {v4 as uuidv4} from 'uuid';
import jwt, { Secret } from 'jsonwebtoken';
import { AccessToken, RefreshToken, UserType } from "../model/authen";
import logger from "../util/logger";
import { CacheRepository } from '../repository/redis/catche_repository';
import { AppConfiguration } from '../config/config';

export function newAuthenService(appConfig: AppConfiguration, firebase: admin.app.App, cacheRepository: CacheRepository) {
    return new AuthenService(appConfig, firebase, cacheRepository)
}

interface Service {
    verifyFirebaseTokenSrv(idToken: string): Promise<string | undefined>
    encodeJWTSrv(userUUID: string, userType: string): { accessToken: string, refreshToken: string }
    decodeJWTSrv(token: string, type: 'access' | 'refresh'): AccessToken | RefreshToken
    createTokenSrv(token: string, type: 'access' | 'refresh'): void
    revokeTokenSrv(token: string, type: 'access' | 'refresh'): void
}

export class AuthenService implements Service {
    constructor(
        private appConfig: AppConfiguration,
        private firebase: admin.app.App,
        private cacheRepository: CacheRepository,
    ) {}

    async verifyFirebaseTokenSrv(idToken: string) {
        logger.info("Start service.authen.verifyFirebaseTokenSrv", idToken)

        try {
            const client = this.firebase.auth()
            const token = await client.verifyIdToken(idToken)
            if (!token) {
                throw new Error("idToken is invalid")
            }
            logger.info("End service.authen.verifyFirebaseTokenSrv", token.uid)
            return token.uid

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
}