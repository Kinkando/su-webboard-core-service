import * as admin from 'firebase-admin';
import { User } from "@model/user";
import { UserRepository } from "@repository/mongo/user_repository";
import logger from "@util/logger";
import { CloudStorage } from '@cloud/google/storage';

export function newAdminService(userRepository: UserRepository, firebase: admin.app.App, storage: CloudStorage) {
    return new AdminService(userRepository, firebase, storage)
}

interface Service {
    getUsers(search: string, limit: number, offset: number): Promise<{ total: number, data: User[] }>
    createUser(user: User): void
    updateUser(user: User): void
    isExistEmail(email: string): Promise<boolean>
}

export class AdminService implements Service {
    constructor(
        private repository: UserRepository,
        private firebase: admin.app.App,
        private storage: CloudStorage,
    ) {}

    async getUsers(search: string, limit: number, offset: number) {
        logger.info(`Start service.admin.getUsers, "input": {"search": "%s", "limit": %d, "offset": %d}`, search, limit, offset)

        const users = await this.repository.getUsers(search, limit, offset)

        logger.info(`End service.admin.getUsers, "output": {"total": %d, "data.length": %d}`, users?.total || 0, users?.data?.length || 0)
        return users
    }

    async createUser(user: User) {
        logger.info(`Start service.admin.createUser, "input": %s`, JSON.stringify(user))

        const firebaseUser = await this.firebase.auth().createUser({
            email: user.userEmail,
            password: user.studentID || user.userEmail?.substring(0, user.userEmail?.indexOf("@")) || "test123!",
        })

        user.userDisplayName = user.userFullName
        user.userImageURL = this.storage.publicURL("user/avatar-1.png")
        user.isAnonymous = false
        user.firebaseID = firebaseUser.uid
        await this.repository.createUser(user);

        logger.info(`End service.admin.createUser`)
        return user
    }

    async updateUser(user: User) {
        logger.info(`Start service.admin.updateUser, "input": %s`, JSON.stringify(user))

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

        logger.info(`End service.admin.updateUser`)
        return user
    }

    async isExistEmail(email: string) {
        logger.info(`Start service.admin.isExistEmail, "input": "%s"`, email)

        const isExist = await this.repository.isExistEmail(email);

        logger.info(`End service.admin.isExistEmail, "output": ${isExist}`)
        return isExist
    }
}