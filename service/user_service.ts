import { SendGrid } from "@cloud/sendgrid/sendgrid";
import { FilterUser, User } from "@model/user";
import { UserRepository } from "@repository/mongo/user_repository";
import logger from "@util/logger";

export function newUserService(userRepository: UserRepository, sendgrid: SendGrid) {
    return new UserService(userRepository, sendgrid)
}

interface Service {
    getUser(filter: FilterUser): Promise<User>
    updateUser(user: User): void
    resetPassword(tokenID: string): void
}

export class UserService implements Service {
    constructor(private repository: UserRepository, private sendgrid: SendGrid) {}

    async getUser(filter: FilterUser) {
        logger.info(`Start service.user.getUser, "input": %s`, JSON.stringify(filter))

        let user = await this.repository.getUser(filter);

        logger.info(`End service.user.getUser, "output": %s`, JSON.stringify(user))
        return user
    }

    async updateUser(user: User) {
        logger.info(`Start service.user.updateUser, "input": %s`, JSON.stringify(user))

        await this.repository.updateUser(user);

        logger.info(`End service.user.updateUser`)
        return user
    }

    async resetPassword(tokenID: string) {
        logger.info(`Start service.user.resetPassword, "input": {"tokenID": "%s"}`, tokenID)

        this.sendgrid.sendEmailTemplate("")

        logger.info(`End service.user.resetPassword`)
    }
}
