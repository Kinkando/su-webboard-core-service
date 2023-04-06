import { CloudStorage } from '../cloud/google/storage';
import { CountReport, FilterReport, Report, ReportStatus, ReportView } from "../model/report";
import { ReportRepository } from "../repository/mongo/report_repository";
import logger from "../util/logger";

export function newReportService(repository: ReportRepository, storage: CloudStorage) {
    return new ReportService(repository, storage)
}

interface Service {
    getReportSrv(reportUUID: string): Promise<Report | null>
    getReportsPaginationSrv(filter: FilterReport): Promise<{total: number, data: ReportView[]}>
    createReportSrv(report: Report, type: 'forum' | 'comment'): void
    updateReportStatusSrv(report: Report): void
    invalidReportStatusSrv(report: Report): void
    deleteReportSrv(report: Report): void
    countReportStatusSrv(): Promise<CountReport>
}

export class ReportService implements Service {
    constructor(private repository: ReportRepository, private storage: CloudStorage) {}

    async getReportSrv(reportUUID: string) {
        logger.info(`Start service.report.getReportSrv, "input": ${JSON.stringify({reportUUID})}`)

        const report = await this.repository.getReportRepo(reportUUID)

        logger.info(`End service.report.getReportSrv, "output": ${JSON.stringify(report)}`)
        return report
    }

    async getReportsPaginationSrv(filter: FilterReport) {
        logger.info(`Start service.report.getReportsPaginationSrv, "input": ${JSON.stringify(filter)}`)

        const res = await this.repository.getReportsPaginationRepo(filter)

        logger.info(`End service.report.getReportsPaginationSrv, "output": ${JSON.stringify({total: res?.total || 0, length: res?.data?.length || 0})}`)
        return res
    }

    async createReportSrv(report: Report, type: 'forum' | 'comment') {
        logger.info(`Start service.report.createReportSrv, "input": ${JSON.stringify({report, type})}`)

        report.reportCode = await this.repository.getReportCodeRepo(type)
        await this.repository.createReportRepo(report)

        logger.info(`End service.report.createReportSrv`)
    }

    async updateReportStatusSrv(report: Report) {
        logger.info(`Start service.report.updateReportStatusSrv, "input": ${JSON.stringify(report)}`)

        await this.repository.updateReportStatusRepo(report.reportUUID!, report.reportStatus)

        if ([ReportStatus.Resolved, ReportStatus.Rejected].includes(report.reportStatus)) {
            await this.repository.updateReportsStatusRepo(
                {forumUUID: report.forumUUID, commentUUID: report.commentUUID} as any,
                ReportStatus.Pending,
                ReportStatus.Closed,
                report.reportUUID!,
            );
        }

        logger.info(`End service.report.updateReportStatusSrv`)
    }

    async invalidReportStatusSrv(report: Report) {
        logger.info(`Start service.report.invalidReportStatusSrv, "input": ${JSON.stringify(report)}`)

        await this.repository.updateReportsStatusRepo(report, ReportStatus.Pending, ReportStatus.Invalid);

        logger.info(`End service.report.invalidReportStatusSrv`)
    }

    async deleteReportSrv(report: Report) {
        logger.info(`Start service.report.deleteReportSrv, "input": ${JSON.stringify(report)}`)

        await this.repository.deleteReportRepo(report)

        logger.info(`End service.report.deleteReportSrv`)
    }

    async countReportStatusSrv() {
        logger.info(`Start service.report.countReportStatusSrv`)

        const res = await this.repository.countReportStatusRepo()

        logger.info(`End service.report.countReportStatusSrv, "output": ${JSON.stringify(res)}`)
        return res
    }
}