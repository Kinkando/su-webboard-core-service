import HTTP from '@common/http';
import { AccessToken } from '@model/authen';
import { Request, Response, NextFunction } from 'express';
import jwt, { Secret, JwtPayload } from 'jsonwebtoken';

export function useJWT(jwtSecretKey: string) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const bearerToken = req.headers.authorization
            if (!bearerToken || !bearerToken.startsWith('Bearer ')) {
                return res.status(HTTP.StatusUnauthorized).send({ error: 'invalid JWT token: token contains an invalid number of segments' })
            }

            const token = bearerToken!.split(" ")[1]

            jwt.verify(token!, jwtSecretKey, { algorithms: ['HS256'] })
            const jwtDecode = jwt.decode(token!) as AccessToken
            if (!jwtDecode || jwtDecode.type !== 'access') {
                return res.status(HTTP.StatusUnauthorized).send({ error: 'invalid JWT token: invalid access token' })
            }
        } catch (error) {
            return res.status(HTTP.StatusUnauthorized).send({ error: (error as Error).message })
        }
        next();
    }
}