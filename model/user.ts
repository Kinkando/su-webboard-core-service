import { UserType } from "./authen"

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
}

export interface FilterUser {
    userUUID?: string
    firebaseID?: string
}

export interface UserPagination {
    search?: string
    userType?: string
    limit: number
    offset: number
}