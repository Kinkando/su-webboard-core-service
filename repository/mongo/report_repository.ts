import { v4 as uuid } from "uuid";
import * as mongoDB from "mongodb";
import { FilterQuery } from "mongoose";
import reportModel from './model/report'
import { CountReport, FilterReport, Report, ReportStatus, ReportView } from "../../model/report";
import logger from "../../util/logger";

export function newReportRepository(db: mongoDB.Db) {
    return new ReportRepository(db)
}

export const ReportCollection = "Report"

interface Repository {
    getReportCodeRepo(type: 'forum' | 'comment'): Promise<string>
    getReportRepo(reportUUID: string): Promise<Report | null>
    getReportsPaginationRepo(query: FilterReport): Promise<{total: number, data: ReportView[]}>
    createReportRepo(report: Report): void
    updateReportStatusRepo(reportUUID: string, reportStatus: ReportStatus): void
    updateReportsStatusRepo(report: Report, fromReportStatus: ReportStatus, toReportStatus: ReportStatus, refReportUUID?: string): void
    deleteReportRepo(report: Report): void
    countReportStatusRepo(): Promise<CountReport>
}

export class ReportRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getReportCodeRepo(type: 'forum' | 'comment') {
        logger.info(`Start mongo.report.getReportCodeRepo, "input": ${JSON.stringify({type})}`)

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
        const suffixCode = dateFormat(now)
        const prefixCode = `RP${type === 'forum' ? 'FR' : 'CM'}-${suffixCode}`

        let count = 1;
        await reportModel.find({ reportCode: { $regex: `${prefixCode}.*`, $options: "i" } }).then(async(docs) => {
            while(docs.find(doc => doc.reportCode.substring(doc.reportCode.indexOf('-') + suffixCode.length + 1) === fiveDigit(count))) {
                count++;
            }
        })

        const reportCode = `${prefixCode}${fiveDigit(count)}`

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

        const search = { $regex: `.*${query.search ?? ''}.*`, $options: "i" }
        const filter: FilterQuery<Report> = {
            $and: [
                {
                    $or: [
                        { reportStatus: search },
                        { reportCode: search },
                        { reportReason: search },
                        { refReportCode: search },
                    ]
                }
            ]
        }

        if (query.search) {
            if ('กระทู้'.includes(query.search)) {
                filter.$and![0].$or!.push({ commentUUID: null })
            } else if ('ความคิดเห็น'.includes(query.search)) {
                filter.$and![0].$or!.push({ commentUUID: { $ne: null } })
            }
        }

        if (query.reportStatus) {
            filter.$and!.push({reportStatus: { $in: [...query.reportStatus.split(',').map(reportStatus => reportStatus.trim())] }})
        }

        if (query.type) {
            if (query.type === 'forum') {
                filter.$and!.push({ commentUUID: null })
            } else if (query.type === 'comment') {
                filter.$and!.push({ commentUUID: { $ne: null } })
            }
        }

        let sortBy: Record<string, 1 | -1> = {}
        if (query.sortBy) {
            for(let sortField of query.sortBy.split(',')) {
                sortField = sortField.trim()
                const sortOption = sortField.split("@")
                const field = sortOption[0].trim()
                if (field === 'type') {
                    sortBy.commentUUID = sortOption.length > 1 && sortOption[1].toLowerCase().trim() === 'desc' ? -1 : 1
                } else {
                    sortBy[field] = sortOption.length > 1 && sortOption[1].toLowerCase().trim() === 'desc' ? -1 : 1
                }
            }
        } else {
            sortBy.createdAt = -1
        }

        const res = (await reportModel.aggregate([
            {$lookup: {
                from: ReportCollection,
                localField: 'refReportUUID',
                foreignField: 'reportUUID',
                as: 'refReport'
            }},
            {$unwind: {
                path: "$refReport",
                preserveNullAndEmptyArrays: true
            }},
            {$addFields: {
                refReportCode : { $cond: [ { $eq: [ "$refReport", null ] }, 0, "$refReport.reportCode" ] },
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
                    reportCode: report.reportCode!,
                    type: report.replyCommentUUID?.length ? 'ความคิดเห็น' : report.commentUUID?.length ? 'ความคิดเห็น' : 'กระทู้',
                    refReportCode: (report as any).refReportCode,
                    createdAt: (report as any).createdAt,
                    updatedAt: (report as any).updatedAt,
                })
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

        const filter: FilterQuery<Report> = {
            reportStatus: fromReportStatus,
            forumUUID: report.forumUUID,
            $or: [
                { commentUUID: report.commentUUID },
                { replyCommentUUID: report.commentUUID },
            ]
        }
        if (report.plaintiffUUID || report.reporterUUID) {
            filter.$or!.push({plaintiffUUID: report.plaintiffUUID}, {reporterUUID: report.reporterUUID})
        }
        await reportModel.updateMany(filter, { $set: { refReportUUID: refReportUUID || undefined, reportStatus: toReportStatus, updatedAt: new Date()} })

        logger.info(`End mongo.report.updateReportsStatusRepo`)
    }

    async deleteReportRepo(report: Report) {
        logger.info(`Start mongo.report.deleteReportRepo, "input": ${JSON.stringify(report)}`)

        const result = await reportModel.deleteMany(report)
        logger.warn(`deleted report successfully: ${result.deletedCount} item(s)`)

        logger.info(`End mongo.report.deleteReportRepo`)
    }

    async countReportStatusRepo() {
        logger.info(`Start mongo.report.countReportStatusRepo`)

        const res = (await reportModel.aggregate<CountReport>([
            {
                $group: {
                    _id: "$reportStatus",
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { "_id": 1 }
            },
            {
                $group: {
                    "_id": null,
                    "counts": {
                        $push: {
                            "k": "$_id",
                            "v": "$count"
                        }
                    }
                }
            },
            {
                $replaceRoot: {
                    "newRoot": { $arrayToObject: "$counts" }
                }
            }
            // {
            //     $facet: {
            //         "pendingStatus": [ { $match: { "reportStatus": ReportStatus.Pending } } ],
            //         "resolvedStatus": [ { $match: { "reportStatus": ReportStatus.Resolved } } ],
            //         "rejectedStatus": [ { $match: { "reportStatus": ReportStatus.Rejected } } ],
            //         "closedStatus": [ { $match: { "reportStatus": ReportStatus.Closed } } ],
            //         "invalidStatus": [ { $match: { "reportStatus": ReportStatus.Invalid } } ],
            //         "total" : [ { $group: { _id: null, count: { $sum: 1 } } } ],
            //     }
            // },
            // {
            //     $unwind: "$total"
            // },
            // {
            //     $project: {
            //         "pending": { $size: "$pendingStatus" },
            //         "resolved": { $size: "$resolvedStatus" },
            //         "rejected": { $size: "$rejectedStatus" },
            //         "closed": { $size: "$closedStatus" },
            //         "invalid": { $size: "$invalidStatus" },
            //         "total": '$total.count',
            //     }
            // }
        ])).map(doc => {
            delete (doc as any)._id
            doc.total = Object.values(doc).reduce((pre, cur) => pre+cur, 0)
            return doc
        })[0]

        logger.info(`End mongo.report.countReportStatusRepo, "output": ${JSON.stringify(res)}`)
        return res
    }
}