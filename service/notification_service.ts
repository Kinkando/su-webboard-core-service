import { filePath } from "@common/file_path";
import { CloudStorage } from "../cloud/google/storage";
import { Pagination } from "../model/common";
import { Notification, NotificationView, mapNotiLink } from "../model/notification";
import { NotificationRepository } from "../repository/mongo/notification_repository";
import logger from "../util/logger";
import { ForumService } from "./forum_service";

export function newNotificationService(repository: NotificationRepository, forumService: ForumService, storage: CloudStorage) {
    return new NotificationService(repository, forumService, storage)
}

interface Service {
    getNotificationsPaginationSrv(query: Pagination, userUUID: string): Promise<{total: number, data: NotificationView[]}>
    getNotificationDetailSrv(notiUUID: string, userUUID: string): Promise<NotificationView>
    createUpdateDeleteNotificationSrv(noti: Notification, action: 'push' | 'pop'): Promise<{mode: 'create' | 'update' | 'delete' | 'invalid', notiUUID: string}>
    readNotificationSrv(notiUUID: string): void
    countUnreadNotificationSrv(userUUID: string): Promise<number>
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
        if (noti.notiUserUUIDs && noti.notiUserUUIDs.length > 1) {
            noti.notiBody = noti.notiUserDisplayName + ` และคนอื่นๆอีก ${noti.notiUserUUIDs.length - 1}` + noti.notiBody
        } else {
            noti.notiBody = noti.notiUserDisplayName + ' ' + noti.notiBody
        }
        noti.notiUserImageURL = await this.storage.signedURL(noti.isAnonymous ? filePath.anonymousAvatar : noti.notiUserImageURL)
        noti.notiLink = mapNotiLink({commentUUID: noti.commentUUID, forumUUID: noti.forumUUID, followerUserUUID: noti.followerUserUUID})
        delete noti.followerUserUUID
        delete noti.notiUserUUIDs
        delete noti.isAnonymous
    }

    async getNotificationsPaginationSrv(query: Pagination, userUUID: string) {
        logger.info(`Start service.notification.getNotificationsPaginationSrv, "output": ${JSON.stringify({query, userUUID})}`)

        const notification = await this.repository.getNotificationsPaginationRepo(query, userUUID)
        if (notification && notification.data) {
            for (const noti of notification.data) {
                await this.assertNotificationDetail(noti)
            }
        }

        logger.info(`End service.notification.getNotificationsPaginationSrv, "output": {"total": ${notification?.total || 0}, "data.length": ${notification?.data?.length || 0}}`)
        return notification
    }

    async getNotificationDetailSrv(notiUUID: string, userUUID: string): Promise<NotificationView> {
        logger.info(`Start service.notification.getNotificationDetailSrv, "output": ${JSON.stringify({notiUUID, userUUID})}`)

        const notiDetail = await this.repository.getNotificationDetailRepo(notiUUID, userUUID)
        if (notiDetail) {
            await this.assertNotificationDetail(notiDetail)
        }

        logger.info(`End service.notification.getNotificationDetailSrv, "output": ${JSON.stringify(notiDetail)}`)
        return notiDetail
    }

    async createUpdateDeleteNotificationSrv(noti: Notification, action: 'push' | 'pop') {
        logger.info(`Start service.notification.createUpdateDeleteNotificationSrv, "output": ${JSON.stringify({noti, action})}`)

        let notiUUID = ""
        let mode: 'create' | 'update' | 'delete' | 'invalid' = 'invalid';

        const notiModel = await this.repository.getNotificationRepo(noti)

        if (!notiModel) {
            notiUUID = await this.repository.createNotificationRepo(noti)
            mode = 'create'
        } else {
            notiUUID = notiModel.notiUUID
            if (notiModel.notiUserUUIDs.length <= 1 && action === 'pop') {
                await this.repository.deleteNotificationRepo(notiModel.notiUUID)
                mode = 'delete'
            } else {
                await this.repository.updateNotificationRepo(noti, action)
                mode = 'update'
            }
        }

        logger.info(`End service.notification.createUpdateDeleteNotificationSrv, "output": ${JSON.stringify({mode, notiUUID})}`)
        return {mode, notiUUID}
    }

    async readNotificationSrv(notiUUID: string) {
        logger.info(`Start service.notification.readNotificationSrv, "output": ${JSON.stringify({notiUUID})}`)

        await this.repository.readNotificationRepo(notiUUID)

        logger.info(`End service.notification.readNotificationSrv`)
    }

    async countUnreadNotificationSrv(userUUID: string) {
        logger.info(`Start service.notification.countUnreadNotificationSrv, "output": ${JSON.stringify({userUUID})}`)

        const count = await this.repository.countUnreadNotificationRepo(userUUID)

        logger.info(`End service.notification.countUnreadNotificationSrv, "output": ${JSON.stringify({count})}`)
        return count
    }
}