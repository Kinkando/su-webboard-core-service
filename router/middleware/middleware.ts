import HTTP from '../../common/http';
import { AccessToken, Profile } from '../../model/authen';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface CustomRequest extends Request {
    profile: Profile
}

export function useJWT(jwtSecretKey: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.url.startsWith('/authen') && req.url !== '/_health') {
            try {
                const bearerToken = req.headers.authorization
                if (!bearerToken || !bearerToken.startsWith('Bearer ')) {
                    throw Error('token contains an invalid number of segments')
                }

                const token = bearerToken!.split(" ")[1]
                jwt.verify(token!, jwtSecretKey, { algorithms: ['HS256'] })
                const jwtDecode = jwt.decode(token!) as AccessToken
                if (!jwtDecode || jwtDecode.type !== 'access') {
                    throw Error('invalid access token')
                }

                (req as CustomRequest).profile = {
                    userUUID: jwtDecode.userUUID,
                    userType: jwtDecode.userType,
                }
            } catch (error) {
                return res.status(HTTP.StatusUnauthorized).send({ error: `invalid JWT token: `+(error as Error).message })
            }
        }
        next();
    }
}