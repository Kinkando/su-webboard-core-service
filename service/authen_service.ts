import * as admin from 'firebase-admin';
import {v4 as uuidv4} from 'uuid';
import jwt, { Secret } from 'jsonwebtoken';
import { AccessToken, RefreshToken, UserType } from "../model/authen";
import logger from "../util/logger";

export function newAuthenService(jwtSecretKey: string, firebase: admin.app.App) {
    return new AuthenService(jwtSecretKey as Secret, firebase)
}

interface Service {
    verifyFirebaseTokenSrv(idToken: string): Promise<string | undefined>
    encodeJWTSrv(userUUID: string, userType: string): { accessToken: string, refreshToken: string }
    decodeJWTSrv(token: string, type: 'access' | 'refresh'): AccessToken | RefreshToken
}

export class AuthenService implements Service {
    constructor(
        private jwtSecretKey: Secret,
        private firebase: admin.app.App,
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

        const accessToken = jwt.sign(accessJWT, this.jwtSecretKey, {
            algorithm: 'HS256',
            expiresIn: '24h',
        })
        const refreshToken = jwt.sign(refreshJWT, this.jwtSecretKey, {
            algorithm: 'HS256',
            expiresIn: '7d',
        })

        logger.info(`End service.authen.encodeJWTSrv, "output": ${JSON.stringify({ accessToken, refreshToken })}`)
        return { accessToken, refreshToken }
    }

    decodeJWTSrv(token: string, type: 'access' | 'refresh'): AccessToken | RefreshToken {
        logger.info(`Start service.authen.decodeJWTSrv, "input": ${JSON.stringify({ token, type })}`)

        jwt.verify(token, this.jwtSecretKey, { algorithms: ['HS256'] })

        let jsonWebToken: AccessToken | RefreshToken
        if (type === 'access') {
            jsonWebToken = jwt.decode(token) as AccessToken
        } else {
            jsonWebToken = jwt.decode(token) as RefreshToken
        }

        logger.info(`End service.authen.decodeJWTSrv, "output": ${JSON.stringify(jsonWebToken)}`)
        return jsonWebToken
    }
}