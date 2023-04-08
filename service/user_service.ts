import { Auth } from 'firebase-admin/lib/auth/auth';
import { v4 as uuid } from 'uuid';
import { filePath } from '../common/file_path';
import { CloudStorage, File } from '../cloud/google/storage';
import { FilterUser, FollowUserPagination, User, UserPagination } from "../model/user";
import { UserRepository } from "../repository/mongo/user_repository";
import logger from "../util/logger";

const storageFolder = "user"

export function newUserService(defaultPassword: string, repository: UserRepository, firebaseAuth: Auth, storage: CloudStorage) {
    return new UserService(defaultPassword, repository, firebaseAuth, storage)
}

interface Service {
    // user
    getFollowUsersSrv(query: FollowUserPagination, userUUID: string): Promise<{ total: number, data: User[] }>
    getUserProfileSrv(filter: FilterUser): Promise<User>
    updateUserProfileSrv(user: User, image: File): void
    followingUserSrv(followingByUserUUID: string, followingToUserUUID: string, isFollowing: boolean): void
    notiUserSrv(userUUID: string, notiUserUUID: string, isNoti: boolean): void
    getUsersSrv(query: {userUUIDs?: string[], notiUserUUID?: string, userType?: string}): Promise<User[]>

    getUsersPaginationSrv(query: UserPagination): Promise<{ total: number, data: User[] }>
    createUserSrv(user: User): void
    updateUserSrv(user: User): void
    deleteUserSrv(userUUID: string): void
    isExistEmailSrv(email: string): Promise<boolean>
    registerUserSrv(user: User): Promise<string>
}

export class UserService implements Service {
    constructor(
        private defaultPassword: string,
        private repository: UserRepository,
        private firebaseAuth: Auth,
        private storage: CloudStorage,
    ) {}

    async getFollowUsersSrv(query: FollowUserPagination, userUUID: string) {
        logger.info(`Start service.user.getFollowUsersSrv, "input": ${JSON.stringify({query, userUUID})}`)

        const selfUser = await this.repository.getUserRepo({ userUUID })
        if (!selfUser) {
            logger.error('user is not found')
            throw Error('user is not found')
        }

        const userReq = await this.repository.getUserRepo({ userUUID: query.userUUID })
        if (!userReq) {
            logger.error('user is not found')
            throw Error('user is not found')
        }

        let followUserUUIDs = query.type === 'following' ? userReq.followingUserUUIDs : userReq.followerUserUUIDs
        if (followUserUUIDs) {
            followUserUUIDs = followUserUUIDs.sort((a, b) => (selfUser.followingUserUUIDs?.includes(a) ? -1 : 1))
            const index = followUserUUIDs.findIndex(followUserUUID => followUserUUID === userUUID)
            if (index !== -1) {
                followUserUUIDs = followUserUUIDs.filter(followUserUUID => followUserUUID !== userUUID)
                followUserUUIDs.unshift(userUUID)
            }
        }
        const userUUIDs = followUserUUIDs?.slice(query.offset, query.offset + query.limit)

        let users: User[] = []
        if (userUUIDs?.length) {
            users = await this.repository.getUsersRepo({userUUIDs});

            if (users) {
                for (const user of users) {
                    user.userImageURL = await this.storage.signedURL(user.userImageURL!)
                    if (user.userUUID !== userUUID) {
                        user.isFollowing = selfUser.followingUserUUIDs?.includes(user.userUUID!) || false
                    } else {
                        user.isSelf = true
                    }

                    delete (user as any)._id
                    delete (user as any).createdAt
                    delete (user as any).updatedAt
                    delete user.firebaseID
                    delete user.lastLogin
                    delete user.followerUserUUIDs
                    delete user.followingUserUUIDs
                    delete user.notiUserUUIDs
                }
            }
        }

        let data: User[] = [];
        const total = userUUIDs?.length || 0
        if (total) {
            userUUIDs?.forEach(userUUID => data.push(users?.find(user => user.userUUID! === userUUID)!))
        }

        const res = { total, data }

        logger.info(`End service.user.getFollowUsersSrv, "output": {"total": ${res?.total || 0}, "data.length": ${res?.data?.length || 0}}`)
        return res
    }

    async getUserProfileSrv(filter: FilterUser) {
        logger.info(`Start service.user.getUserProfileSrv, "input": ${JSON.stringify(filter)}`)

        let user = await this.repository.getUserRepo(filter);

        if (user?.userImageURL) {
            user.userImageURL = await this.storage.signedURL(user.userImageURL!)
        }

        logger.info(`End service.user.getUserProfileSrv, "output": ${JSON.stringify(user)}`)
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

    async followingUserSrv(followingByUserUUID: string, followingToUserUUID: string, isFollowing: boolean) {
        logger.info(`Start service.user.followingUserSrv, "input": ${JSON.stringify({followingByUserUUID, followingToUserUUID, isFollowing})}`)

        await this.repository.followingUserRepo(followingByUserUUID, followingToUserUUID, isFollowing)

        logger.info(`End service.user.followingUserSrv`)
    }

    async notiUserSrv(userUUID: string, notiUserUUID: string, isNoti: boolean) {
        logger.info(`Start service.user.notiUserSrv, "input": ${JSON.stringify({userUUID, notiUserUUID, isNoti})}`)

        await this.repository.notiUserRepo(userUUID, notiUserUUID, isNoti)

        logger.info(`End service.user.notiUserSrv`)
    }

    async getUsersSrv(query: { userUUIDs?: string[], notiUserUUID?: string, userType?: string }) {
        logger.info(`Start service.user.getUsersSrv, "input": ${JSON.stringify(query)}`)

        const users = await this.repository.getUsersRepo(query)

        logger.info(`End service.user.getUsersSrv, "output": ${JSON.stringify({total: users?.length || 0})}`)
        return users
    }

    async getUsersPaginationSrv(query: UserPagination) {
        logger.info(`Start service.user.getUsersPaginationSrv, "input": ${JSON.stringify(query)}`)

        const users = await this.repository.getUsersPaginationRepo(query)

        if (users?.data) {
            for (const user of users?.data) {
                user.userImageURL = await this.storage.signedURL(user.userImageURL!)
            }
        }

        logger.info(`End service.user.getUsersPaginationSrv, "output": {"total": ${users?.total || 0}, "data.length": ${users?.data?.length || 0}}`)
        return users
    }

    async createUserSrv(user: User) {
        logger.info(`Start service.user.createUserSrv, "input": ${JSON.stringify(user)}`)

        let firebaseUserUID: string = "";
        try {
            const firebaseUser = await this.firebaseAuth.createUser({
                email: user.userEmail,
                password: user.studentID || this.defaultPassword,
            })
            firebaseUserUID = firebaseUser.uid

            user.userDisplayName = user.userFullName
            user.userImageURL = `${storageFolder}/${uuid()}.${filePath.defaultAvatar.substring(filePath.defaultAvatar.lastIndexOf('.')+1)}`
            user.firebaseID = firebaseUserUID
            await this.storage.copyFile(`${storageFolder}/${filePath.defaultAvatar}`, user.userImageURL)
            await this.repository.createUserRepo(user);
        } catch (error) {
            if (firebaseUserUID) {
                await this.firebaseAuth.deleteUser(firebaseUserUID)
            }
            throw error
        }

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
            await this.firebaseAuth.updateUser(u.firebaseID!, { email: user.userEmail })
        }

        await this.repository.updateUserRepo(user);

        logger.info(`End service.user.updateUserSrv`)
        return user
    }

    async deleteUserSrv(userUUID: string) {
        logger.info(`Start service.user.deleteUserSrv, "input": ${userUUID}`)

        try {
            const u = await this.repository.getUserRepo({ userUUID })
            if (!u || !u.userUUID) {
                throw Error('user is not found')
            }

            try {
                await this.storage.deleteFile(u.userImageURL!)
            } catch (error) {}

            try {
                await this.firebaseAuth.deleteUser(u.firebaseID!)
            } catch (error) {}

            try {
                await this.repository.deleteUserRepo(userUUID);
            } catch (error) {}

        } catch (error) {
            logger.error(error)
        }

        logger.info(`End service.user.deleteUserSrv`)
    }

    async isExistEmailSrv(email: string) {
        logger.info(`Start service.user.isExistEmailSrv, "input": "${email}"`)

        const isExist = await this.repository.isExistEmailRepo(email);

        logger.info(`End service.user.isExistEmailSrv, "output": ${isExist}`)
        return isExist
    }

    async registerUserSrv(user: User) {
        logger.info(`Start service.user.registerUserSrv, "input": ${JSON.stringify(user)}`)

        user.userImageURL = `${storageFolder}/${uuid()}.${filePath.defaultAvatar.substring(filePath.defaultAvatar.lastIndexOf('.')+1)}`
        await this.storage.copyFile(`${storageFolder}/${filePath.defaultAvatar}`, user.userImageURL)
        const userUUID = await this.repository.createUserRepo(user);

        logger.info(`End service.user.registerUserSrv, "output": ${JSON.stringify({userUUID})}`)
        return userUUID
    }
}
