import { v4 as uuid } from "uuid";
import * as mongoDB from "mongodb";
import { FilterQuery } from "mongoose";
import reportModel from './model/report'
import { FilterReport, Report, ReportStatus, ReportView } from "../../model/report";
import logger from "../../util/logger";

export function newReportRepository(db: mongoDB.Db) {
    return new ReportRepository(db)
}

export const ReportCollection = "Report"

interface Repository {
    getReportCodeRepo(): Promise<string>
    getReportRepo(reportUUID: string): Promise<Report | null>
    getReportsPaginationRepo(query: FilterReport): Promise<{total: number, data: ReportView[]}>
    createReportRepo(report: Report): void
    updateReportStatusRepo(reportUUID: string, reportStatus: ReportStatus): void
    updateReportsStatusRepo(report: Report, fromReportStatus: ReportStatus, toReportStatus: ReportStatus, refReportUUID?: string): void
    deleteReportRepo(report: Report): void
}

export class ReportRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getReportCodeRepo() {
        logger.info(`Start mongo.report.getReportCodeRepo`)

        const dateFormat = (date: Date): string => {
            const twoDigit = (digit: number) => digit < 10 ? `0${digit}` : `${digit}`;
            return `${date.getFullYear()}${twoDigit(date.getMonth()+1)}${twoDigit(date.getDate())}`
        }
        const fiveDigit = (count: number): string => {
            let suffixCode = `${count}`
            while (suffixCode.length < 5) {
                suffixCode = `0${suffixCode}`
            }
            return suffixCode
        }

        const now = new Date()
        const prefixCode = `RP-${dateFormat(now)}`

        let count = await reportModel.find({ reportCode: { $regex: `${prefixCode}.*`, $options: "i" } }).count().exec()

        const reportCode = `${prefixCode}${fiveDigit(count+1)}`

        logger.info(`End mongo.report.getReportCodeRepo, "output": ${JSON.stringify({reportCode})}`)
        return reportCode
    }

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
                        { reportStatus: search },
                        { reportCode: search },
                        { 'refReport.reportCode': search },
                        { reportReason: search },
                    ]
                }
            ]
        }

        if (query.search) {
            if ('กระทู้'.includes(query.search)) {
                filter.$and![0].$or!.push({$and: [...queryTypeForum]})
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
                from: ReportCollection,
                localField: 'reportUUID',
                foreignField: 'reportUUID',
                as: 'refReport'
            }},
            {$unwind: {
                path: "$refReport",
                preserveNullAndEmptyArrays: true
            }},
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
                    reportCode: report.reportCode!,
                    refReportCode: (report as any).refReport ? (report as any).refReport?.reportCode : undefined
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

        await reportModel.updateOne({reportUUID}, { $set : {reportStatus, updatedAt: new Date()} })

        logger.info(`End mongo.report.updateReportRepo`)
    }

    async updateReportsStatusRepo(report: Report, fromReportStatus: ReportStatus, toReportStatus: ReportStatus, refReportUUID?: string) {
        logger.info(`Start mongo.report.updateReportsStatusRepo, "input": ${JSON.stringify({report, fromReportStatus, toReportStatus, refReportUUID})}`)

        const filter: FilterQuery<Report> = { reportStatus: fromReportStatus, forumUUID: report.forumUUID, commentUUID: report.commentUUID, replyCommentUUID: report.replyCommentUUID }
        if (report.plaintiffUUID || report.reporterUUID) {
            filter.$or = [ {plaintiffUUID: report.plaintiffUUID}, {reporterUUID: report.reporterUUID} ]
        }
        await reportModel.updateMany(report, { $set: { reportStatus: toReportStatus, updatedAt: new Date()} })

        logger.info(`End mongo.report.updateReportsStatusRepo`)
    }

    async deleteReportRepo(report: Report) {
        logger.info(`Start mongo.report.deleteReportRepo, "input": ${JSON.stringify(report)}`)

        const result = await reportModel.deleteMany(report)
        logger.warn(`deleted report successfully: ${result.deletedCount} item(s)`)

        logger.info(`End mongo.report.deleteReportRepo`)
    }
}