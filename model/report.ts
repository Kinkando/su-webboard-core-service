import { Category } from "./category"
import { Pagination } from "./common"

export enum ReportStatus {
    Pending = 'pending',
    Resolved = 'resolved',
    Rejected = 'rejected',
    Invalid = 'invalid',
}

export interface Report {
    reportUUID?: string
    reporterUUID: string
    plaintiffUUID: string
    reportReason: string
    reportStatus: ReportStatus
    forumUUID: string
    commentUUID?: string
    replyCommentUUID?: string
}

export interface ReportView {
    reportUUID: string
    reporter: PersonInfo
    plaintiff: PersonInfo
    reportReason: string
    reportStatus: ReportStatus
    type: 'กระทู้' | 'ความคิดเห็น'
}

export interface PersonInfo {
    uuid: string
    name: string
    imageURL: string
}

export interface ReportDetail {
    reportUUID: string
    categories?: Category[]
    title?: string
    description?: string
    imageURLs?: string[]
    userUUID?: string
    userDisplayName?: string
    userImageURL?: string
    createdAt: Date
    updatedAt: Date
}

export interface FilterReport extends Pagination {
    reportStatus: ReportStatus
    type: 'forum' | 'comment'
}