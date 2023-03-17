import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer'
import HTTP from "../../common/http";
import { FilterForum, Forum } from '../../model/forum';
import { ForumService } from "../../service/forum_service";
import logger from "../../util/logger";
import { getProfile } from '../../util/profile';
import { bind, validate } from "../../util/validate";
const upload = multer()

export function newForumHandler(forumService: ForumService) {
    const forumHandler = new ForumHandler(forumService)

    const forumRouter = Router()
    forumRouter.get('', (req, res, next) => forumHandler.getForums(req, res, next))
    forumRouter.get('/:forumUUID', (req, res, next) => forumHandler.getForumDetail(req, res, next))
    forumRouter.put('', upload.array("files"), (req, res, next) => forumHandler.upsertForum(req, res, next))
    forumRouter.delete('', (req, res, next) => forumHandler.deleteForum(req, res, next))
    forumRouter.patch('/like', (req, res, next) => forumHandler.likeForum(req, res, next))

    return forumRouter
}

export class ForumHandler {
    constructor(private forumService: ForumService) {}

    async getForums(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.getForums")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "categoryID", type: "number", required: false},
                {field: "sortBy", type: "string", required: false},
                {field: "limit", type: "number", required: false},
                {field: "offset", type: "number", required: false},
            ]

            try {
                validate(schemas, req.query)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const query: FilterForum = {
                limit: Number(req.query.limit) || 10,
                offset: Number(req.query.offset) || 0,
                categoryID: Number(req.query.categoryID),
                sortBy: req.query.sortBy?.toString() || 'createdAt@DESC',
                userUUID: profile.userUUID,
            }

            const forums = await this.forumService.getForumsSrv(query)
            if (!forums || !forums.total) {
                logger.error('forums are not found')
                return res.status(HTTP.StatusNoContent).send()
            }

            logger.info("End http.forum.getForums")
            return res.status(HTTP.StatusOK).send(forums);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getForumDetail(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.getForumDetail")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const forumUUID = req.params['forumUUID'] as string
            if (!forumUUID) {
                logger.error('forumUUID is invalid')
                return res.status(HTTP.StatusBadRequest).send({ error: "forumUUID is invalid" })
            }

            const forum = await this.forumService.getForumDetailSrv(forumUUID)
            if (!forum || !forum.forumUUID) {
                logger.error('forumUUID is not found')
                return res.status(HTTP.StatusNotFound).send({ error: 'forumUUID is not found' })
            }

            forum.isLike = forum.likeUserUUIDs?.includes(profile.userUUID) || false
            delete forum.likeUserUUIDs

            logger.info("End http.forum.getForumDetail")
            return res.status(HTTP.StatusOK).send(forum);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async upsertForum(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.upsertForum")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const data = JSON.parse(req.body.data);

            const schemas = [
                {field: "forumUUID", type: "string", required: false},
                {field: "title", type: "string", required: true},
                {field: "description", type: "string", required: true},
                {field: "categoryIDs", type: "array<number>", required: true},
            ]

            try {
                validate(schemas, data)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const forum: Forum = bind(data, schemas)
            forum.authorUUID = profile.userUUID

            const forumUUID = await this.forumService.upsertForumSrv(forum, req.files as any)

            logger.info("End http.forum.upsertForum")
            return res.status(HTTP.StatusOK).send({ forumUUID });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async deleteForum(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.deleteForum")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            if (!req.body.forumUUID) {
                logger.error('forumUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "forumUUID is required" })
            }

            await this.forumService.deleteForumSrv(req.body.forumUUID)

            // remove all related comments with this forum

            logger.info("End http.forum.deleteForum")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async likeForum(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.forum.likeForum")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "forumUUID", type: "string", required: true},
                {field: "isLike", type: "boolean", required: true},
            ]

            try {
                validate(schemas, req.body)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const forumUUID = req.body.forumUUID
            const isLike = Boolean(req.body.isLike)

            await this.forumService.likeForumSrv(forumUUID, profile.userUUID, isLike)

            logger.info("End http.forum.likeForum")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}