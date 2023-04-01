import * as mongoDB from "mongodb";
import { CategoryCollection } from "./category_repository";
import { UserCollection } from "./user_repository";
import { FilterForum, Forum, ForumView, RankingForum } from "../../model/forum";
import logger from "../../util/logger";
import { CommentCollection } from "./comment_repository";
import forumModel from './model/forum'

export function newForumRepository(db: mongoDB.Db) {
    return new ForumRepository(db)
}

export const ForumCollection = "Forum"

interface Repository {
    getForumRepo(forumUUID: string): Promise<Forum>
    getForumsPaginationRepo(filter: FilterForum, ranking?: RankingForum): Promise<{ total: number, data: ForumView[] }>
    getForumDetailRepo(forumUUID: string): Promise<ForumView>
    getForumsRepo(key: { authorUUID?: string, categoryID?: number, likeUserUUID?: string }): Promise<Forum[]>
    createForumRepo(forum: Forum): void
    updateForumRepo(forum: Forum): void
    deleteForumRepo(forumUUID: string): void

    calculateForumRankingsRepo(): Promise<RankingForum>
    likeForumRepo(forumUUID: string, userUUID: string, isLike: boolean): void
    favoriteForumRepo(forumUUID: string, userUUID: string, isFavorite: boolean): void
    pullFavoriteAndLikeUserUUIDFromForumRepo(userUUID: string): void
    deleteCategoryIDToForumRepo(forumUUID: string, categoryID: number): void
}

export class ForumRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getForumRepo(forumUUID: string) {
        logger.info(`Start mongo.forum.getForumRepo, "input": ${JSON.stringify({ forumUUID })}`)

        const forum = await this.db.collection<Forum>(ForumCollection).findOne({ forumUUID })

        logger.info(`End mongo.forum.getForumRepo, "output": ${JSON.stringify(forum)}`)
        return forum as Forum
    }

    async getForumsPaginationRepo(filter: FilterForum, ranking?: RankingForum) {
        logger.info(`Start mongo.forum.getForumsPaginationRepo, "input": ${JSON.stringify({filter, ranking})}`)

        const options: any = [];

        let sortBy: any = {}
        if (filter.sortBy) {
            for(let sortField of filter.sortBy.split(',')) {
                sortField = sortField.trim()
                const sortOption = sortField.split("@")
                let field = sortOption[0].trim()
                if (field === 'ranking') {
                    field = 'likeCount'
                }
                sortBy[field] = sortOption.length > 1 && sortOption[1].toLowerCase().trim() === 'desc' ? -1 : 1
            }
        }

        let match: any = {}
        if (filter.categoryID) {
            match.categoryIDs = { $in: [filter.categoryID] }
        }
        if (filter.userUUID) {
            match = {
                $and: [
                    {authorUUID: filter.userUUID},
                    {$or: [
                        { isAnonymous: { $in: [null, false] } },
                        { isAnonymous: true, authorUUID: filter.selfUUID },
                    ]}
                ]
            }
        }
        if (filter.search) {
            const query = { $regex: `.*${filter.search ?? ''}.*`, $options: "i" }

            const nominateUser = {
                $and: [
                    {$or: [
                        { isAnonymous: true, authorUUID: filter.selfUUID },
                        { isAnonymous: { $in: [null, false] } },
                    ]},
                    {$or: [
                        { title: query },
                        { authorName: query },
                        { 'user.userDisplayName': query },
                        { 'user.userFullName': query },
                        { 'user.userEmail': query },
                        { 'user.studentID': query },
                    ]}
                ],
            }
            const anonymousUser = {
                $and: [
                    { isAnonymous: true, authorUUID: {$ne : filter.selfUUID} },
                    { $or: [ { title: query } ] }
                ],
            }

            match = { $or: [ nominateUser, anonymousUser ] }
        }
        if (filter.favoriteUserUUID) {
            match = {
                favoriteUserUUIDs: { $exists: true, $in: [ filter.favoriteUserUUID ] }
            }
        }

        if (filter.sortBy?.includes('authorName')) {
            sortBy = {isAnonymous: 1, ...sortBy}
        }

        options.push(
            { $sort: sortBy },
            { $match: match },
        )

        const data = (await this.db.collection(ForumCollection).aggregate([
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
            {$addFields: {
                likeCount: {$size: { "$ifNull": [ "$likeUserUUIDs", [] ] } },
                authorName: '$user.userDisplayName',
                authorImageURL: '$user.userImageURL',
                categoryName: { $min: '$categories.categoryName' },
            }},
            ...options,
            {$lookup: {
                from: CommentCollection,
                localField: 'forumUUID',
                foreignField: 'forumUUID',
                as: 'comments'
            }},
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
            doc.data.forEach((forum: ForumView) => {
                if (forum.categories) {
                    forum.categories = forum.categories.sort((c1, c2) => {
                        delete (c1 as any)._id
                        delete (c2 as any)._id
                        delete (c1 as any).createdAt
                        delete (c2 as any).createdAt
                        delete (c1 as any).updatedAt
                        delete (c2 as any).updatedAt
                        return c1.categoryName.localeCompare(c2.categoryName, 'th');
                    })
                }
                if (ranking) {
                    forum.ranking = ranking[forum.likeCount || 0]
                }
                forum.commentCount = (forum as any).comments?.filter((comment: any) => comment.replyCommentUUID == undefined)?.length || 0
                delete (forum as any)._id
                delete (forum as any).user
                delete (forum as any).comments
                delete (forum as any).categoryIDs
                delete (forum as any).likeUserUUIDs
                delete (forum as any).categoryName
                data.push({...forum})
            })
            return { total: Number(doc.total), data }
        }).toArray())[0];

        logger.info(`End mongo.forum.getForumsPaginationRepo, "output": ${JSON.stringify(data)}`)
        return data
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
        ]).map(doc => {
            const forum = doc as ForumView
            if (forum.categories) {
                forum.categories = forum.categories.sort((c1, c2) => {
                    delete (c1 as any)._id
                    delete (c2 as any)._id
                    delete (c1 as any).createdAt
                    delete (c2 as any).createdAt
                    delete (c1 as any).updatedAt
                    delete (c2 as any).updatedAt
                    return c1.categoryName.localeCompare(c2.categoryName, 'th');
                })
            }
            forum.authorName = (forum as any).user.userDisplayName
            forum.authorImageURL = (forum as any).user.userImageURL
            forum.likeCount = forum.likeUserUUIDs?.length || 0
            delete (forum as any)._id
            delete (forum as any).user
            delete (forum as any).categoryIDs
            return forum
        }).toArray())[0];

        logger.info(`End mongo.forum.getForumDetailRepo, "output": ${JSON.stringify(forumDetail)}`)
        return forumDetail as ForumView
    }

    async getForumsRepo(key: { authorUUID?: string, categoryID?: number, likeUserUUID?: string }) {
        logger.info(`Start mongo.forum.getForumsRepo, "input": ${JSON.stringify(key)}`)

        let filter: any = {}
        if (key.authorUUID) {
            filter.authorUUID = key.authorUUID
        }
        if (key.categoryID) {
            filter.categoryIDs = { $elemMatch: { $eq: key.categoryID } }
        }
        if (key.likeUserUUID) {
            filter.likeUserUUIDs = { $elemMatch: { $eq: key.likeUserUUID } }
        }

        const forums: Forum[] = await this.db.collection<Forum>(ForumCollection).find(filter).toArray()

        logger.info(`End mongo.forum.getForumsRepo, "output": ${JSON.stringify({ found: forums?.length || 0 })}`)
        return forums
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

    async calculateForumRankingsRepo() {
        logger.info(`Start mongo.forum.calculateForumRankingsRepo`)

        const forums: ForumView[] = await this.db.collection<ForumView>(ForumCollection).find().toArray()

        let ranking: RankingForum = {};
        const uniqueLikeCount = new Set<number>()
        forums.forEach(forum => uniqueLikeCount.add(forum.likeUserUUIDs?.length || 0));
        [...uniqueLikeCount].sort((a, b) => b-a).forEach((likeCount, index) => ranking[likeCount] = index+1)

        logger.info(`End mongo.forum.calculateForumRankingsRepo, "output": ${JSON.stringify(ranking)}`)
        return ranking
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

    async favoriteForumRepo(forumUUID: string, userUUID: string, isFavorite: boolean) {
        logger.info(`Start mongo.forum.favoriteForumRepo, "input": ${JSON.stringify({forumUUID, userUUID, isFavorite})}`)

        if (isFavorite) {
            await this.db.collection(ForumCollection).updateOne({ forumUUID }, { $addToSet: { favoriteUserUUIDs: userUUID } })
        } else {
            await this.db.collection(ForumCollection).updateOne({ forumUUID }, { $pull: { favoriteUserUUIDs: userUUID } })
        }

        logger.info(`End mongo.forum.favoriteForumRepo`)
    }

    async pullFavoriteAndLikeUserUUIDFromForumRepo(userUUID: string) {
        logger.info(`Start mongo.forum.pullFavoriteAndLikeUserUUIDFromForumRepo, "input": ${JSON.stringify({ userUUID })}`)

        const result = await forumModel.updateMany(
            {
                $or: [
                    { favoriteUserUUIDs: { $elemMatch: { $eq: userUUID } } },
                    { likeUserUUIDs: { $elemMatch: { $eq: userUUID } } },
                ]
            },
            {
                $pull: { favoriteUserUUIDs: userUUID, likeUserUUIDs: userUUID },
            },
        )

        logger.info(`Pull favorite and like out of forum by userUUID: ${userUUID} to ${result.matchedCount} forum(s)`)

        logger.info(`End mongo.forum.pullFavoriteAndLikeUserUUIDFromForumRepo`)
    }

    async deleteCategoryIDToForumRepo(forumUUID: string, categoryID: number) {
        logger.info(`Start mongo.forum.deleteCategoryIDToForumRepo, "input": ${JSON.stringify({ forumUUID, categoryID })}`)

        const result = await this.db.collection(ForumCollection).updateOne({forumUUID}, { $pull: { categoryIDs: categoryID } })

        logger.info(`delete category: ${categoryID} out of forum to forumUUID: ${forumUUID} successfully: ${result.upsertedCount} item`)

        logger.info(`End mongo.forum.deleteCategoryIDToForumRepo`)
    }
}