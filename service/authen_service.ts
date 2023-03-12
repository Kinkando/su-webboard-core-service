import * as admin from 'firebase-admin';
import {v4 as uuidv4} from 'uuid';
import jwt, { Secret, JwtPayload } from 'jsonwebtoken';
import { AccessToken, RefreshToken } from "@model/authen";
import logger from "@util/logger";

export function newAuthenService(jwtSecretKey: string, firebase: admin.app.App) {
    return new AuthenService(jwtSecretKey as Secret, firebase)
}

interface Service {
    verifyToken(idToken: string): Promise<string | undefined>
    genJWT(userUUID: string, userType: string): { accessToken: string, refreshToken: string }
}

export class AuthenService implements Service {
    constructor(private jwtSecretKey: Secret, private firebase: admin.app.App) {}

    async verifyToken(idToken: string) {
        logger.info("Start service.authen.verifyToken", idToken)

        try {
            const client = this.firebase.auth()
            const token = await client.verifyIdToken(idToken)
            if (!token) {
                throw new Error("idToken is invalid")
            }
            logger.info("End service.authen.verifyToken", token.uid)
            return token.uid

        } catch (error) {
            logger.error(error)
            throw new Error(error as string)
        }
    }

    genJWT(userUUID: string, userType: string): { accessToken: string, refreshToken: string } {
        logger.info("Start service.authen.genJWT")

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

        logger.info("Start service.authen.genJWT", accessToken, refreshToken)
        return { accessToken, refreshToken }
    }
}