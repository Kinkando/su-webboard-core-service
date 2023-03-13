import { StorageConfiguration } from '@config/config';
import * as admin from 'firebase-admin';

export function newCloudStorage(firebase: admin.app.App, config: StorageConfiguration) {
    return new CloudStorage(firebase.storage(), config)
}

interface Service {
    upload(): void
    signedURL(): string
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

    signedURL(): string {
        return ""
    }

    publicURL(fileName: string): string {
        const baseURL = "https://storage.googleapis.com"
        return `${baseURL}/${this.bucketName}/${fileName}`
    }
}