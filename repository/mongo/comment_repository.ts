import * as mongoDB from "mongodb";
import { Comment, CommentView } from "../../model/comment";
import { Pagination } from "../../model/common";
import { User } from "../../model/user";
import logger from "../../util/logger";
import { ForumCollection } from "./forum_repository";
import { UserCollection } from "./user_repository";

export function newCommentRepository(db: mongoDB.Db) {
    return new CommentRepository(db)
}

export const CommentCollection = 'Comment'

interface Repository {
    getCommentRepo(commentUUID: string): Promise<CommentView>
    getCommentAndReplyRepo(commentUUID: string): Promise<CommentView[]>
    getCommentsRepo(forumUUID: string, filter: Pagination, userUUID: string): Promise<{ total: number, data: CommentView[] }>
    getCommentsByForumUUIDRepo(forumUUID: string): Promise<Comment[]>
    createCommentRepo(comment: Comment): void
    updateCommentRepo(comment: Comment): void
    deleteCommentRepo(commentUUID: string): void
    deleteCommentsByForumUUIDRepo(forumUUID: string): void
    likeCommentRepo(commentUUID: string, userUUID: string, isLike: boolean): void
}

export class CommentRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getCommentRepo(commentUUID: string) {
        logger.info(`Start mongo.comment.getCommentRepo, "input": ${JSON.stringify({ commentUUID })}`)

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
            comment.isAnonymous = ((comment as any).forum?.isAnonymous || false) && (comment as any).forum?.authorUUID === comment.commenterUUID
            delete (comment as any)._id
            delete (comment as any).user
            delete (comment as any).likeUserUUIDs
            delete (comment as any).forum
            // duplicate
            delete (comment as any).forumUUID
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

    async getCommentsRepo(forumUUID: string, filter: Pagination, userUUID: string) {
        logger.info(`Start mongo.comment.getCommentsRepo, "input": ${JSON.stringify({ forumUUID, filter, userUUID })}`)

        const data = (await this.db.collection(CommentCollection).aggregate([
            {$sort: { createdAt: 1 }},
            {$match: { forumUUID, replyCommentUUID: null }},
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

        logger.info(`End mongo.comment.getCommentsRepo, "output": ${JSON.stringify(data)}`)
        return data
    }

    async getCommentsByForumUUIDRepo(forumUUID: string) {
        logger.info(`Start mongo.comment.getCommentsByForumUUIDRepo, "input": ${JSON.stringify({ forumUUID })}`)

        const commentsDoc = await this.db.collection<Comment>(CommentCollection).find({ forumUUID }).toArray()
        const comments = commentsDoc.map(comment => {
            delete (comment as any)._id
            delete (comment as any).createdAt
            delete (comment as any).updatedAt
            return comment
        })

        logger.info(`End mongo.comment.getCommentsByForumUUIDRepo, "output": ${JSON.stringify(comments)}`)
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

}