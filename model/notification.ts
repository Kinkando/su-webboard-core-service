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
    notiType?: number // db only
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
    notiType: NotificationType
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
    FollowingUser = 'กำลังติดตามคุณ',
}

export enum NotificationType {
    LikeForum = 1,
    LikeComment = 2,
    NewForum = 3,
    NewComment = 4,
    NewReplyComment = 5,
    NewAnnouncement = 6,
    FollowingUser = 7,
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

export function mapNotiBody(notiType: number): string {
    switch(notiType) {
        case NotificationType.LikeForum: return NotificationBody.LikeForum
        case NotificationType.LikeComment: return NotificationBody.LikeComment
        case NotificationType.NewForum: return NotificationBody.NewForum
        case NotificationType.NewComment: return NotificationBody.NewComment
        case NotificationType.NewReplyComment: return NotificationBody.NewReplyComment
        case NotificationType.NewAnnouncement: return NotificationBody.NewAnnouncement
        case NotificationType.FollowingUser: return NotificationBody.FollowingUser
        default: return ''
    }
}