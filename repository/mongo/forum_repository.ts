import * as mongoDB from "mongodb";
import { CategoryCollection } from "./category_repository";
import { UserCollection } from "./user_repository";
import { FilterForum, Forum, ForumView } from "../../model/forum";
import logger from "../../util/logger";

export function newForumRepository(db: mongoDB.Db) {
    return new ForumRepository(db)
}

export const ForumCollection = "Forum"

interface Repository {
    getForumRepo(forumUUID: string): Promise<Forum>
    getForumDetailRepo(forumUUID: string): Promise<ForumView>
    getForumsRepo(filter: FilterForum): Promise<{ total: number, data: ForumView[] }>
    createForumRepo(forum: Forum): void
    updateForumRepo(forum: Forum): void
    deleteForumRepo(forumUUID: string): void
    likeForumRepo(forumUUID: string, userUUID: string, isLike: boolean): void
}

export class ForumRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getForumRepo(forumUUID: string) {
        logger.info(`Start mongo.forum.getForumRepo, "input": ${JSON.stringify({ forumUUID })}`)

        const forum = await this.db.collection<Forum>(ForumCollection).findOne({ forumUUID })

        logger.info(`End mongo.forum.getForumRepo, "output": ${JSON.stringify(forum)}`)
        return forum as Forum
    }

    async getForumDetailRepo(forumUUID: string) {
        logger.info(`Start mongo.forum.getForumDetailRepo, "input": ${JSON.stringify({ forumUUID })}`)

        const forumDetail = (await this.db.collection<ForumView>(ForumCollection).aggregate([
            {$match: { forumUUID }},
            {$lookup: {
                from: UserCollection,
                localField: 'authorUUID',
                foreignField: 'userUUID',
                as: 'user'
            }},
            {$unwind: '$user'},
            {$lookup: {
                from: CategoryCollection,
                localField: 'categoryIDs',
                foreignField: 'categoryID',
                as: 'categories'
            }},
            // {$lookup: {
            //     from: CommentCollection,
            //     localField: 'forumUUID',
            //     foreignField: 'forumUUID',
            //     as: 'comments'
            // }},
        ]).map(doc => {
            const forum = doc as ForumView
            forum.categories?.forEach(category => {
                delete (category as any)._id
                delete (category as any).createdAt
                delete (category as any).updatedAt
            })
            forum.authorName = (forum as any).user.userDisplayName
            forum.authorImageURL = (forum as any).user.userImageURL
            forum.likeCount = forum.likeUserUUIDs?.length || 0
            forum.commentCount = (forum as any).comments?.length || 0
            delete (forum as any)._id
            delete (forum as any).user
            delete (forum as any).updatedAt
            delete (forum as any).categoryIDs
            return forum
        }).toArray())[0];

        logger.info(`End mongo.forum.getForumDetailRepo, "output": ${JSON.stringify(forumDetail)}`)
        return forumDetail as ForumView
    }

    async getForumsRepo(filter: FilterForum) {
        logger.info(`Start mongo.forum.getForumsRepo, "input": ${JSON.stringify(filter)}`)

        let sortBy: any = {}
        if (filter.sortBy) {
            for(let sortField of filter.sortBy.split(',')) {
                sortField = sortField.trim()
                const sortOption = sortField.split("@")
                sortBy[sortOption[0].trim()] = sortOption.length > 1 && sortOption[1].toLowerCase().trim() === 'desc' ? -1 : 1
            }
        }

        let match: any = {}
        if (filter.categoryID) {
            match.categoryIDs = { $in: [filter.categoryID] }
        }

        const data = (await this.db.collection(ForumCollection).aggregate([
            {$sort: sortBy},
            {$match: match},
            {$lookup: {
                from: UserCollection,
                localField: 'authorUUID',
                foreignField: 'userUUID',
                as: 'user'
            }},
            {$unwind: '$user'},
            {$lookup: {
                from: CategoryCollection,
                localField: 'categoryIDs',
                foreignField: 'categoryID',
                as: 'categories'
            }},
            // {$lookup: {
            //     from: CommentCollection,
            //     localField: 'forumUUID',
            //     foreignField: 'forumUUID',
            //     as: 'comments'
            // }},
            {$facet:{
                "stage1" : [ { "$group": { _id: null, count: { $sum: 1 } } } ],
                "stage2" : [ { "$skip": filter.offset }, { "$limit": filter.limit || 10 } ],
            }},
            {$unwind: "$stage1"},

            //output projection
            {$project:{
                total: "$stage1.count",
                data: "$stage2"
            }}
        ]).map(doc => {
            const data: ForumView[] = []
            doc.data.forEach((forum: ForumView, index: number) => {
                forum.categories?.forEach(category => {
                    delete (category as any)._id
                    delete (category as any).createdAt
                    delete (category as any).updatedAt
                })
                forum.authorName = (forum as any).user.userDisplayName
                forum.authorImageURL = (forum as any).user.userImageURL
                forum.likeCount = forum.likeUserUUIDs?.length || 0
                forum.commentCount = (forum as any).comments?.length || 0
                if (filter.sortBy?.includes("ranking@ASC")) {
                    forum.ranking = filter.offset + index + 1
                }
                delete (forum as any)._id
                delete (forum as any).user
                delete (forum as any).updatedAt
                delete (forum as any).categoryIDs
                delete (forum as any).likeUserUUIDs
                data.push({...forum})
            })
            return { total: Number(doc.total), data }
        }).toArray())[0];

        logger.info(`End mongo.forum.getForumsRepo, "output": ${JSON.stringify(data)}`)
        return data
    }

    async createForumRepo(forum: Forum) {
        logger.info(`Start mongo.forum.createForumRepo, "input": ${JSON.stringify(forum)}`)

        await this.db.collection(ForumCollection).insertOne({...forum, likeUserUUIDs: [], createdAt: new Date()})

        logger.info(`End mongo.forum.createForumRepo`)
    }

    async updateForumRepo(forum: Forum) {
        logger.info(`Start mongo.forum.updateForumRepo, "input": ${JSON.stringify(forum)}`)

        await this.db.collection(ForumCollection).updateOne({forumUUID: forum.forumUUID}, {  $set: {...forum, updatedAt: new Date()} })

        logger.info(`End mongo.forum.updateForumRepo`)
    }

    async deleteForumRepo(forumUUID: string) {
        logger.info(`Start mongo.forum.deleteForumRepo, "input": ${JSON.stringify(forumUUID)}`)

        await this.db.collection(ForumCollection).deleteOne({ forumUUID })

        logger.info(`End mongo.forum.deleteForumRepo`)
    }

    async likeForumRepo(forumUUID: string, userUUID: string, isLike: boolean) {
        logger.info(`Start mongo.forum.likeForumRepo, "input": ${JSON.stringify({forumUUID, userUUID, isLike})}`)

        if (isLike) {
            await this.db.collection(ForumCollection).updateOne({ forumUUID }, { $addToSet: { likeUserUUIDs: userUUID } })
        } else {
            await this.db.collection(ForumCollection).updateOne({ forumUUID }, { $pull: { likeUserUUIDs: userUUID } })
        }

        logger.info(`End mongo.forum.likeForumRepo`)
    }
}