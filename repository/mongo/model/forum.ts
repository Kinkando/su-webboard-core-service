import { Document as ForumDocument } from '../../../model/common';
import { model, Schema, Model, Document } from 'mongoose';

const forumCollection = "Forum"

interface IForum extends Document {
    forumUUID: string
    title: string
    description: string
    forumImages?: ForumDocument[]
    categoryIDs?: number[]
    authorUUID: string
    favoriteUserUUIDs?: string[]
    likeUserUUIDs?: string[]
    isAnonymous?: boolean
    createdAt: Date
    updatedAt?: Date
}

const forumSchema: Schema = new Schema(
    {
        forumUUID: { type: String, required: false, unique: true },
        title: { type: String, required: false },
        description: { type: String, required: false },
        forumImages: { type: Array<ForumDocument>, required: false },
        categoryIDs: { type: Array<Number>, required: false },
        authorUUID: { type: String, required: false },
        favoriteUserUUIDs: { type: Array<String>, required: false },
        likeUserUUIDs: { type: Array<String>, required: false },
        isAnonymous: { type: Boolean, required: false },
        createdAt: { type: Date, required: false },
        updatedAt: { type: Date, required: false },
    },
    {
        versionKey: false, // You should be aware of the outcome after set to false
    }
);

const forum: Model<IForum> = model(forumCollection, forumSchema, forumCollection) as any;

export default forum