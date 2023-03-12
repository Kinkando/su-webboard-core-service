export interface User {
    userUUID: string
    userType: string
    userDisplayName: string
    userFullName: string
    userEmail: string
    studentID?: string
    userImageURL: string
    isAnonymous: boolean
    firebaseID: string
}

export interface FilterUser {
    userUUID?: string
    firebaseID?: string
}