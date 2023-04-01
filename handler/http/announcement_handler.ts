import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer'
import HTTP from "../../common/http";
import { Announcement, FilterAnnouncement } from '../../model/announcement';
import { AnnouncementService } from "../../service/announcement_service";
import logger from "../../util/logger";
import { getProfile } from '../../util/profile';
import { bind, validate } from "../../util/validate";
const upload = multer()

export function newAnnouncementHandler(announcementService: AnnouncementService) {
    const announcementHandler = new AnnouncementHandler(announcementService)

    const announcementRouter = Router()
    announcementRouter.get('', (req, res, next) => announcementHandler.getAnnouncements(req, res, next))
    announcementRouter.get('/:announcementUUID', (req, res, next) => announcementHandler.getAnnouncementDetail(req, res, next))
    announcementRouter.put('', upload.array("files"), (req, res, next) => announcementHandler.upsertAnnouncement(req, res, next))
    announcementRouter.delete('', (req, res, next) => announcementHandler.deleteAnnouncement(req, res, next))

    return announcementRouter
}

export class AnnouncementHandler {
    constructor(private announcementService: AnnouncementService) {}

    async getAnnouncements(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.announcement.getAnnouncements")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "userUUID", type: "string", required: false},
                {field: "limit", type: "number", required: false},
                {field: "offset", type: "number", required: false},
            ]

            try {
                validate(schemas, req.query)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const query: FilterAnnouncement = {
                userUUID: req.query.userUUID as string,
                limit: Number(req.query.limit) || 10,
                offset: Number(req.query.offset) || 0,
            }

            const announcements = await this.announcementService.getAnnouncementsSrv(query)
            if (!announcements || !announcements.total) {
                logger.error('announcements are not found')
                return res.status(HTTP.StatusNoContent).send()
            }

            logger.info("End http.announcement.getAnnouncements")
            return res.status(HTTP.StatusOK).send(announcements);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getAnnouncementDetail(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.announcement.getAnnouncementDetail")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const announcementUUID = req.params['announcementUUID'] as string
            if (!announcementUUID) {
                logger.error('announcementUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "announcementUUID is required" })
            }

            await this.announcementService.seeAnnouncementSrv(announcementUUID, profile.userUUID)

            const announcement = await this.announcementService.getAnnouncementDetailSrv(announcementUUID)
            if (!announcement || !announcement.announcementUUID) {
                logger.error('announcementUUID is not found')
                return res.status(HTTP.StatusNotFound).send({ error: 'announcementUUID is not found' })
            }

            logger.info("End http.announcement.getAnnouncementDetail")
            return res.status(HTTP.StatusOK).send(announcement);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async upsertAnnouncement(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.announcement.upsertAnnouncement")

        try {
            const profile = getProfile(req)
            if (profile.userType !== 'tch') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const data = JSON.parse(req.body.data);

            const schemas = [
                {field: "announcementUUID", type: "string", required: false},
                {field: "title", type: "string", required: true},
                {field: "description", type: "string", required: true},
            ]

            try {
                validate(schemas, data)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const announcement: Announcement = bind(data, schemas)
            announcement.authorUUID = profile.userUUID
            announcement.title = announcement.title.trim()

            const response = await this.announcementService.upsertAnnouncementSrv(announcement, req.files as any, data.announcementImageUUIDs)

            logger.info("End http.announcement.upsertAnnouncement")
            return res.status(HTTP.StatusOK).send(response);

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async deleteAnnouncement(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.announcement.deleteAnnouncement")

        try {
            const profile = getProfile(req)
            if (profile.userType !== 'tch') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const announcementUUID = req.body.announcementUUID
            if (!announcementUUID) {
                logger.error('announcementUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "announcementUUID is required" })
            }

            await this.announcementService.deleteAnnouncementSrv(announcementUUID)

            logger.info("End http.announcement.deleteAnnouncement")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}