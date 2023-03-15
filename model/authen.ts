import { JwtPayload } from "jsonwebtoken"

export interface AccessToken extends JwtPayload {
    userType: UserType
    userUUID: string
    sessionUUID: string
    type: 'access'
}

export interface RefreshToken extends JwtPayload {
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