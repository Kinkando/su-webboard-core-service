import { v4 as uuid } from "uuid";
import * as mongoDB from "mongodb";
import reportModel from './model/report'
import { FilterReport, Report, ReportStatus, ReportView } from "../../model/report";
import logger from "../../util/logger";
import { UserCollection } from "./user_repository";
import { FilterQuery } from "mongoose";

export function newReportRepository(db: mongoDB.Db) {
    return new ReportRepository(db)
}

export const ReportCollection = "Report"

interface Repository {
    getReportRepo(reportUUID: string): Promise<Report | null>
    getReportsPaginationRepo(query: FilterReport): Promise<{total: number, data: ReportView[]}>
    createReportRepo(report: Report): void
    updateReportStatusRepo(reportUUID: string, reportStatus: ReportStatus): void
    updateReportsStatusToInvalidRepo(report: Report): void // update pending to invalid
    deleteReportRepo(report: Report): void
}

export class ReportRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getReportRepo(reportUUID: string) {
        logger.info(`Start mongo.report.getReportRepo, "input": ${JSON.stringify({reportUUID})}`)

        const report = await reportModel.findOne<Report>({reportUUID})

        logger.info(`End mongo.report.getReportRepo, "output": ${JSON.stringify(report)}`)
        return report
    }

    async getReportsPaginationRepo(query: FilterReport) {
        logger.info(`Start mongo.report.getReportsPaginationRepo, "input": ${JSON.stringify(query)}`)

        const queryTypeForum = [{commentUUID: {$eq: null}}, {replyCommentUUID: {$eq: null}}]
        const queryTypeComment = {commentUUID: {$ne: null}}
        const search = { $regex: `.*${query.search ?? ''}.*`, $options: "i" }
        const filter: FilterQuery<Report> = {
            $and: [
                {
                    $or: [
                        { 'reporterDetail.userDisplayName': search },
                        { 'plaintiffDetail.userDisplayName': search },
                        { reportStatus: search },
                        { description: search },
                    ]
                }
            ]
        }

        if (query.search) {
            if ('กระทู้'.includes(query.search)) {
                filter.$and![0].$or!.push(...queryTypeForum)
            } else if ('ความคิดเห็น'.includes(query.search)) {
                filter.$and![0].$or!.push(queryTypeComment)
            }
        }

        if (query.reportStatus) {
            filter.$and!.push({reportStatus: query.reportStatus})
        }

        if (query.type) {
            if (query.type === 'forum') {
                filter.$and!.push(...queryTypeForum)
            } else if (query.type === 'comment') {
                filter.$and!.push(queryTypeComment)
            }
        }

        let sortBy: Record<string, 1 | -1> = {}
        if (filter.sortBy) {
            for(let sortField of filter.sortBy.split(',')) {
                sortField = sortField.trim()
                const sortOption = sortField.split("@")
                sortBy[sortOption[0].trim()] = sortOption.length > 1 && sortOption[1].toLowerCase().trim() === 'desc' ? -1 : 1
            }
        } else {
            sortBy.createdAt = -1
        }

        const res = (await reportModel.aggregate([
            {$lookup: {
                from: UserCollection,
                localField: 'reporterUUID',
                foreignField: 'userUUID',
                as: 'reporterDetail'
            }},
            {$unwind: "$reporterDetail"},
            {$lookup: {
                from: UserCollection,
                localField: 'plaintiffUUID',
                foreignField: 'userUUID',
                as: 'plaintiffDetail'
            }},
            {$unwind: "$plaintiffDetail"},
            {$match: filter},
            {$sort: sortBy},
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
        ])).map(doc => {
            const data: ReportView[] = []
            doc?.data?.forEach((report: Report) => {
                data.push({
                    reportUUID: report.reportUUID!,
                    reportStatus: report.reportStatus,
                    reportReason: report.reportReason,
                    type: report.replyCommentUUID ? 'ความคิดเห็น' : report.commentUUID ? 'ความคิดเห็น' : 'กระทู้',
                    reporter: {
                        uuid: (report as any).reporterDetail.userUUID,
                        name: (report as any).reporterDetail.userDisplayName,
                        imageURL: (report as any).reporterDetail.userImageURL,
                    },
                    plaintiff: {
                        uuid: (report as any).plaintiffDetail.userUUID,
                        name: (report as any).plaintiffDetail.userDisplayName,
                        imageURL: (report as any).plaintiffDetail.userImageURL,
                    },
                })
                delete (report as any)._id
                delete (report as any).reporterDetail
                delete (report as any).plaintiffDetail
                delete (report as any).forumUUID
                delete report.commentUUID
                delete report.replyCommentUUID
            })
            return { total: Number(doc.total), data }
        })[0]

        logger.info(`End mongo.report.getReportsPaginationRepo, "output": ${JSON.stringify({total: res?.total || 0, length: res?.data?.length || 0})}`)
        return res
    }

    async createReportRepo(report: Report) {
        logger.info(`Start mongo.report.createReportRepo, "input": ${JSON.stringify(report)}`)

        report.reportUUID = uuid()
        await reportModel.create({...report, createdAt: new Date()})

        logger.info(`End mongo.report.createReportRepo`)
    }

    async updateReportStatusRepo(reportUUID: string, reportStatus: ReportStatus) {
        logger.info(`Start mongo.report.updateReportRepo, "input": ${JSON.stringify({reportUUID, reportStatus})}`)

        await reportModel.updateOne({reportUUID}, {reportStatus, updatedAt: new Date()})

        logger.info(`End mongo.report.updateReportRepo`)
    }

    async updateReportsStatusToInvalidRepo(report: Report) {
        logger.info(`Start mongo.report.updateReportsStatusToInvalidRepo, "input": ${JSON.stringify(report)}`)

        report.reportStatus = ReportStatus.Pending
        await reportModel.updateMany(report, { $set: { reportStatus: ReportStatus.Invalid, updatedAt: new Date()} })

        logger.info(`End mongo.report.updateReportsStatusToInvalidRepo`)
    }

    async deleteReportRepo(report: Report) {
        logger.info(`Start mongo.report.deleteReportRepo, "input": ${JSON.stringify(report)}`)

        await reportModel.deleteMany(report)

        logger.info(`End mongo.report.deleteReportRepo`)
    }
}