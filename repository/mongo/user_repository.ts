import { FilterUser, User, UserPagination } from "../../model/user";
import logger from "../../util/logger";
import * as mongoDB from "mongodb";
import { v4 as uuid } from "uuid";
import userModel from './model/user'

export function newUserRepository(db: mongoDB.Db) {
    return new UserRepository(db)
}

export const UserCollection = "User"

interface Repository {
    getFollowUsersRepo(userUUIDs: string[]): Promise<User[]>
    getUsersRepo(query: UserPagination): Promise<{ total: number, data: User[] }>
    getUserRepo(filter: FilterUser): Promise<User>
    createUserRepo(user: User): Promise<string>
    updateUserRepo(user: User): void
    deleteUserRepo(userUUID: string): void
    isExistEmailRepo(email: string): Promise<boolean>
    followingUserRepo(followingByUserUUID: string, followingToUserUUID: string, isFollowing: boolean): void
    notiUserRepo(userUUID: string, notiUserUUID: string, isNoti: boolean): void
}

export class UserRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getFollowUsersRepo(userUUIDs: string[]) {
        logger.info(`Start mongo.user.getFollowUsersRepo, "input": ${JSON.stringify(userUUIDs)}`)

        const users = await this.db.collection<User>(UserCollection).find({ userUUID: { $in: userUUIDs } }).toArray()

        logger.info(`End mongo.user.getFollowUsersRepo, "output": ${JSON.stringify(users)}`)
        return users as User[]
    }

    async getUsersRepo(query: UserPagination) {
        logger.info(`Start mongo.user.getUsersRepo, "input": ${JSON.stringify(query)}`)

        const sort = query.userType ? { studentID: 1, userFullName: 1 } : { userDisplayName: 1 }

        const filter = { $regex: `.*${query.search ?? ''}.*`, $options: "i" }
        const users = (await this.db.collection(UserCollection).aggregate([
            {$sort: sort},
            {$match:{
                $and: [
                    { userType: { $in: query.userType ? [query.userType] : ["std", "tch"] } },
                    { $or: [
                        { userDisplayName: filter },
                        { userFullName: filter },
                        { userEmail: filter },
                        { studentID: filter },
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

        const user = await this.db.collection<User>(UserCollection).findOne(filter)

        logger.info(`End mongo.user.getUserRepo, "output": ${JSON.stringify(user)}`)
        return user as User
    }

    async createUserRepo(user: User) {
        logger.info(`Start mongo.user.createUserRepo, "input": ${JSON.stringify(user)}`)

        user.userUUID = uuid()
        await userModel.create({...user, createdAt: new Date()})

        logger.info(`End mongo.user.createUserRepo, "output": ${JSON.stringify({userUUID: user.userUUID})}`)
        return user.userUUID!
    }

    async updateUserRepo(user: User) {
        logger.info(`Start mongo.user.updateUserRepo, "input": ${JSON.stringify(user)}`)

        await userModel.updateOne({ userUUID: user.userUUID}, { $set: {...user, updatedAt: new Date()} })

        logger.info(`End mongo.user.updateUserRepo`)
    }

    async deleteUserRepo(userUUID: string) {
        logger.info(`Start mongo.user.deleteUserRepo, "input": "${userUUID}"`)

        await this.db.collection(UserCollection).deleteOne({ userUUID })

        const result = await userModel.updateMany(
            {
                $or: [
                    { followerUserUUIDs: { $exists: true, $in: [ userUUID ] } },
                    { followingUserUUIDs: { $exists: true, $in: [ userUUID ] } },
                    { notiUserUUIDs: { $exists: true, $in: [ userUUID ] } },
                ]
            },
            {
                $pull: { followerUserUUIDs: userUUID, followingUserUUIDs: userUUID, notiUserUUIDs: userUUID },
            },
        )

        logger.info(`Unsubscribe follower, following and notification from delete user: ${userUUID} to ${result.matchedCount} another user(s)`)

        logger.info(`End mongo.user.deleteUserRepo`)
    }

    async isExistEmailRepo(email: string) {
        logger.info(`Start mongo.user.isExistEmailRepo, "input": "${email}"`)

        const count = await this.db.collection(UserCollection).countDocuments({ userEmail: email })
        const isExist = count > 0

        logger.info(`End mongo.user.isExistEmailRepo, "output": ${isExist}`)
        return isExist
    }

    async followingUserRepo(followingByUserUUID: string, followingToUserUUID: string, isFollowing: boolean) {
        logger.info(`Start mongo.user.followingUserRepo, "input": "${JSON.stringify({followingByUserUUID, followingToUserUUID, isFollowing})}"`)

        if (isFollowing) {
            await this.db.collection(UserCollection).updateOne({ userUUID: followingByUserUUID }, { $addToSet: { followingUserUUIDs: followingToUserUUID, notiUserUUIDs: followingToUserUUID } })
            await this.db.collection(UserCollection).updateOne({ userUUID: followingToUserUUID }, { $addToSet: { followerUserUUIDs: followingByUserUUID } })
        } else {
            await this.db.collection(UserCollection).updateOne({ userUUID: followingByUserUUID }, { $pull: { followingUserUUIDs: followingToUserUUID, notiUserUUIDs: followingToUserUUID } })
            await this.db.collection(UserCollection).updateOne({ userUUID: followingToUserUUID }, { $pull: { followerUserUUIDs: followingByUserUUID } })
        }

        logger.info(`End mongo.user.followingUserRepo`)
    }

    async notiUserRepo(userUUID: string, notiUserUUID: string, isNoti: boolean) {
        logger.info(`Start mongo.user.notiUserRepo, "input": "${JSON.stringify({userUUID, notiUserUUID, isNoti})}"`)

        if (isNoti) {
            await this.db.collection(UserCollection).updateOne({ userUUID }, { $addToSet: { notiUserUUIDs: notiUserUUID } })
        } else {
            await this.db.collection(UserCollection).updateOne({ userUUID }, { $pull: { notiUserUUIDs: notiUserUUID } })
        }

        logger.info(`End mongo.user.notiUserRepo`)
    }
}