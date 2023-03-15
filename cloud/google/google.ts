import axios from "axios"

export function newGoogleService() {
    return new GoogleService()
}

interface UserProfile {
    sub: string
    name: string
    given_name: string
    family_name: string
    picture: string
    email: string
    email_verified: boolean
    locale: string
    hd: string
}

interface Service {
    getUserProfile(accessToken: string): any
}

export class GoogleService implements Service {
    async getUserProfile(accessToken: string) {
        const res = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?alt=json&access_token=${accessToken}`)
        if (res.status !== 200) {
            throw Error('unable to get user profile from google: invalid request')
        }
        return await res.data as UserProfile
    }
}
