import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer'
import { File } from '../../cloud/google/storage';
import HTTP from '../../common/http';
import { User } from '../../model/user';
import { UserService } from "../../service/user_service";
import logger from '../../util/logger';
import { getProfile } from '../../util/profile';
const upload = multer()

export function newUserHandler(userService: UserService) {
    const userHandler = new UserHandler(userService)

    const userRouter = Router()

    const profileRouter = userRouter.use('/profile', userRouter)
    profileRouter.get('', (req, res, next) => userHandler.getProfile(req, res, next))
    profileRouter.patch('', upload.array("file"), (req, res, next) => userHandler.updateProfile(req, res, next))

    return userRouter
}

class UserHandler {
    constructor(private userService: UserService) {}

    async getProfile(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.getProfile")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const user = await this.userService.getUserSrv({ userUUID: (req.query.userUUID as any) || profile.userUUID })
            if (!user) {
                throw Error("user not found")
            }

            delete (user as any)._id
            delete (user as any).createdAt
            delete (user as any).updatedAt
            delete (user as any).firebaseID
            delete (user as any).userType
            delete (user as any).userUUID
            delete (user as any).isLinkGoogle
            delete (user as any).lastLogin

            logger.info("End http.user.getProfile")
            return res.status(HTTP.StatusOK).send(user);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async updateProfile(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.updateProfile")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            if (req.files && req.files.length > 1) {
                logger.error('file is limit at 1')
                return res.status(HTTP.StatusBadRequest).send({ error: "file is limit at 1" })
            }
            const data = JSON.parse(req.body.data);
            let user: User = {userUUID: profile.userUUID}
            if (data.userDisplayName && typeof data.userDisplayName === 'string') {
                user.userDisplayName = data.userDisplayName
            }
            if (data.isAnonymous != undefined && typeof data.isAnonymous === 'boolean') {
                user.isAnonymous = data.isAnonymous
            }
            await this.userService.updateUserProfileSrv(user, (req.files as any)[0] as File)

            logger.info("End http.user.updateProfile")
            return res.status(HTTP.StatusCreated).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}