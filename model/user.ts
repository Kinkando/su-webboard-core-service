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
    firebaseID?: string
    lastLogin?: Date
    followerUserUUIDs?: string[] // db only
    followingUserUUIDs?: string[] // db only
    notiUserUUIDs?: string[] // db only
    isFollowing?: boolean
    isSelf?: boolean
    isNoti?: boolean
}

export interface FilterUser {
    userUUID?: string
    firebaseID?: string
    userEmail?: string
}

export interface UserPagination extends Pagination {
    userType?: string
}

export interface FollowUserPagination extends Pagination {
    userUUID: string
    type: string
}