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
    followerUserUUID?: string // db only
}

// delete user/comment/forum => delete notification

export function mapNotiLink(data: {forumUUID?: string, commentUUID?: string, replyCommentUUID?: string, followerUserUUID?: string}): string {
    if (data.followerUserUUID) {
        return '/profile/' + data.followerUserUUID
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