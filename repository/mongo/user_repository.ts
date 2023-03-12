import logger from "@util/logger";
import * as mongoDB from "mongodb";
import { ObjectId } from "mongodb";
export function newUserRepository(db: mongoDB.Db) {
    return new UserRepository(db)
}

const userCollection = "User"

interface UserRepo {
    getUser(): void
}

export class UserRepository implements UserRepo {
    constructor(private db: mongoDB.Db) {}
    async getUser() {
        logger.info("Start mongo.user")

        const query = { _id: new ObjectId('640d6b852ee4e26814384218') };
        const user = await this.db.collection(userCollection).findOne(query)

        logger.info("End mongo.user", JSON.stringify(user))
        return user
    }
}