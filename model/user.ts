import { UserType } from "./authen"
import { Pagination } from "./common"

export interface User {
    userUUID?: string
    userType?: UserType
    userDisplayName?: string
    userFullName?: string
    userEmail?: string
    studentID?: string
    userImageURL?: string
    isAnonymous?: boolean
    firebaseID?: string
    isLinkGoogle?: boolean
    lastLogin?: Date
}

export interface FilterUser {
    userUUID?: string
    firebaseID?: string
    userEmail?: string
}

export interface UserPagination extends Pagination {
    userType?: string
}