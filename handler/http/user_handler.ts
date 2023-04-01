import { validate } from '../../util/validate';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer'
import { Pagination } from '../../model/common';
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
    userRouter.get('', (req, res, next) => userHandler.searchUsers(req, res, next))
    userRouter.patch('/notification', (req, res, next) => userHandler.notiUser(req, res, next))
    userRouter.get('/profile', (req, res, next) => userHandler.getProfile(req, res, next))
    userRouter.patch('/profile', upload.array("file"), (req, res, next) => userHandler.updateProfile(req, res, next))
    userRouter.patch('/following', (req, res, next) => userHandler.followingUser(req, res, next))
    userRouter.get('/:type', (req, res, next) => userHandler.getFollowUsers(req, res, next))

    return userRouter
}

class UserHandler {
    constructor(private userService: UserService) {}

    async searchUsers(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.searchUsers")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "search", type: "string", required: true},
                {field: "limit", type: "number", required: false},
                {field: "offset", type: "number", required: false},
            ]

            try {
                validate(schemas, req.query)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const query: Pagination = {
                search: req.query.search?.toString(),
                limit: Number(req.query.limit) || 10,
                offset: Number(req.query.offset) || 0,
            }

            const users = await this.userService.getUsersSrv(query)
            if (!users || !users.total) {
                logger.error('users are not found')
                return res.status(HTTP.StatusNoContent).send()
            }

            if (users.data) {
                users.data = users.data.map(user => {
                    return {
                        userUUID: user.userUUID,
                        userType: user.userType,
                        userDisplayName: user.userDisplayName,
                        userFullName: user.userFullName,
                        userEmail: user.userEmail,
                        studentID: user.studentID,
                        userImageURL: user.userImageURL,
                    } as User
                })
            }

            logger.info("End http.user.searchUsers")
            return res.status(HTTP.StatusOK).send(users);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getFollowUsers(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.getFollowUsers")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "userUUID", type: "string", required: true},
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
                type: req.params.type?.toString()!,
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

            logger.info("End http.user.getFollowUsers")
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

            if (profile.userUUID === req.body.userUUID) {
                logger.error('unable to following yourself')
                return res.status(HTTP.StatusBadRequest).send({ error: "unable to following yourself" })
            }

            await this.userService.followingUserSrv(profile.userUUID, req.body.userUUID, req.body.isFollowing as boolean)

            logger.info("End http.user.followingUser")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async notiUser(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.user.notiUser")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "userUUID", type: "string", required: true},
                {field: "isNoti", type: "boolean", required: true},
            ]

            try {
                validate(schemas, req.body)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            if (profile.userUUID === req.body.userUUID) {
                logger.error('unable to notify yourself')
                return res.status(HTTP.StatusBadRequest).send({ error: "unable to notify yourself" })
            }

            await this.userService.notiUserSrv(profile.userUUID, req.body.userUUID, req.body.isNoti as boolean)

            logger.info("End http.user.notiUser")
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
                logger.error('user is not found')
                return res.status(HTTP.StatusUnauthorized).send({ error: 'user is not found' })
            }

            if (userUUID && userUUID !== profile.userUUID) {
                const selfUser = await this.userService.getUserProfileSrv({ userUUID: profile.userUUID })
                if (!selfUser) {
                    logger.error('user is not found')
                    return res.status(HTTP.StatusUnauthorized).send({ error: 'user is not found' })
                }
                user.isFollowing = user.followerUserUUIDs?.includes(profile.userUUID) || false
                user.isNoti = selfUser.notiUserUUIDs?.includes(user.userUUID!) || false
            }

            delete (user as any)._id
            delete (user as any).createdAt
            delete (user as any).updatedAt
            delete user.firebaseID
            delete user.lastLogin
            delete user.notiUserUUIDs
            // delete user.followerUserUUIDs
            // delete user.followingUserUUIDs
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

            if (req.files && (req.files as File[]).length > 1) {
                logger.error('file is limit at 1')
                return res.status(HTTP.StatusBadRequest).send({ error: "file is limit at 1" })
            }
            const data = JSON.parse(req.body.data);
            let user: User = {userUUID: profile.userUUID}
            if (data.userDisplayName && typeof data.userDisplayName === 'string') {
                user.userDisplayName = data.userDisplayName.trim()
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