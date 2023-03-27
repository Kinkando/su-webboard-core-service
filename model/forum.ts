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
    commentCount?: number
    ranking?: number
    isFavorite?: boolean // db only
    favoriteUserUUIDs?: string[] // db only
    likeUserUUIDs?: string[] // db only
    isAnonymous?: boolean // db only
    createdAt?: Date
    updatedAt?: Date
}

export interface Forum {
    forumUUID?: string
    title: string
    description: string
    categoryIDs: number[]
    forumImages?: Document[]
    authorUUID: string
    isAnonymous?: boolean // db only
}

export interface FilterForum extends Pagination {
    categoryID?: number
    userUUID?: string
    selfUUID?: string
    favoriteUserUUID?: string
}
