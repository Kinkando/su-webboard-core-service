import * as admin from 'firebase-admin';
import { FilterUser, User } from "@model/user";
import { UserRepository } from "@repository/mongo/user_repository";
import logger from "@util/logger";

export function newAdminService(userRepository: UserRepository, firebase: admin.app.App) {
    return new AdminService(userRepository, firebase)
}

interface Service {
    getUsers(search: string, limit: number, offset: number): Promise<{ total: number, data: User[] }>
    updateUser(user: User): void
}

export class AdminService implements Service {
    constructor(private repository: UserRepository, private firebase: admin.app.App) {}

    async getUsers(search: string, limit: number, offset: number) {
        logger.info(`Start service.admin.getUsers, "input": {"search": "%s", "limit": %d, "offset": %d}`, search, limit, offset)

        const users = await this.repository.getUsers(search, limit, offset)

        logger.info(`End service.admin.getUsers, "output": {"total": %d, "data.length": %d}`, users?.total || 0, users?.data?.length || 0)
        return users
    }

    async updateUser(user: User) {
        logger.info(`Start service.admin.updateUser, "input": %s`, JSON.stringify(user))

        await this.repository.updateUser(user);

        logger.info(`End service.admin.updateUser`)
        return user
    }
}