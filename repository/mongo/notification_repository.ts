import * as mongoDB from "mongodb";
import notificationModel, { NotificationModel, newNotificationModel } from './model/notification'
import { Pagination } from "../../model/common";
import { Notification, NotificationView } from "../../model/notification";
import logger from "../../util/logger";
import { v4 as uuid } from "uuid";
import { UpdateQuery } from "mongoose";
import { UserCollection } from "./user_repository";
import { ForumCollection } from "./forum_repository";

export function newNotificationRepository(db: mongoDB.Db) {
    return new NotificationRepository(db)
}

export const NotificationCollection = "Notification"

interface Repository {
    getNotificationsPaginationRepo(query: Pagination, userUUID: string): Promise<{ total: number, data: NotificationView[] }>
    getNotificationRepo(noti: Notification): Promise<NotificationModel | null>
    createNotificationRepo(noti: Notification): Promise<string>
    updateNotificationRepo(noti: Notification, action: 'push' | 'pop'): void
    deleteNotificationRepo(notiUUID: string): void
    readNotificationRepo(notiUUID: string): void
    countUnreadNotificationRepo(userUUID: string): Promise<number>
}

export class NotificationRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getNotificationsPaginationRepo(query: Pagination, userUUID: string) {
        logger.info(`Start mongo.notification.getNotificationsPaginationRepo, "input": ${JSON.stringify({query, userUUID})}`)

        const res = (await notificationModel.aggregate<{ total: number, data: NotificationModel[] }>([
            {$match: { userUUID }},
            {$addFields: { notiUserUUID: { $last: "$notiUserUUIDs" } }},
            {$lookup: {
                from: UserCollection,
                localField: 'notiUserUUID',
                foreignField: 'userUUID',
                as: 'user'
            }},
            {$unwind: "$user"},
            {$lookup: {
                from: ForumCollection,
                localField: 'forumUUID',
                foreignField: 'forumUUID',
                as: 'forums'
            }},
            {$addFields: {
                notiUserDisplayName: '$user.userDisplayName',
                notiUserImageURL: '$user.userImageURL',
            }},
            {$facet:{
                "stage1" : [ { "$group": { _id: null, count: { $sum: 1 } } } ],
                "stage2" : [ { "$skip": query.offset }, { "$limit": query.limit || 10 } ],
            }},
            {$unwind: "$stage1"},

            //output projection
            {$project:{
                total: "$stage1.count",
                data: "$stage2"
            }}
        ])).map(doc => {
            const notiView: NotificationView[] = [];
            doc.data?.forEach(noti => {
                const notiData = noti as any
                notiData.isAnonymous = notiData.forums?.length === 1 && notiData.forums[0].isAnonymous && notiData.forums[0].authorUUID !== userUUID
                notiData.isRead = notiData.notiUserUUIDs?.length === notiData.notiReadUserUUIDs?.length || false
                notiData.notiAt = noti.createdAt
                notiView.push(notiData)
                delete notiData._id
                delete notiData.user
                delete notiData.forums
                delete notiData.notiReadUserUUIDs
                delete noti.createdAt
                delete noti.updatedAt
            })
            return { total: doc.total, data: notiView }
        })[0]
        // check forum is anonymous before

        logger.info(`End mongo.notification.getNotificationsPaginationRepo, "output": ${JSON.stringify(res)}`)
        return res
    }

    async getNotificationRepo(noti: Notification) {
        logger.info(`Start mongo.notification.getNotificationRepo, "input": ${JSON.stringify(noti)}`)

        let filter: any = {}
        if (noti.userUUID) {
            filter.userUUID = noti.userUUID
        }
        if (noti.forumUUID) {
            filter.forumUUID = noti.forumUUID
        }
        if (noti.commentUUID) {
            filter.commentUUID = noti.commentUUID
        }
        if (noti.followerUserUUID) {
            filter.followerUserUUID = noti.followerUserUUID
        }
        const notiModel = await notificationModel.findOne<NotificationModel>(filter)

        logger.info(`End mongo.notification.getNotificationRepo, "output": ${JSON.stringify(notiModel)}`)
        return notiModel
    }

    async createNotificationRepo(noti: Notification) {
        logger.info(`Start mongo.notification.createNotificationRepo, "input": ${JSON.stringify(noti)}`)

        noti.notiUUID = uuid()
        await notificationModel.create(newNotificationModel(noti))

        logger.info(`End mongo.notification.createNotificationRepo, "output": ${JSON.stringify({ notiUUID: noti.userUUID })}`)
        return noti.notiUUID
    }

    async updateNotificationRepo(noti: Notification, action: 'push' | 'pop') {
        logger.info(`Start mongo.notification.updateNotificationRepo, "input": ${JSON.stringify({noti, action})}`)

        const set: UpdateQuery<any> = { $set: { notiBody: noti.notiBody } }
        if (action === 'push') {
            set.$addToSet = { notiUserUUIDs: noti.notiUserUUID }
        } else {
            set.$pull = { notiUserUUIDs: noti.notiUserUUID, notiReadUserUUIDs: noti.notiUserUUID }
        }

        await notificationModel.updateOne({ notiUUID: noti.notiUUID! }, set)

        logger.info(`End mongo.notification.updateNotificationRepo`)
    }

    async deleteNotificationRepo(notiUUID: string) {
        logger.info(`Start mongo.notification.deleteNotificationRepo, "input": ${JSON.stringify({notiUUID})}`)

        await notificationModel.deleteOne({ notiUUID })

        logger.info(`End mongo.notification.deleteNotificationRepo`)
    }

    async readNotificationRepo(notiUUID: string) {
        logger.info(`Start mongo.notification.readNotificationRepo, "input": ${JSON.stringify({notiUUID})}`)

        await notificationModel.updateOne({ notiUUID }, { $set: { notiReadUserUUIDs: '$notiUserUUIDs', updatedAt: new Date() } })

        logger.info(`End mongo.notification.readNotificationRepo`)
    }

    async countUnreadNotificationRepo(userUUID: string) {
        logger.info(`Start mongo.notification.countUnreadNotificationRepo, "input": ${JSON.stringify({userUUID})}`)

        const count = await notificationModel.countDocuments({ userUUID, $expr : { $ne : [ {$size : "$notiUserUUIDs"}, {$size : "$notiReadUserUUIDs"} ] } })

        logger.info(`End mongo.notification.countUnreadNotificationRepo, "output": ${JSON.stringify({count})}`)
        return count
    }
}