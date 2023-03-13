import { FilterUser, User } from "@model/user";
import logger from "@util/logger";
import * as mongoDB from "mongodb";
export function newUserRepository(db: mongoDB.Db) {
    return new UserRepository(db)
}

const userCollection = "User"

interface UserRepo {
    getUser(filter: FilterUser): Promise<User>
}

export class UserRepository implements UserRepo {
    constructor(private db: mongoDB.Db) {}
    async getUser(filter: FilterUser) {
        logger.info(`Start mongo.user.getUser, "input": %s`, JSON.stringify(filter))

        const user = await this.db.collection<User>(userCollection).findOne(filter)

        logger.info(`End mongo.user.getUser, "output": %s`, JSON.stringify(user))
        return user as User
    }
}