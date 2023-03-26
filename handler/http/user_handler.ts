import { validate } from '@util/validate';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer'
import { File } from '../../cloud/google/storage';
import HTTP from '../../common/http';
import { FollowUserPagination, User } from '../../model/user';
import { UserService } from "../../service/user_service";
import logger from '../../util/logger';
import { getProfile } from '../../util/profile';
const upload = multer()

export function newUserHandler(userService: UserService) {
    const userHandler = new UserHandler(userService)

    const userRouter = Router()
    userRouter.get('', (req, res, next) => userHandler.getUsers(req, res, next))
    userRouter.patch('/following', (req, res, next) => userHandler.followingUser(req, res, next))
    userRouter.get('/profile', (req, res, next) => userHandler.getProfile(req, res, next))
    userRouter.patch('/profile', upload.array("file"), (req, res, next) => userHandler.updateProfile(req, res, next))

    return userRouter
}

class UserHandler {
    constructor(private userService: UserService) {}

    async getUsers(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.getUsers")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "userUUID", type: "string", required: true},
                {field: "type", type: "string", required: true},
                {field: "search", type: "string", required: false},
                {field: "limit", type: "number", required: false},
                {field: "offset", type: "number", required: false},
            ]

            try {
                validate(schemas, req.query)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const query: FollowUserPagination = {
                userUUID: req.query.userUUID?.toString()!,
                type: req.query.type?.toString()!,
                search: req.query.search?.toString(),
                limit: Number(req.query.limit) || 10,
                offset: Number(req.query.offset) || 0,
            }

            if (query.type !== 'following' && query.type !== 'follower') {
                logger.error('type is invalid')
                return res.status(HTTP.StatusBadRequest).send({ error: 'type is invalid' })
            }

            const users = await this.userService.getFollowUsersSrv(query, profile.userUUID)
            if (!users || !users.total) {
                logger.error('users are not found')
                return res.status(HTTP.StatusNoContent).send()
            }

            logger.info("End http.user.getUsers")
            return res.status(HTTP.StatusOK).send(users);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async followingUser(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.followingUser")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "userUUID", type: "string", required: true},
                {field: "isFollowing", type: "boolean", required: true},
            ]

            try {
                validate(schemas, req.body)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            await this.userService.followingUserSrv(profile.userUUID, req.body.userUUID, req.body.isFollowing as boolean)

            logger.info("End http.user.followingUser")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getProfile(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.getProfile")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const userUUID = req.query.userUUID as string
            const user = await this.userService.getUserProfileSrv({ userUUID: userUUID || profile.userUUID })
            if (!user) {
                throw Error("user not found")
            }

            if (userUUID && userUUID !== profile.userUUID) {
                user.isFollowing = user.followerUserUUIDs?.includes(profile.userUUID) || false
            }

            delete (user as any)._id
            delete (user as any).createdAt
            delete (user as any).updatedAt
            delete user.firebaseID
            delete user.isLinkGoogle
            delete user.lastLogin
            delete user.followerUserUUIDs
            delete user.followingUserUUIDs
            // delete user.userType
            // delete user.userUUID

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