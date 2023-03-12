import { UserRepository } from "@repository/mongo/user_repository";
import logger from "@util/logger";

export function newUserService(userRepository: UserRepository) {
    return new UserService(userRepository)
}

interface UserSrv {
    getUser(): any
}

export class UserService implements UserSrv {
    constructor(private repository: UserRepository) {}

    async getUser() {
        logger.info("Start service.user")

        const user = await this.repository.getUser();

        logger.info("End service.user", JSON.stringify(user))
        return user
    }
}