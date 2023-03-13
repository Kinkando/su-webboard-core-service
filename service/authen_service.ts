import * as admin from 'firebase-admin';
import {v4 as uuidv4} from 'uuid';
import jwt, { Secret } from 'jsonwebtoken';
import { AccessToken, RefreshToken, UserType } from "@model/authen";
import logger from "@util/logger";

export function newAuthenService(jwtSecretKey: string, firebase: admin.app.App) {
    return new AuthenService(jwtSecretKey as Secret, firebase)
}

interface Service {
    verifyFirebaseToken(idToken: string): Promise<string | undefined>
    encodeJWT(userUUID: string, userType: string): { accessToken: string, refreshToken: string }
    decodeJWT(token: string, type: 'access' | 'refresh'): AccessToken | RefreshToken
}

export class AuthenService implements Service {
    constructor(
        private jwtSecretKey: Secret,
        private firebase: admin.app.App,
    ) {}

    async verifyFirebaseToken(idToken: string) {
        logger.info("Start service.authen.verifyFirebaseToken", idToken)

        try {
            const client = this.firebase.auth()
            const token = await client.verifyIdToken(idToken)
            if (!token) {
                throw new Error("idToken is invalid")
            }
            logger.info("End service.authen.verifyFirebaseToken", token.uid)
            return token.uid

        } catch (error) {
            logger.error(error)
            throw new Error(error as string)
        }
    }

    encodeJWT(userUUID: string, userType: UserType): { accessToken: string, refreshToken: string } {
        logger.info(`Start service.authen.encodeJWT, "input": {"userUUID": "%s", "userType": "%s"}`, userUUID, userType)

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

        logger.info(`End service.authen.encodeJWT, "output": {"accessToken": "%s", "refreshToken": "%s"}`, accessToken, refreshToken)
        return { accessToken, refreshToken }
    }

    decodeJWT(token: string, type: 'access' | 'refresh'): AccessToken | RefreshToken {
        logger.info(`Start service.authen.decodeJWT, "input": {"token": "%s", "type": "%s"}`, token, type)

        jwt.verify(token, this.jwtSecretKey, { algorithms: ['HS256'] })

        let jsonWebToken: AccessToken | RefreshToken
        if (type === 'access') {
            jsonWebToken = jwt.decode(token) as AccessToken
        } else {
            jsonWebToken = jwt.decode(token) as RefreshToken
        }

        logger.info(`End service.authen.decodeJWT, "output": %s`, JSON.stringify(jsonWebToken))
        return jsonWebToken
    }
}