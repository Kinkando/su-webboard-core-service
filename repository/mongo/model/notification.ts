import { Notification } from '../../../model/notification';
import { model, Schema, Model, Document } from 'mongoose';

const notificationCollection = "Notification"

export interface NotificationModel {
    notiUUID: string
    notiBody: string
    forumUUID?: string
    commentUUID?: string
    replyCommentUUID?: string
    announcementUUID?: string
    followerUserUUID?: string
    notiUserUUIDs: string[] // noti by userUUIDs ?
    notiReadUserUUIDs: string[] // read noti that includes all of userUUID list
    userUUID: string
    createdAt?: Date
    updatedAt?: Date
}

interface INotification extends Document {
    notiUUID: string
    notiBody: string
    forumUUID?: string
    commentUUID?: string
    replyCommentUUID?: string
    announcementUUID?: string
    followerUserUUID?: string
    notiUserUUIDs: string[] // noti by userUUIDs ?
    notiReadUserUUIDs: string[] // read noti that includes all of userUUID list
    userUUID: string
    createdAt?: Date
    updatedAt?: Date
}

const notificationSchema: Schema = new Schema(
    {
        notiUUID: { type: String, unique: true, required: true },
        notiBody: { type: String, unique: false, required: true },
        forumUUID: { type: String, unique: false, required: false },
        commentUUID: { type: String, unique: false, required: false },
        replyCommentUUID: { type: String, unique: false, required: false },
        announcementUUID: { type: String, unique: false, required: false },
        followerUserUUID: { type: String, unique: false, required: false },
        notiUserUUIDs: { type: Array<String>, unique: false, required: true },
        notiReadUserUUIDs: { type: Array<String>, unique: false, required: false },
        userUUID: { type: String, required: true },
        createdAt: { type: Date, required: false },
        updatedAt: { type: Date, required: false },
    },
    {
        versionKey: false, // You should be aware of the outcome after set to false
    }
);

const notification: Model<INotification> = model(notificationCollection, notificationSchema, notificationCollection) as any;

export default notification

export function newNotificationModel(noti: Notification): NotificationModel {
    return {
        notiUUID: noti.notiUUID!,
        notiBody: noti.notiBody,
        forumUUID: noti.forumUUID,
        commentUUID: noti.commentUUID,
        replyCommentUUID: noti.replyCommentUUID,
        announcementUUID: noti.announcementUUID,
        followerUserUUID: noti.followerUserUUID,
        notiUserUUIDs: [noti.notiUserUUID],
        notiReadUserUUIDs: [],
        userUUID: noti.userUUID,
        createdAt: new Date(),
    }
}