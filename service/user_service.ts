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
    getUserSrv(filter: FilterUser): Promise<User>
    getUsersSrv(search: string, limit: number, offset: number): Promise<{ total: number, data: User[] }>
    createUserSrv(user: User): void
    updateUserSrv(user: User): void
    deleteUserSrv(userUUID: string): void
    isExistEmailSrv(email: string): Promise<boolean>
    resetPasswordSrv(tokenID: string): void
}

export class UserService implements Service {
    constructor(
        private repository: UserRepository,
        private firebase: admin.app.App,
        private storage: CloudStorage,
        private sendgrid: SendGrid,
    ) {}

    async getUserSrv(filter: FilterUser) {
        logger.info(`Start service.user.getUserSrv, "input": %s`, JSON.stringify(filter))

        let user = await this.repository.getUserRepo(filter);

        logger.info(`End service.user.getUserSrv, "output": %s`, JSON.stringify(user))
        return user
    }

    async getUsersSrv(search: string, limit: number, offset: number) {
        logger.info(`Start service.user.getUsersSrv, "input": {"search": "%s", "limit": %d, "offset": %d}`, search, limit, offset)

        const users = await this.repository.getUsersRepo(search, limit, offset)

        logger.info(`End service.user.getUsersSrv, "output": {"total": %d, "data.length": %d}`, users?.total || 0, users?.data?.length || 0)
        return users
    }

    async createUserSrv(user: User) {
        logger.info(`Start service.user.createUserSrv, "input": %s`, JSON.stringify(user))

        const firebaseUser = await this.firebase.auth().createUser({
            email: user.userEmail,
            password: user.studentID || user.userEmail?.substring(0, user.userEmail?.indexOf("@")) || "test123!",
        })

        user.userDisplayName = user.userFullName
        user.userImageURL = this.storage.publicURL("user/avatar-1.png")
        user.isAnonymous = false
        user.firebaseID = firebaseUser.uid
        await this.repository.createUserRepo(user);

        logger.info(`End service.user.createUserSrv`)
        return user
    }

    async updateUserSrv(user: User) {
        logger.info(`Start service.user.updateUserSrv, "input": %s`, JSON.stringify(user))

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

    async deleteUserSrv(userUUID: string) {
        logger.info(`Start service.user.deleteUserSrv, "input": %s`, userUUID)

        const u = await this.repository.getUserRepo({ userUUID })
        if (!u || !u.userUUID) {
            throw Error('user is not found')
        }

        // remove userImageURL from cloud storage

        await this.firebase.auth().deleteUser(u.firebaseID!)

        await this.repository.deleteUserRepo(userUUID);

        logger.info(`End service.user.deleteUserSrv`)
    }

    async isExistEmailSrv(email: string) {
        logger.info(`Start service.user.isExistEmailSrv, "input": "%s"`, email)

        const isExist = await this.repository.isExistEmailRepo(email);

        logger.info(`End service.user.isExistEmailSrv, "output": ${isExist}`)
        return isExist
    }

    async resetPasswordSrv(tokenID: string) {
        logger.info(`Start service.user.resetPasswordSrv, "input": {"tokenID": "%s"}`, tokenID)

        this.sendgrid.sendEmailTemplate("")

        logger.info(`End service.user.resetPasswordSrv`)
    }
}
