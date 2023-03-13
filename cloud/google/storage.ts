import { StorageConfiguration } from '@config/config';
import * as admin from 'firebase-admin';

export function newCloudStorage(firebase: admin.app.App, config: StorageConfiguration) {
    return new CloudStorage(firebase.storage(), config)
}

interface Service {
    upload(): void
    signedURL(fileName: string): Promise<string>
    publicURL(fileName: string): string
}

export class CloudStorage implements Service {
    private bucketName!: string
    private expireTime!: number
    constructor(private storage: admin.storage.Storage, config: StorageConfiguration) {
        this.bucketName = config.bucketName
        this.expireTime = config.expireTime
    }

    upload() {

    }

    async signedURL(fileName: string) {
        const res = await this.storage.bucket(this.bucketName).file(fileName).getSignedUrl({
            action: 'read',
            expires: Date.now() + 1000 * 60 * this.expireTime,
        })
        return res.toString()
    }

    publicURL(fileName: string): string {
        const baseURL = "https://storage.googleapis.com"
        return `${baseURL}/${this.bucketName}/${fileName}`
    }
}