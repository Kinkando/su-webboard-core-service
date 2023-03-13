import * as admin from 'firebase-admin';
import { CloudStorage } from '@cloud/google/storage';
import { SendGrid } from "@cloud/sendgrid/sendgrid";
import { FilterUser, User } from "@model/user";
import { UserRepository } from "@repository/mongo/user_repository";
import logger from "@util/logger";


export function newUserService(repository: UserRepository, firebase: admin.app.App, storage: CloudStorage, sendgrid: SendGrid) {
    return new UserService(repository, firebase, storage, sendgrid)
}

interface Service {
    getUser(filter: FilterUser): Promise<User>
    getUsers(search: string, limit: number, offset: number): Promise<{ total: number, data: User[] }>
    createUser(user: User): void
    updateUser(user: User): void
    deleteUser(userUUID: string): void
    isExistEmail(email: string): Promise<boolean>
    resetPassword(tokenID: string): void
}

export class UserService implements Service {
    constructor(
        private repository: UserRepository,
        private firebase: admin.app.App,
        private storage: CloudStorage,
        private sendgrid: SendGrid,
    ) {}

    async getUser(filter: FilterUser) {
        logger.info(`Start service.user.getUser, "input": %s`, JSON.stringify(filter))

        let user = await this.repository.getUser(filter);

        logger.info(`End service.user.getUser, "output": %s`, JSON.stringify(user))
        return user
    }

    async resetPassword(tokenID: string) {
        logger.info(`Start service.user.resetPassword, "input": {"tokenID": "%s"}`, tokenID)

        this.sendgrid.sendEmailTemplate("")

        logger.info(`End service.user.resetPassword`)
    }

    async getUsers(search: string, limit: number, offset: number) {
        logger.info(`Start service.user.getUsers, "input": {"search": "%s", "limit": %d, "offset": %d}`, search, limit, offset)

        const users = await this.repository.getUsers(search, limit, offset)

        logger.info(`End service.user.getUsers, "output": {"total": %d, "data.length": %d}`, users?.total || 0, users?.data?.length || 0)
        return users
    }

    async createUser(user: User) {
        logger.info(`Start service.user.createUser, "input": %s`, JSON.stringify(user))

        const firebaseUser = await this.firebase.auth().createUser({
            email: user.userEmail,
            password: user.studentID || user.userEmail?.substring(0, user.userEmail?.indexOf("@")) || "test123!",
        })

        user.userDisplayName = user.userFullName
        user.userImageURL = this.storage.publicURL("user/avatar-1.png")
        user.isAnonymous = false
        user.firebaseID = firebaseUser.uid
        await this.repository.createUser(user);

        logger.info(`End service.user.createUser`)
        return user
    }

    async updateUser(user: User) {
        logger.info(`Start service.user.updateUser, "input": %s`, JSON.stringify(user))

        const u = await this.repository.getUser({ userUUID: user.userUUID })
        if (!u || !u.userUUID) {
            throw Error('user is not found')
        }

        if (user.userEmail && u.userEmail! !== user.userEmail!) {
            const isExistEmail = await this.repository.isExistEmail(user.userEmail!)
            if (isExistEmail) {
                throw Error(`email: ${user.userEmail} is exist`)
            }
            await this.firebase.auth().updateUser(u.firebaseID!, { email: user.userEmail })
        }

        await this.repository.updateUser(user);

        logger.info(`End service.user.updateUser`)
        return user
    }

    async deleteUser(userUUID: string) {
        logger.info(`Start service.user.deleteUser, "input": %s`, userUUID)

        const u = await this.repository.getUser({ userUUID })
        if (!u || !u.userUUID) {
            throw Error('user is not found')
        }

        // remove userImageURL from cloud storage

        await this.firebase.auth().deleteUser(u.firebaseID!)

        await this.repository.deleteUser(userUUID);

        logger.info(`End service.user.deleteUser`)
    }

    async isExistEmail(email: string) {
        logger.info(`Start service.user.isExistEmail, "input": "%s"`, email)

        const isExist = await this.repository.isExistEmail(email);

        logger.info(`End service.user.isExistEmail, "output": ${isExist}`)
        return isExist
    }
}
