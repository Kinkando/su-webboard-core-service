import { StorageConfiguration } from '../../config/config';
import * as admin from 'firebase-admin';
import stream, { Readable } from 'stream';
import { v4 as uuid } from 'uuid';

export function newCloudStorage(firebase: admin.app.App, config: StorageConfiguration) {
    return new CloudStorage(firebase.storage(), config)
}

export interface File {
    fieldname: string
    originalname: string
    encoding: string
    mimetype: string
    size: number
    stream: Readable
    destination: string
    filename: string
    path: string
    buffer: Buffer
}

interface Service {
    uploadFile(file: File, folder: string): string
    deleteFile(fileName: string): void
    signedURL(fileName: string): Promise<string>
    publicURL(fileName: string): string
    copyFile(from: string, to: string): void
}

export class CloudStorage implements Service {
    private bucketName!: string
    private expireTime!: number
    constructor(private storage: admin.storage.Storage, config: StorageConfiguration) {
        this.bucketName = config.bucketName
        this.expireTime = config.expireTime
    }

    uploadFile(file: File, folder: string): string {
        const fileName = `${folder}/${uuid()}.${file.originalname.substring(file.originalname.lastIndexOf(".")+1)}`

        const passthroughStream = new stream.PassThrough()
        passthroughStream.write(file.buffer)
        passthroughStream.end()
        passthroughStream.pipe(this.storage.bucket(this.bucketName).file(fileName).createWriteStream())

        return fileName
    }

    async deleteFile(fileName: string) {
        await this.storage.bucket(this.bucketName).file(fileName).delete()
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

    async copyFile(from: string, to: string) {
        const src = this.storage.bucket(this.bucketName).file(from)
        const dsc = this.storage.bucket(this.bucketName).file(to)
        await src.copy(dsc)
    }
}