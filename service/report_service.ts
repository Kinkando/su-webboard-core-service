import { CloudStorage } from '../cloud/google/storage';
import { FilterReport, Report, ReportStatus, ReportView } from "../model/report";
import { ReportRepository } from "../repository/mongo/report_repository";
import logger from "../util/logger";

export function newReportService(repository: ReportRepository, storage: CloudStorage) {
    return new ReportService(repository, storage)
}

interface Service {
    getReportSrv(reportUUID: string): Promise<Report | null>
    getReportsPaginationSrv(filter: FilterReport): Promise<{total: number, data: ReportView[]}>
    createReportSrv(report: Report): void
    updateReportStatusSrv(reportUUID: string, reportStatus: ReportStatus): void
    deleteReportSrv(report: Report): void
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

        if (res?.data) {
            for (const report of res.data) {
                report.reporter.imageURL = await this.storage.signedURL(report.reporter.imageURL)
                report.plaintiff.imageURL = await this.storage.signedURL(report.plaintiff.imageURL)
            }
        }

        logger.info(`End service.report.getReportsPaginationSrv, "output": ${JSON.stringify({total: res?.total || 0, length: res?.data?.length || 0})}`)
        return res
    }

    async createReportSrv(report: Report) {
        logger.info(`Start service.report.createReportSrv, "input": ${JSON.stringify(report)}`)

        await this.repository.createReportRepo(report)

        logger.info(`End service.report.createReportSrv`)
    }

    async updateReportStatusSrv(reportUUID: string, reportStatus: ReportStatus) {
        logger.info(`Start service.report.updateReportStatusSrv, "input": ${JSON.stringify({reportUUID, reportStatus})}`)

        await this.repository.updateReportStatusRepo(reportUUID, reportStatus)

        logger.info(`End service.report.updateReportStatusSrv`)
    }

    async deleteReportSrv(report: Report) {
        logger.info(`Start service.report.deleteReportSrv, "input": ${JSON.stringify(report)}`)

        await this.repository.deleteReportRepo(report)

        logger.info(`End service.report.deleteReportSrv`)
    }
}