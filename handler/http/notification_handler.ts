import { Router, Request, Response, NextFunction } from "express";
import HTTP from "../../common/http";
import { FilterNotification } from "../../model/notification";
import { NotificationService } from '../../service/notification_service';
import logger from "../../util/logger";
import { getProfile } from "../../util/profile";
import { validate } from "../../util/validate";
import { NotificationSocket } from '../socket/notification_socket';

export function newNotificationHandler(notificationService: NotificationService, notificationSocket: NotificationSocket) {
    const notificationHandler = new NotificationHandler(notificationService, notificationSocket)

    const notificationRouter = Router()
    notificationRouter.get('', (req, res, next) => notificationHandler.getNotifications(req, res, next))
    notificationRouter.patch('', (req, res, next) => notificationHandler.readAllNotification(req, res, next))
    notificationRouter.get('/count', (req, res, next) => notificationHandler.getUnreadNotificationCount(req, res, next))
    notificationRouter.get('/:notiUUID', (req, res, next) => notificationHandler.getNotificationDetail(req, res, next))
    notificationRouter.patch('/:notiUUID', (req, res, next) => notificationHandler.readNotification(req, res, next))
    notificationRouter.delete('/:notiUUID', (req, res, next) => notificationHandler.deleteNotification(req, res, next))

    return notificationRouter
}

export class NotificationHandler {
    constructor(private notificationService: NotificationService, private notificationSocket: NotificationSocket) {}

    async getNotifications(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.notification.getNotifications")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const schemas = [
                {field: "isRead", type: "string", required: false},
                {field: "limit", type: "number", required: false},
                {field: "offset", type: "number", required: false},
            ]

            try {
                validate(schemas, req.query)
            } catch (error) {
                logger.error(error)
                return res.status(HTTP.StatusBadRequest).send({ error: (error as Error).message })
            }

            const filter: FilterNotification = {
                isRead: req.query.isRead?.toString() as any || 'all',
                limit: Number(req.query.limit) || 10,
                offset: Number(req.query.offset) || 0,
            }

            const notification = await this.notificationService.getNotificationsPaginationSrv(filter, profile.userUUID)
            if (!notification || !notification.total) {
                logger.error('notification is not found')
                return res.status(HTTP.StatusNoContent).send()
            }

            logger.info("End http.notification.getNotifications")
            return res.status(HTTP.StatusOK).send(notification);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getUnreadNotificationCount(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.notification.getUnreadNotificationCount")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const count = await this.notificationService.countUnreadNotificationSrv(profile.userUUID)

            logger.info("End http.notification.getUnreadNotificationCount")
            return res.status(HTTP.StatusOK).send({ count });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getNotificationDetail(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.notification.getNotificationDetail")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const notiUUID = req.params['notiUUID'] as string
            if (!notiUUID) {
                logger.error('notiUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "notiUUID is required" })
            }

            const notiDetail = await this.notificationService.getNotificationDetailSrv(notiUUID, profile.userUUID)
            if (!notiDetail) {
                logger.error('notiUUID is not found')
                return res.status(HTTP.StatusNotFound).send({ error: "notiUUID is not found" })
            }

            logger.info("End http.notification.getNotificationDetail")
            return res.status(HTTP.StatusOK).send(notiDetail);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async readNotification(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.notification.readNotification")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const notiUUID = req.params['notiUUID'] as string
            if (!notiUUID) {
                logger.error('notiUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "notiUUID is required" })
            }

            const noti = await this.notificationService.getNotificationDetailSrv(notiUUID, profile.userUUID, true)
            if (!noti || !noti.notiUUID) {
                logger.error('notiUUID is not found')
                return res.status(HTTP.StatusNotFound).send({ error: "notiUUID is not found" })
            }

            await this.notificationService.readNotificationSrv(notiUUID, noti.notiUserUUIDs!)
            this.notificationSocket.readNotification(profile.userUUID, notiUUID)

            logger.info("End http.notification.readNotification")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async readAllNotification(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.notification.readAllNotification")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            await this.notificationService.readAllNotificationSrv(profile.userUUID)
            this.notificationSocket.readNotification(profile.userUUID)

            logger.info("End http.notification.readAllNotification")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async deleteNotification(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.notification.deleteNotification")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const notiUUID = req.params['notiUUID'] as string
            if (!notiUUID) {
                logger.error('notiUUID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "notiUUID is required" })
            }

            await this.notificationService.deleteNotificationSrv(notiUUID)
            this.notificationSocket.deleteNotification(profile.userUUID, notiUUID)

            logger.info("End http.notification.deleteNotification")
            return res.status(HTTP.StatusOK).send({ message: 'success' });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}