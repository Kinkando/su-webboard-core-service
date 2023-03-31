import { Document as CommentDocument } from '../../../model/common';
import { model, Schema, Model, Document } from 'mongoose';

const commentCollection = "Comment"

interface IComment extends Document {
    forumUUID: string
    commentUUID: string
    replyCommentUUID?: string
    commentText: string
    commentImages?: CommentDocument[]
    commenterUUID: string
    likeUserUUIDs?: string[]
    createdAt: Date
    updatedAt?: Date
}

const commentSchema: Schema = new Schema(
    {
        commentUUID: { type: String, required: false, unique: true },
        forumUUID: { type: String, required: false },
        replyCommentUUID: { type: String, required: false },
        commentText: { type: String, required: false },
        commentImages: { type: Array<CommentDocument>, required: false },
        commenterUUID: { type: String, required: false },
        likeUserUUIDs: { type: Array<String>, required: false },
        createdAt: { type: Date, required: false },
        updatedAt: { type: Date, required: false },
    },
    {
        versionKey: false, // You should be aware of the outcome after set to false
    }
);

const comment: Model<IComment> = model(commentCollection, commentSchema, commentCollection) as any;

export default comment