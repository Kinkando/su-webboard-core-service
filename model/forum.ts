import { Category } from "./category"
import { Document, Pagination } from "./common"

export interface ForumView {
    forumUUID: string
    title: string
    description: string
    forumImages?: Document[]
    categories?: Category[]
    authorUUID: string
    authorName: string
    authorImageURL: string
    isLike: boolean
    likeCount?: number
    // commentCount?: number
    ranking?: number
    likeUserUUIDs?: string[] // db only
    createdAt?: Date
}

export interface Forum {
    forumUUID?: string
    title: string
    description: string
    categoryIDs: number[]
    forumImages?: Document[]
    authorUUID: string
}

export interface FilterForum extends Pagination {
    categoryID?: number
    sortBy?: string
}
