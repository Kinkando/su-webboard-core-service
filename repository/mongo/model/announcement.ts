import { Document as AnnouncementDocument } from '../../../model/common';
import { model, Schema, Model, Document } from 'mongoose';

const announcementCollection = "Announcement"

interface IAnnouncement extends Document {
    announcementUUID?: string
    title: string
    description: string
    announcementImages?: Document[]
    authorUUID: string
    seeCountUUIDs?: string[]
    createdAt: Date
    updatedAt?: Date
}

const announcementSchema: Schema = new Schema(
    {
        announcementUUID: { type: String, required: false, unique: true },
        title: { type: String, required: false },
        description: { type: String, required: false },
        announcementImages: { type: Array<AnnouncementDocument>, required: false },
        authorUUID: { type: String, required: false },
        seeCountUUIDs: { type: Array<String>, required: false },
        createdAt: { type: Date, required: false },
        updatedAt: { type: Date, required: false },
    },
    {
        versionKey: false, // You should be aware of the outcome after set to false
    }
);

const announcement: Model<IAnnouncement> = model(announcementCollection, announcementSchema, announcementCollection) as any;

export default announcement