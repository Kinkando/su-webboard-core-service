export interface AccessToken {
    userType: string
    userUUID: string
    sessionUUID: string
    type: 'access'
}

export interface RefreshToken {
    userType: string
    userUUID: string
    sessionUUID: string
    type: 'refresh'
}