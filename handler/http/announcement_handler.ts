import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer'
import HTTP from "../../common/http";
import { Announcement, FilterAnnouncement } from '../../model/announcement';
import { AnnouncementService } from "../../service/announcement_service";
import logger from "../../util/logger";
import { getProfile } from '../../util/profile';
import { bind, validate } from "../../util/validate";
import { NotificationService } from '../../service/notification_service';
import { NotificationSocket } from '../socket/notification_socket';
import { UserService } from '../../service/user_service';
import { NotificationBody } from '../../model/notification';

const upload = multer()

export function newAnnouncementHandler(announcementService: AnnouncementService, notificationService: NotificationService, userService: UserService, notificationSocket: NotificationSocket,) {
    const announcementHandler = new AnnouncementHandler(announcementService, notificationService, userService, notificationSocket)

    const announcementRouter = Router()
    announcementRouter.get('', (req, res, next) => announcementHandler.getAnnouncements(req, res, next))
    announcementRouter.get('/:announcementUUID', (req, res, next) => announcementHandler.getAnnouncementDetail(req, res, next))
    announcementRouter.put('', upload.array("files"), (req, res, next) => announcementHandler.upsertAnnouncement(req, res, next))
    announcementRouter.delete('', (req, res, next) => announcementHandler.deleteAnnouncement(req, res, next))

    return announcementRouter
}

export class AnnouncementHandler {
    constructor(private announcementService: AnnouncementService, private notificationService: NotificationService, private userService: UserService, private notificationSocket: NotificationSocket) {}

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

            const isCreate = announcement.announcementUUID == undefined

            const response = await this.announcementService.upsertAnnouncementSrv(announcement, req.files as any, data.announcementImageUUIDs)

            if (isCreate) {
                const users = await this.userService.getUsersSrv({userType: 'std'})
                if (users) {
                    for (const user of users) {
                        const noti = {notiBody: NotificationBody.NewAnnouncement, notiUserUUID: profile.userUUID, userUUID: user.userUUID!, announcementUUID: response.announcementUUID}
                        const { notiUUID, mode } = await this.notificationService.createUpdateDeleteNotificationSrv(noti as any, 'push')
                        if (mode === 'create') {
                            this.notificationSocket.createNotification(user.userUUID!, notiUUID)
                        }
                    }
                }
            }

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

            const notifications = await this.notificationService.getNotificationsSrv({announcementUUID} as any)

            await this.notificationService.createUpdateDeleteNotificationSrv({announcementUUID} as any, 'remove')

            if (notifications) {
                const notiUserUUIDs = new Set<string>()
                for(const noti of notifications) {
                    notiUserUUIDs.add(noti.userUUID)
                }
                for (const userUUID of notiUserUUIDs) {
                    this.notificationSocket.refreshNotification(userUUID)
                }
            }

            logger.info("End http.announcement.deleteAnnouncement")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status((error as Error).message.endsWith(" not found") ? HTTP.StatusNotFound : HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}