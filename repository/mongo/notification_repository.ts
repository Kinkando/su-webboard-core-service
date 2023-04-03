import * as mongoDB from "mongodb";
import notificationModel, { NotificationModel, newNotificationModel } from './model/notification'
import { Pagination } from "../../model/common";
import { Notification, NotificationView } from "../../model/notification";
import logger from "../../util/logger";
import { v4 as uuid } from "uuid";
import { FilterQuery, UpdateQuery } from "mongoose";
import { UserCollection } from "./user_repository";
import { ForumCollection } from "./forum_repository";

export function newNotificationRepository(db: mongoDB.Db) {
    return new NotificationRepository(db)
}

export const NotificationCollection = "Notification"

interface Repository {
    getNotificationsPaginationRepo(query: Pagination, userUUID: string): Promise<{ total: number, data: NotificationView[] }>
    getNotificationDetailRepo(notiUUID: string): Promise<NotificationView>
    getNotificationRepo(noti: Notification): Promise<NotificationModel | null>
    createNotificationRepo(noti: Notification): Promise<string>
    updateNotificationRepo(noti: Notification, action: 'push' | 'pop'): void
    deleteNotificationRepo(noti: Notification): void
    readNotificationRepo(notiUUID: string, notiUserUUIDs: string[]): void
    countUnreadNotificationRepo(userUUID: string): Promise<number>
}

export class NotificationRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getNotificationsPaginationRepo(query: Pagination, userUUID: string) {
        logger.info(`Start mongo.notification.getNotificationsPaginationRepo, "input": ${JSON.stringify({query, userUUID})}`)

        const res = (await notificationModel.aggregate<{ total: number, data: NotificationModel[] }>([
            {$match: { userUUID }},
            {$sort: { createdAt: -1 }},
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

        logger.info(`End mongo.notification.getNotificationsPaginationRepo, "output": ${JSON.stringify(res)}`)
        return res
    }

    async getNotificationDetailRepo(notiUUID: string): Promise<NotificationView> {
        logger.info(`Start mongo.notification.getNotificationDetailRepo, "input": ${JSON.stringify({notiUUID})}`)

        const res = (await notificationModel.aggregate<NotificationModel>([
            {$match: { notiUUID }},
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
        ])).map(noti => {
            const notiData = noti as any
            notiData.isAnonymous = notiData.forums?.length === 1 && notiData.forums[0].isAnonymous && notiData.forums[0].authorUUID === notiData.user.userUUID
            notiData.isRead = notiData.notiUserUUIDs?.length === notiData.notiReadUserUUIDs?.length || false
            notiData.notiAt = noti.createdAt
            delete notiData._id
            delete notiData.user
            delete notiData.forums
            delete notiData.notiReadUserUUIDs
            delete noti.createdAt
            delete noti.updatedAt
            return notiData as NotificationView
        })[0]

        logger.info(`End mongo.notification.getNotificationDetailRepo, "output": ${JSON.stringify(res)}`)
        return res
    }

    async getNotificationRepo(noti: Notification) {
        logger.info(`Start mongo.notification.getNotificationRepo, "input": ${JSON.stringify(noti)}`)

        let filter: FilterQuery<any> = { $and: [] }
        if (noti.userUUID) {
            filter.$and?.push({userUUID: noti.userUUID})
        }
        if (noti.announcementUUID) {
            filter.$and?.push({announcementUUID: noti.announcementUUID})
        }
        if (noti.forumUUID) {
            filter.$and?.push({forumUUID: noti.forumUUID})
        }
        if (noti.commentUUID) {
            filter.$and?.push({commentUUID: noti.commentUUID})
        }
        if (noti.replyCommentUUID) {
            filter.$and?.push({replyCommentUUID: noti.replyCommentUUID})
        }
        if (noti.followerUserUUID) {
            filter.$and?.push({followerUserUUID: noti.followerUserUUID})
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

        let set: UpdateQuery<any> = {}
        if (action === 'push') {
            set = { $addToSet: { notiUserUUIDs: noti.notiUserUUID }, $set: { createdAt: new Date() } }
        } else {
            set = { $pull: { notiUserUUIDs: noti.notiUserUUID, notiReadUserUUIDs: noti.notiUserUUID } }
        }

        await notificationModel.updateOne({ notiUUID: noti.notiUUID! }, set)

        logger.info(`End mongo.notification.updateNotificationRepo`)
    }

    async deleteNotificationRepo(noti: Notification) {
        logger.info(`Start mongo.notification.deleteNotificationRepo, "input": ${JSON.stringify(noti)}`)

        await notificationModel.deleteMany(noti)

        logger.info(`End mongo.notification.deleteNotificationRepo`)
    }

    async readNotificationRepo(notiUUID: string, notiUserUUIDs: string[]) {
        logger.info(`Start mongo.notification.readNotificationRepo, "input": ${JSON.stringify({notiUUID, notiUserUUIDs})}`)

        await notificationModel.updateOne({ notiUUID }, { $set: { notiReadUserUUIDs: notiUserUUIDs, updatedAt: new Date() } })

        logger.info(`End mongo.notification.readNotificationRepo`)
    }

    async countUnreadNotificationRepo(userUUID: string) {
        logger.info(`Start mongo.notification.countUnreadNotificationRepo, "input": ${JSON.stringify({userUUID})}`)

        const count = await notificationModel.countDocuments({ userUUID, $expr : { $ne : [ {$size : "$notiUserUUIDs"}, {$size : "$notiReadUserUUIDs"} ] } })

        logger.info(`End mongo.notification.countUnreadNotificationRepo, "output": ${JSON.stringify({count})}`)
        return count
    }
}