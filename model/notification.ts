import { Pagination } from "./common"

export interface NotificationView {
    notiUUID: string
    notiBody: string
    notiUserUUID: string
    notiUserDisplayName: string
    notiUserImageURL: string
    notiLink: string
    notiAt: Date
    isRead: boolean
    userUUID: string
    notiUserUUIDs?: string[] // db only
    isAnonymous?: boolean // db only
    forumUUID?: string // db only
    commentUUID?: string // db only
    replyCommentUUID?: string // db only
    announcementUUID?: string // db only
    followerUserUUID?: string // db only
}

export interface Notification {
    notiUUID?: string
    notiBody: string
    notiLink?: string
    notiUserUUID: string // noti by userUUID ?
    notiAt?: Date
    userUUID: string
    forumUUID?: string // db only
    commentUUID?: string // db only
    replyCommentUUID?: string // db only
    announcementUUID?: string // db only
    followerUserUUID?: string // db only
}

export interface FilterNotification extends Pagination {
    isRead?: 'all' | 'unread' | 'read'
}

export enum NotificationBody {
    LikeForum = 'ถูกใจกระทู้ของคุณ',
    LikeComment = 'ถูกใจความคิดเห็นของคุณ',
    NewForum = 'สร้างกระทู้ใหม่',
    NewComment = 'แสดงความคิดเห็นบนกระทู้ของคุณ',
    NewReplyComment = 'ตอบกลับความคิดเห็นของคุณ',
    NewAnnouncement = 'มีประกาศใหม่จากทางมหาวิทยาลัย',
}

export function mapNotiLink(data: {announcementUUID?: string, forumUUID?: string, commentUUID?: string, replyCommentUUID?: string, followerUserUUID?: string}): string {
    if (data.followerUserUUID) {
        return '/profile/' + data.followerUserUUID
    } else if (data.announcementUUID) {
        return '/announcement/' + data.announcementUUID
    }
    let link = ""
    if (data.forumUUID) {
        link = '/forum/' + data.forumUUID
    }
    if (data.commentUUID) {
        link += '?commentUUID=' + data.commentUUID
    }
    if (data.replyCommentUUID) {
        link += '&replyCommentUUID=' + data.replyCommentUUID
    }
    return link
}