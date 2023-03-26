import * as admin from 'firebase-admin';
import { v4 as uuid } from 'uuid';
import { filePath } from '../common/file_path';
import { CloudStorage, File } from '../cloud/google/storage';
import { SendGrid } from "../cloud/sendgrid/sendgrid";
import { FilterUser, User, UserPagination } from "../model/user";
import { UserRepository } from "../repository/mongo/user_repository";
import logger from "../util/logger";

const storageFolder = "user"

export function newUserService(repository: UserRepository, firebase: admin.app.App, storage: CloudStorage, sendgrid: SendGrid) {
    return new UserService(repository, firebase, storage, sendgrid)
}

interface Service {
    // user
    getUserSrv(filter: FilterUser): Promise<User>
    updateUserProfileSrv(user: User, image: File): void
    resetPasswordSrv(tokenID: string): void

    getUsersSrv(query: UserPagination): Promise<{ total: number, data: User[] }>
    createUserSrv(user: User): void
    updateUserSrv(user: User): void
    deleteUsersSrv(userUUIDs: string[]): void
    isExistEmailSrv(email: string): Promise<boolean>
}

export class UserService implements Service {
    constructor(
        private repository: UserRepository,
        private firebase: admin.app.App,
        private storage: CloudStorage,
        private sendgrid: SendGrid,
    ) {}

    async getUserSrv(filter: FilterUser) {
        logger.info(`Start service.user.getUserSrv, "input": ${JSON.stringify(filter)}`)

        let user = await this.repository.getUserRepo(filter);

        if (user?.userImageURL) {
            user.userImageURL = await this.storage.signedURL(user.userImageURL!)
        }

        logger.info(`End service.user.getUserSrv, "output": ${JSON.stringify(user)}`)
        return user
    }

    async updateUserProfileSrv(user: User, image: File) {
        logger.info(`Start service.user.updateUserProfileSrv, "input": ${JSON.stringify(user)}`)

        if (image) {
            const u = await this.repository.getUserRepo({ userUUID: user.userUUID })
            if (!u || !u.userUUID) {
                throw Error('user is not found')
            }
            const { fileName } = await this.storage.uploadFile(image, storageFolder)
            user.userImageURL = fileName
            try { await this.storage.deleteFile(u.userImageURL!) } catch (error) {}
        }

        await this.repository.updateUserRepo(user);

        logger.info(`End service.user.updateUserProfileSrv`)
        return user
    }

    async getUsersSrv(query: UserPagination) {
        logger.info(`Start service.user.getUsersSrv, "input": ${JSON.stringify(query)}`)

        const users = await this.repository.getUsersRepo(query)

        if (users?.data) {
            for (const user of users?.data) {
                user.userImageURL = await this.storage.signedURL(user.userImageURL!)
            }
        }

        logger.info(`End service.user.getUsersSrv, "output": {"total": ${users?.total || 0}, "data.length": ${users?.data?.length || 0}}`)
        return users
    }

    async createUserSrv(user: User) {
        logger.info(`Start service.user.createUserSrv, "input": ${JSON.stringify(user)}`)

        const firebaseUser = await this.firebase.auth().createUser({
            email: user.userEmail,
            password: user.studentID || "test123!",
        })

        user.userDisplayName = user.userFullName
        user.userImageURL = `${storageFolder}/${uuid()}.${filePath.defaultAvatar.substring(filePath.defaultAvatar.lastIndexOf('.')+1)}`
        user.isAnonymous = false
        user.firebaseID = firebaseUser.uid
        await this.storage.copyFile(`${storageFolder}/${filePath.defaultAvatar}`, user.userImageURL)
        await this.repository.createUserRepo(user);

        logger.info(`End service.user.createUserSrv`)
        return user
    }

    async updateUserSrv(user: User) {
        logger.info(`Start service.user.updateUserSrv, "input": ${JSON.stringify(user)}`)

        const u = await this.repository.getUserRepo({ userUUID: user.userUUID })
        if (!u || !u.userUUID) {
            throw Error('user is not found')
        }

        if (user.userEmail && u.userEmail! !== user.userEmail!) {
            const isExistEmail = await this.repository.isExistEmailRepo(user.userEmail!)
            if (isExistEmail) {
                throw Error(`email: ${user.userEmail} is exist`)
            }
            await this.firebase.auth().updateUser(u.firebaseID!, { email: user.userEmail })
        }

        await this.repository.updateUserRepo(user);

        logger.info(`End service.user.updateUserSrv`)
        return user
    }

    async deleteUsersSrv(userUUIDs: string[]) {
        logger.info(`Start service.user.deleteUsersSrv, "input": ${userUUIDs}`)

        userUUIDs.forEach(async(userUUID) => {
            try {
                const u = await this.repository.getUserRepo({ userUUID })
                if (!u || !u.userUUID) {
                    throw Error('user is not found')
                }

                await this.storage.deleteFile(u.userImageURL!)

                await this.firebase.auth().deleteUser(u.firebaseID!)

                await this.repository.deleteUserRepo(userUUID);

            } catch (error) {
                logger.error(error)
            }
        })

        logger.info(`End service.user.deleteUsersSrv`)
    }

    async isExistEmailSrv(email: string) {
        logger.info(`Start service.user.isExistEmailSrv, "input": "${email}"`)

        const isExist = await this.repository.isExistEmailRepo(email);

        logger.info(`End service.user.isExistEmailSrv, "output": ${isExist}`)
        return isExist
    }

    async resetPasswordSrv(tokenID: string) {
        logger.info(`Start service.user.resetPasswordSrv, "input": {"tokenID": "${tokenID}"}`)

        this.sendgrid.sendEmailTemplate("")

        logger.info(`End service.user.resetPasswordSrv`)
    }
}
