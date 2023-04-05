import { ReportStatus } from '../../../model/report';
import { model, Schema, Model, Document } from 'mongoose';

const reportCollection = "Report"

interface IReport extends Document {
    reportUUID: string
    reporterUUID: string
    plaintiffUUID: string
    description: string
    reportStatus: ReportStatus
    forumUUID: string
    commentUUID?: string
    replyCommentUUID?: string
    createdAt: Date
    updatedAt?: Date
}

const reportSchema: Schema = new Schema(
    {
        reportUUID: { type: String, required: false, unique: true },
        reporterUUID: { type: String, required: false, unique: false },
        plaintiffUUID: { type: String, required: false, unique: false },
        description: { type: String, required: false, unique: false },
        reportStatus: { type: String, required: false, unique: false },
        forumUUID: { type: String, required: false, unique: false },
        commentUUID: { type: String, required: false, unique: false },
        replyCommentUUID: { type: String, required: false, unique: false },
        createdAt: { type: Date, required: false },
        updatedAt: { type: Date, required: false },
    },
    {
        versionKey: false, // You should be aware of the outcome after set to false
    }
);

const report: Model<IReport> = model(reportCollection, reportSchema, reportCollection) as any;

export default report