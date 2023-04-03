import { filePath } from "../common/file_path";
import { CloudStorage } from "../cloud/google/storage";
import { FilterNotification, Notification, NotificationView, mapNotiLink } from "../model/notification";
import { NotificationRepository } from "../repository/mongo/notification_repository";
import logger from "../util/logger";
import { ForumService } from "./forum_service";
import { NotificationModel } from "../repository/mongo/model/notification";

export function newNotificationService(repository: NotificationRepository, forumService: ForumService, storage: CloudStorage) {
    return new NotificationService(repository, forumService, storage)
}

interface Service {
    getNotificationsPaginationSrv(query: FilterNotification, userUUID: string): Promise<{total: number, data: NotificationView[]}>
    getNotificationDetailSrv(notiUUID: string, userUUID: string, isRaw: boolean): Promise<NotificationView>
    getNotificationsSrv(noti: Notification): Promise<NotificationModel[]>
    createUpdateDeleteNotificationSrv(noti: Notification, action: 'push' | 'pop' | 'remove'): Promise<{mode: 'create' | 'update' | 'delete' | 'invalid', notiUUID: string}>
    readNotificationSrv(notiUUID: string, notiUserUUIDs: string[]): void
    readAllNotificationSrv(userUUID: string): void
    countUnreadNotificationSrv(userUUID: string): Promise<number>
    deleteNotificationSrv(notiUUID: string): void
}

export class NotificationService implements Service {
    constructor(private repository: NotificationRepository, private forumService: ForumService, private storage: CloudStorage) {}

    private async assertNotificationDetail(noti: NotificationView) {
        if (noti.isAnonymous) {
            noti.notiUserDisplayName = 'ผู้ใช้นิรนาม'
            if (noti.notiUserUUID === noti.userUUID) {
                noti.notiUserDisplayName += ' (คุณ)'
            } else {
                noti.notiUserUUID = "unknown"
            }
        }
        if (noti.announcementUUID) {
            noti.notiBody = noti.notiBody + "โดย " + noti.notiUserDisplayName
        } else if (noti.notiUserUUIDs && noti.notiUserUUIDs.length > 1) {
            noti.notiBody = noti.notiUserDisplayName + ` และคนอื่นๆอีก ${noti.notiUserUUIDs.length - 1}` + noti.notiBody
        } else {
            noti.notiBody = noti.notiUserDisplayName + ' ' + noti.notiBody
        }
        noti.notiUserImageURL = await this.storage.signedURL(noti.isAnonymous ? filePath.anonymousAvatar : noti.notiUserImageURL)
        noti.notiLink = mapNotiLink({replyCommentUUID: noti.replyCommentUUID, commentUUID: noti.commentUUID, forumUUID: noti.forumUUID, followerUserUUID: noti.followerUserUUID})
        delete noti.followerUserUUID
        delete noti.announcementUUID
        delete noti.forumUUID
        delete noti.commentUUID
        delete noti.replyCommentUUID
        delete noti.notiUserUUIDs
        delete noti.isAnonymous
    }

    async getNotificationsPaginationSrv(query: FilterNotification, userUUID: string) {
        logger.info(`Start service.notification.getNotificationsPaginationSrv, "input": ${JSON.stringify({query, userUUID})}`)

        const notification = await this.repository.getNotificationsPaginationRepo(query, userUUID)
        if (notification && notification.data) {
            for (const noti of notification.data) {
                await this.assertNotificationDetail(noti)
            }
        }

        logger.info(`End service.notification.getNotificationsPaginationSrv, "output": {"total": ${notification?.total || 0}, "data.length": ${notification?.data?.length || 0}}`)
        return notification
    }

    async getNotificationDetailSrv(notiUUID: string, userUUID: string, isRaw = false) {
        logger.info(`Start service.notification.getNotificationDetailSrv, "input": ${JSON.stringify({notiUUID, userUUID})}`)

        const notiDetail = await this.repository.getNotificationDetailRepo(notiUUID)
        if (!isRaw && notiDetail) {
            await this.assertNotificationDetail(notiDetail)
        }

        logger.info(`End service.notification.getNotificationDetailSrv, "output": ${JSON.stringify(notiDetail)}`)
        return notiDetail
    }

    async getNotificationsSrv(noti: Notification) {
        logger.info(`Start service.notification.getNotificationsSrv, "input": ${JSON.stringify(noti)}`)

        const notifications = await this.repository.getNotificationsRepo(noti)

        logger.info(`End service.notification.getNotificationsSrv, "output": ${JSON.stringify({total: notifications?.length || 0})}`)
        return notifications
    }

    async createUpdateDeleteNotificationSrv(noti: Notification, action: 'push' | 'pop' | 'remove') {
        logger.info(`Start service.notification.createUpdateDeleteNotificationSrv, "input": ${JSON.stringify({noti, action})}`)

        let notiUUID = ""
        let mode: 'create' | 'update' | 'delete' | 'invalid' = 'invalid';

        if (action === 'remove') {
            await this.repository.deleteNotificationRepo(noti)
            mode = 'delete'

        } else {
            const notiModel = await this.repository.getNotificationRepo(noti)

            if (!notiModel && action === 'push') {
                notiUUID = await this.repository.createNotificationRepo(noti)
                mode = 'create'
            } else if (notiModel) {
                notiUUID = notiModel.notiUUID
                noti.notiUUID = notiModel.notiUUID
                if (notiModel.notiUserUUIDs.length <= 1 && action === 'pop') {
                    await this.repository.deleteNotificationRepo({notiUUID: notiModel.notiUUID} as any)
                    mode = 'delete'
                } else {
                    await this.repository.updateNotificationRepo(noti, action)
                    mode = 'update'
                }
            } else {
                logger.error('invalid action')
            }
        }


        logger.info(`End service.notification.createUpdateDeleteNotificationSrv, "output": ${JSON.stringify({mode, notiUUID})}`)
        return {mode, notiUUID}
    }

    async readNotificationSrv(notiUUID: string, notiUserUUIDs: string[]) {
        logger.info(`Start service.notification.readNotificationSrv, "input": ${JSON.stringify({notiUUID, notiUserUUIDs})}`)

        await this.repository.readNotificationRepo(notiUUID, notiUserUUIDs)

        logger.info(`End service.notification.readNotificationSrv`)
    }

    async readAllNotificationSrv(userUUID: string) {
        logger.info(`Start service.notification.readAllNotificationSrv, "input": ${JSON.stringify({userUUID})}`)

        const notifications = await this.repository.getNotificationsRepo({userUUID} as any)

        if(notifications) {
            for (const noti of notifications) {
                await this.repository.readNotificationRepo(noti.notiUUID, noti.notiUserUUIDs)
            }
        }

        logger.info(`End service.notification.readAllNotificationSrv`)
    }

    async countUnreadNotificationSrv(userUUID: string) {
        logger.info(`Start service.notification.countUnreadNotificationSrv, "input": ${JSON.stringify({userUUID})}`)

        const count = await this.repository.countUnreadNotificationRepo(userUUID)

        logger.info(`End service.notification.countUnreadNotificationSrv, "output": ${JSON.stringify({count})}`)
        return count
    }

    async deleteNotificationSrv(notiUUID: string) {
        logger.info(`Start service.notification.deleteNotificationSrv, "input": ${JSON.stringify({notiUUID})}`)

        await this.repository.deleteNotificationRepo({notiUUID} as any)

        logger.info(`End service.notification.deleteNotificationSrv`)
    }
}