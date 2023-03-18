export interface CommentView {
    forumUUID: string
    commentUUID: string
    replyCommentUUID?: string
    commentText: string
    commentImageURLs?: string[]
    commenterUUID: string
    commenterName: string
    commenterImageURL: string
    isLike: boolean
    likeCount: number
    // commentCount: number
    createdAt: Date
    likeUserUUIDs?: string[] // db only
    replyComments?: CommentView[]
}

export interface Comment {
    forumUUID: string
    commentUUID?: string
    replyCommentUUID?: string
    commentText: string
    commentImageURLs?: string[]
    commenterUUID: string
}
