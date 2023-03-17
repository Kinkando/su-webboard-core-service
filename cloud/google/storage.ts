import { v4 as uuid } from 'uuid';
import * as admin from 'firebase-admin';
import stream, { Readable } from 'stream';
import { StorageConfiguration } from '../../config/config';

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
    uploadFile(file: File, folder: string): Promise<string>
    deleteFile(fileName: string): void
    signedURL(fileName: string): Promise<string>
    publicURL(fileName: string): string
    copyFile(from: string, to: string): void
    setPublic(fileName: string): void
}

export class CloudStorage implements Service {
    private bucketName!: string
    private expireTime!: number
    constructor(private storage: admin.storage.Storage, config: StorageConfiguration) {
        this.bucketName = config.bucketName
        this.expireTime = config.expireTime
    }

    async uploadFile(fileReq: File, folder: string) {
        const fileName = `${folder}/${uuid()}.${fileReq.originalname.substring(fileReq.originalname.lastIndexOf(".")+1)}`

        await this.storage.bucket(this.bucketName).file(fileName).save(fileReq.buffer)
        return fileName

        // const passthroughStream = new stream.PassThrough()
        // passthroughStream.write(fileReq.buffer)
        // passthroughStream.end()
        // passthroughStream.pipe(this.storage.bucket(this.bucketName).file(fileName).createWriteStream({public: isPublic}))
        // return await new Promise<string>((resolve, reject) => {
        //     passthroughStream.on('error', err => reject(err))
        //     passthroughStream.on('finish', () => {console.log("FINISH"); resolve(fileName)})
        // })
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
        const bucket = this.storage.bucket(this.bucketName)
        const src = bucket.file(from)
        const dsc = bucket.file(to)
        await src.copy(dsc)
    }

    async setPublic(fileName: string) {
        await this.storage.bucket(this.bucketName).file(fileName).makePublic()
    }
}