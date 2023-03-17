import { Category } from "./category"
import { Pagination } from "./common"

export interface ForumView {
    forumUUID: string
    title: string
    description: string
    forumImageURLs?: string[]
    categories?: Category[]
    authorUUID: string
    authorName: string
    authorImageURL: string
    isLike: boolean
    likeCount?: number
    commentCount?: number
    ranking?: number
    likeUserUUIDs?: string[]
    createdAt?: Date
}

export interface Forum {
    forumUUID?: string
    title: string
    description: string
    categoryIDs: number[]
    forumImageURLs?: string[]
    authorUUID: string
}

export interface FilterForum extends Pagination {
    categoryID?: number
    sortBy?: string
    userUUID: string
}
