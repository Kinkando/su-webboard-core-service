import { FilterUser, User } from "@model/user";
import logger from "@util/logger";
import * as mongoDB from "mongodb";
import { v4 as uuid } from "uuid";
export function newUserRepository(db: mongoDB.Db) {
    return new UserRepository(db)
}

const userCollection = "User"

interface UserRepo {
    getUsers(search: string, limit: number, offset: number): Promise<{ total: number, data: User[] }>
    getUser(filter: FilterUser): Promise<User>
    createUser(user: User): void
    updateUser(user: User): void
    isExistEmail(email: string): Promise<boolean>
}

export class UserRepository implements UserRepo {
    constructor(private db: mongoDB.Db) {}

    async getUsers(search: string, limit: number, offset: number) {
        logger.info(`Start mongo.user.getUsers, "input": {"search": "%s", "limit": %d, "offset": %d}`, search, limit, offset)

        const filter = { $regex: `.*${search}.*`, $options: "i" }
        const users = (await this.db.collection(userCollection).aggregate([
            {$sort: { createdAt: 1 }},
            {$match:{
                $and: [
                    { userType: { $ne: "adm" } },
                    { $or: [
                        { userDisplayName: filter },
                        { userFullName: filter },
                        { userEmail: filter },
                        { studentID: filter },
                        { isAnonymous: filter },
                    ]}
                ]
            }},
            {$facet:{
                "stage1" : [ { "$group": { _id: null, count: { $sum: 1 } } } ],
                "stage2" : [ { "$skip": offset }, { "$limit": limit } ],
            }},
            {$unwind: "$stage1"},

            //output projection
            {$project:{
                total: "$stage1.count",
                data: "$stage2"
            }}
        ]).map(doc => { return { total: Number(doc.total), data: doc.data as User[] } }).toArray())[0];

        logger.info(`End mongo.user.getUsers, "output": %s`, JSON.stringify(users))
        return users
    }

    async getUser(filter: FilterUser) {
        logger.info(`Start mongo.user.getUser, "input": %s`, JSON.stringify(filter))

        const user = await this.db.collection<User>(userCollection).findOne(filter)

        logger.info(`End mongo.user.getUser, "output": %s`, JSON.stringify(user))
        return user as User
    }

    async createUser(user: User) {
        logger.info(`Start mongo.user.updateUser, "input": %s`, JSON.stringify(user))

        user.userUUID = uuid()
        await this.db.collection(userCollection).insertOne({...user, createdAt: new Date()})

        logger.info(`End mongo.user.updateUser`)
    }

    async updateUser(user: User) {
        logger.info(`Start mongo.user.updateUser, "input": %s`, JSON.stringify(user))

        await this.db.collection(userCollection).updateOne({ userUUID: user.userUUID}, { $set: {...user, updatedAt: new Date()} })

        logger.info(`End mongo.user.updateUser`)
    }

    async isExistEmail(email: string) {
        logger.info(`Start mongo.user.isExistEmail, "input": "%s"`, email)

        const count = await this.db.collection(userCollection).countDocuments({ userEmail: email })
        const isExist = count > 0

        logger.info(`End mongo.user.isExistEmail, "output": ${isExist}`)
        return isExist
    }
}