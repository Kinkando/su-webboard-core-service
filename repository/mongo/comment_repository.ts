import * as mongoDB from "mongodb";
import { Comment, CommentView } from "../../model/comment";
import { Pagination } from "../../model/common";
import { User } from "../../model/user";
import logger from "../../util/logger";
import { ForumCollection } from "./forum_repository";
import { UserCollection } from "./user_repository";
import commentModel from './model/comment'

export function newCommentRepository(db: mongoDB.Db) {
    return new CommentRepository(db)
}

export const CommentCollection = 'Comment'

interface Repository {
    getCommentRepo(commentUUID: string, userUUID: string): Promise<CommentView>
    getCommentAndReplyRepo(commentUUID: string): Promise<CommentView[]>
    getCommentsPaginationRepo(forumUUID: string, filter: Pagination, userUUID: string): Promise<{ total: number, data: CommentView[] }>
    getCommentsRepo(key: { forumUUID?: string, commenterUUID?: string, likeUserUUID?: string }): Promise<Comment[]>
    createCommentRepo(comment: Comment): void
    updateCommentRepo(comment: Comment): void
    deleteCommentRepo(commentUUID: string): void
    deleteCommentsByForumUUIDRepo(forumUUID: string): void
    likeCommentRepo(commentUUID: string, userUUID: string, isLike: boolean): void
    pullLikeUserUUIDFromCommentRepo(userUUID: string): void
}

export class CommentRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getCommentRepo(commentUUID: string, userUUID: string) {
        logger.info(`Start mongo.comment.getCommentRepo, "input": ${JSON.stringify({ commentUUID, userUUID })}`)

        const comment = (await this.db.collection(CommentCollection).aggregate([
            {$match: { commentUUID }},
            {$lookup: {
                from: UserCollection,
                localField: 'commenterUUID',
                foreignField: 'userUUID',
                as: 'user'
            }},
            {$unwind: '$user'},
            {$lookup: {
                from: ForumCollection,
                localField: 'forumUUID',
                foreignField: 'forumUUID',
                as: 'forum'
            }},
            {$unwind: '$forum'},
        ]).map(doc => {
            const comment = doc as CommentView
            comment.commenterName = (comment as any).user.userDisplayName
            comment.commenterImageURL = (comment as any).user.userImageURL
            comment.likeCount = comment.likeUserUUIDs?.length || 0
            comment.isLike = comment.likeUserUUIDs?.includes(userUUID) || false
            comment.isAnonymous = ((comment as any).forum?.isAnonymous || false) && (comment as any).forum?.authorUUID === comment.commenterUUID
            delete (comment as any)._id
            delete (comment as any).user
            delete (comment as any).likeUserUUIDs
            delete (comment as any).forum
            // duplicate
            // delete (comment as any).forumUUID
            return comment
        }).toArray())[0];

        logger.info(`End mongo.comment.getCommentRepo, "output": ${JSON.stringify(comment)}`)
        return comment
    }

    async getCommentAndReplyRepo(commentUUID: string) {
        logger.info(`Start mongo.comment.getCommentAndReplyRepo, "input": ${JSON.stringify({ commentUUID })}`)

        const comment = await this.db.collection<CommentView>(CommentCollection).
            find({ $or: [{ commentUUID }, { replyCommentUUID: commentUUID }] }).
            map(doc => doc as CommentView).
            toArray()

        logger.info(`End mongo.comment.getCommentAndReplyRepo, "output": ${JSON.stringify(comment)}`)
        return comment
    }

    async getCommentsPaginationRepo(forumUUID: string, filter: Pagination, userUUID: string) {
        logger.info(`Start mongo.comment.getCommentsPaginationRepo, "input": ${JSON.stringify({ forumUUID, filter, userUUID })}`)

        const options: any = [
            {$match: { forumUUID, replyCommentUUID: null }},
        ];

        let sortBy: any = {}
        if (filter.sortBy) {
            for(let sortField of filter.sortBy.split(',')) {
                sortField = sortField.trim()
                const sortOption = sortField.split("@")
                let field = sortOption[0].trim()
                sortBy[field] = sortOption.length > 1 && sortOption[1].toLowerCase().trim() === 'desc' ? -1 : 1
            }
        }

        if (sortBy) {
            options.push({$sort: sortBy})
        }

        const data = (await this.db.collection(CommentCollection).aggregate([
            ...options,
            {$lookup: {
                from: UserCollection,
                localField: 'commenterUUID',
                foreignField: 'userUUID',
                as: 'user'
            }},
            {$lookup: {
                from: CommentCollection,
                localField: 'commentUUID',
                foreignField: 'replyCommentUUID',
                as: 'replyComments'
            }},
            {$lookup: {
                from: UserCollection,
                localField: 'replyComments.commenterUUID',
                foreignField: 'userUUID',
                as: 'replyUsers'
            }},
            {$unwind: '$user'},
            {$lookup: {
                from: ForumCollection,
                localField: 'forumUUID',
                foreignField: 'forumUUID',
                as: 'forum'
            }},
            {$unwind: '$forum'},
            {$facet:{
                "stage1" : [ { "$group": { _id: null, count: { $sum: 1 },  userReply: { $push: "$userReply" } } } ],
                "stage2" : [ { "$skip": filter.offset }, { "$limit": filter.limit || 10 } ],
            }},
            {$unwind: "$stage1"},

            //output projection
            {$project:{
                total: "$stage1.count",
                data: "$stage2"
            }}
        ]).map(doc => {
            const data: CommentView[] = []
            doc.data.forEach((comment: CommentView, index: number) => {
                comment.commenterName = (comment as any).user.userDisplayName
                comment.commenterImageURL = (comment as any).user.userImageURL
                comment.likeCount = comment.likeUserUUIDs?.length || 0
                comment.isLike = (comment as any).likeUserUUIDs?.includes(userUUID) || false
                comment.isAnonymous = ((comment as any).forum?.isAnonymous || false) && (comment as any).forum?.authorUUID === comment.commenterUUID
                if (comment.replyComments) {
                    for(const replyComment of comment.replyComments) {
                        const user = (comment as any).replyUsers.find((user: any) => user.userUUID ===  replyComment.commenterUUID) as User
                        replyComment.commenterName = user.userDisplayName || ''
                        replyComment.commenterImageURL = user.userImageURL || ''
                        replyComment.isLike = (replyComment as any).likeUserUUIDs?.includes(userUUID) || false
                        replyComment.likeCount = replyComment.likeUserUUIDs?.length || 0
                        replyComment.isAnonymous = ((comment as any).forum?.isAnonymous || false) && (comment as any).forum?.authorUUID === replyComment.commenterUUID
                        delete (replyComment as any)._id
                        delete (replyComment as any).replyUsers
                        delete (replyComment as any).likeUserUUIDs
                        // duplicate
                        delete (replyComment as any).forumUUID
                        delete replyComment.replyCommentUUID
                    }
                }
                delete (comment as any)._id
                delete (comment as any).user
                delete (comment as any).categoryIDs
                delete (comment as any).commentImageURLs
                delete (comment as any).likeUserUUIDs
                delete (comment as any).replyUsers
                delete (comment as any).forum
                // duplicate
                delete (comment as any).forumUUID
                data.push({...comment})
            })
            return { total: Number(doc.total), data }
        }).toArray())[0];

        logger.info(`End mongo.comment.getCommentsPaginationRepo, "output": ${JSON.stringify(data)}`)
        return data
    }

    async getCommentsRepo(key: { forumUUID?: string, commenterUUID?: string, likeUserUUID?: string }) {
        logger.info(`Start mongo.comment.getCommentsRepo, "input": ${JSON.stringify(key)}`)

        let filter: any = {}
        if (key.forumUUID) {
            filter.forumUUID = key.forumUUID
        }
        if (key.commenterUUID) {
            filter.commenterUUID = key.commenterUUID
        }
        if (key.likeUserUUID) {
            filter.likeUserUUIDs = { $elemMatch: { $eq: key.likeUserUUID } }
        }

        const commentsDoc = await this.db.collection<Comment>(CommentCollection).find(filter).toArray()
        const comments = commentsDoc.map(comment => {
            delete (comment as any)._id
            delete (comment as any).createdAt
            delete (comment as any).updatedAt
            return comment
        })

        logger.info(`End mongo.comment.getCommentsRepo, "output": ${JSON.stringify(comments)}`)
        return comments
    }

    async createCommentRepo(comment: Comment) {
        logger.info(`Start mongo.comment.createCommentRepo, "input": ${JSON.stringify({ comment })}`)

        await this.db.collection(CommentCollection).insertOne({...comment, likeUserUUIDs: [], createdAt: new Date()})

        logger.info(`End mongo.comment.createCommentRepo`)
    }

    async updateCommentRepo(comment: Comment) {
        logger.info(`Start mongo.comment.updateCommentRepo, "input": ${JSON.stringify({ comment })}`)

        await this.db.collection(CommentCollection).updateOne({commentUUID: comment.commentUUID}, {  $set: {...comment, updatedAt: new Date()} })

        logger.info(`End mongo.comment.updateCommentRepo`)
    }

    async deleteCommentRepo(commentUUID: string) {
        logger.info(`Start mongo.comment.deleteCommentRepo, "input": ${JSON.stringify({ commentUUID })}`)

        const result = await this.db.collection(CommentCollection).deleteMany({ $or: [{ commentUUID }, { replyCommentUUID: commentUUID }] })
        logger.warn(`delete comment total: ${result.deletedCount} comment(s)`)

        logger.info(`End mongo.comment.deleteCommentRepo`)
    }

    async deleteCommentsByForumUUIDRepo(forumUUID: string) {
        logger.info(`Start mongo.comment.deleteCommentsByForumUUIDRepo, "input": ${JSON.stringify({ forumUUID })}`)

        await this.db.collection(CommentCollection).deleteMany({ forumUUID })

        logger.info(`End mongo.comment.deleteCommentsByForumUUIDRepo`)
    }

    async likeCommentRepo(commentUUID: string, userUUID: string, isLike: boolean) {
        logger.info(`Start mongo.comment.likeCommentRepo, "input": ${JSON.stringify({ commentUUID, userUUID, isLike })}`)

        if (isLike) {
            await this.db.collection(CommentCollection).updateOne({ commentUUID }, { $addToSet: { likeUserUUIDs: userUUID } })
        } else {
            await this.db.collection(CommentCollection).updateOne({ commentUUID }, { $pull: { likeUserUUIDs: userUUID } })
        }

        logger.info(`End mongo.comment.likeCommentRepo`)
    }

    async getCommentsByLikeUserUUIDRepo(userUUID: string) {
        logger.info(`Start mongo.comment.getCommentsByLikeUserUUIDRepo, "input": ${JSON.stringify({ userUUID })}`)

        const forums: Comment[] = await this.db.collection<Comment>(CommentCollection).find({ likeUserUUIDs: { $elemMatch: { $eq: userUUID } } }).toArray()

        logger.info(`End mongo.comment.getCommentsByLikeUserUUIDRepo, "output": ${JSON.stringify({ found: forums?.length || 0 })}`)
        return forums
    }

    async pullLikeUserUUIDFromCommentRepo(userUUID: string) {
        logger.info(`Start mongo.comment.pullLikeUserUUIDFromCommentRepo, "input": ${JSON.stringify({ userUUID })}`)

        const result = await commentModel.updateMany(
            { likeUserUUIDs: { $elemMatch: { $eq: userUUID } } },
            { $pull: { likeUserUUIDs: userUUID } },
        )

        logger.info(`Pull like out of comment by userUUID: ${userUUID} to ${result.matchedCount} comment(s)`)

        logger.info(`End mongo.comment.pullLikeUserUUIDFromCommentRepo`)
    }
}