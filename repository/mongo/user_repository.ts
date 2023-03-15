import { FilterUser, User, UserPagination } from "../../model/user";
import logger from "../../util/logger";
import * as mongoDB from "mongodb";
import { v4 as uuid } from "uuid";

export function newUserRepository(db: mongoDB.Db) {
    return new UserRepository(db)
}

const userCollection = "User"

interface Repository {
    getUsersRepo(query: UserPagination): Promise<{ total: number, data: User[] }>
    getUserRepo(filter: FilterUser): Promise<User>
    createUserRepo(user: User): void
    updateUserRepo(user: User): void
    deleteUserRepo(userUUID: string): void
    isExistEmailRepo(email: string): Promise<boolean>
}

export class UserRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getUsersRepo(query: UserPagination) {
        logger.info(`Start mongo.user.getUsersRepo, "input": ${JSON.stringify(query)}`)

        const filter = { $regex: `.*${query.search ?? ''}.*`, $options: "i" }
        const users = (await this.db.collection(userCollection).aggregate([
            {$sort: { studentID: 1, createdAt: 1 }},
            {$match:{
                $and: [
                    { userType: { $in: query.userType ? [query.userType] : ["std", "tch"] } },
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
                "stage2" : [ { "$skip": query.offset }, { "$limit": query.limit || 10 } ],
            }},
            {$unwind: "$stage1"},

            //output projection
            {$project:{
                total: "$stage1.count",
                data: "$stage2"
            }}
        ]).map(doc => { return { total: Number(doc.total), data: doc.data as User[] }}).toArray())[0];

        logger.info(`End mongo.user.getUsersRepo, "output": ${JSON.stringify(users)}`)
        return users
    }

    async getUserRepo(filter: FilterUser) {
        logger.info(`Start mongo.user.getUserRepo, "input": ${JSON.stringify(filter)}`)

        const user = await this.db.collection<User>(userCollection).findOne(filter)

        logger.info(`End mongo.user.getUserRepo, "output": ${JSON.stringify(user)}`)
        return user as User
    }

    async createUserRepo(user: User) {
        logger.info(`Start mongo.user.createUserRepo, "input": ${JSON.stringify(user)}`)

        // add validate unique student id
        user.userUUID = uuid()
        await this.db.collection(userCollection).insertOne({...user, createdAt: new Date()})

        logger.info(`End mongo.user.createUserRepo`)
    }

    async updateUserRepo(user: User) {
        logger.info(`Start mongo.user.updateUserRepo, "input": ${JSON.stringify(user)}`)

        // add validate unique student id
        await this.db.collection(userCollection).updateOne({ userUUID: user.userUUID}, { $set: {...user, updatedAt: new Date()} })

        logger.info(`End mongo.user.updateUserRepo`)
    }

    async deleteUserRepo(userUUID: string) {
        logger.info(`Start mongo.user.deleteUserRepo, "input": "${userUUID}"`)

        await this.db.collection(userCollection).deleteOne({ userUUID })

        logger.info(`End mongo.user.deleteUserRepo`)
    }

    async isExistEmailRepo(email: string) {
        logger.info(`Start mongo.user.isExistEmailRepo, "input": "${email}"`)

        const count = await this.db.collection(userCollection).countDocuments({ userEmail: email })
        const isExist = count > 0

        logger.info(`End mongo.user.isExistEmailRepo, "output": ${isExist}`)
        return isExist
    }
}