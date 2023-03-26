import { Document } from "./common"

export interface CommentView {
    forumUUID: string
    commentUUID: string
    replyCommentUUID?: string
    commentText: string
    commentImages?: Document[]
    commenterUUID: string
    commenterName: string
    commenterImageURL: string
    isLike: boolean
    likeCount: number
    // commentCount: number
    createdAt: Date
    updatedAt?: Date
    likeUserUUIDs?: string[] // db only
    replyComments?: CommentView[]
    isAnonymous?: boolean // db only
}

export interface Comment {
    forumUUID: string
    commentUUID?: string
    replyCommentUUID?: string
    commentText: string
    commentImages?: Document[]
    commenterUUID: string
    isAnonymous?: boolean // db only
}
