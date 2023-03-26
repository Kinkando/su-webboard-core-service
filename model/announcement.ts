import type { Document, Pagination } from "./common"

export interface Announcement {
    announcementUUID?: string
    title: string
    description: string
    announcementImages?: Document[]
    authorUUID: string
}

export interface AnnouncementView extends Announcement {
    authorName: string
    authorImageURL: string
    createdAt?: Date
    updatedAt?: Date
    seeCount?: number
}

export interface FilterAnnouncement extends Pagination {
    userUUID?: string
}