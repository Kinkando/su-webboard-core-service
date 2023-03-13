export interface AccessToken {
    userType: UserType
    userUUID: string
    sessionUUID: string
    type: 'access'
}

export interface RefreshToken {
    userType: UserType
    userUUID: string
    sessionUUID: string
    type: 'refresh'
}

export interface Profile {
    userType: UserType
    userUUID: string
}

export type UserType = 'adm' | 'std' | 'tch'