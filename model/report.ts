import { Category } from "./category"
import { Pagination } from "./common"

export enum ReportStatus {
    Pending = 'pending',
    Resolved = 'resolved',
    Rejected = 'rejected',
    Invalid = 'invalid', // author/commenter is delete forum/comment him self before resolved by admin
    Closed = 'closed', // related same forum/comment report that resolved before
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
    reportCode?: string
}

export interface ReportView {
    reportUUID: string
    reportReason: string
    reportStatus: ReportStatus
    reportCode: string
    refReportCode?: string
    type: 'กระทู้' | 'ความคิดเห็น'
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