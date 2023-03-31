import { v4 as uuid } from "uuid";
import { CloudStorage, File } from '../cloud/google/storage';
import { Document, Pagination } from "../model/common";
import { Announcement, AnnouncementView, FilterAnnouncement } from "../model/announcement";
import { AnnouncementRepository } from "../repository/mongo/announcement_repository";
import logger from "../util/logger";

const storageFolder = "announcement"

export function newAnnouncementService(repository: AnnouncementRepository, storage: CloudStorage) {
    return new AnnouncementService(repository, storage)
}

interface Service {
    getAnnouncementsSrv(filter: FilterAnnouncement, isSignedURL: boolean): Promise<{ total: number, data: AnnouncementView[] }>
    getAnnouncementDetailSrv(announcementUUID: string): Promise<AnnouncementView>
    getAnnouncementsByAuthorUUIDSrv(authorUUID: string): Promise<Announcement[]>
    upsertAnnouncementSrv(announcement: Announcement, files: File[], announcementImageUUIDs?: string[]): Promise<{ announcementUUID: string, documents: Document[] }>
    deleteAnnouncementSrv(announcementUUID: string): void
    seeAnnouncementSrv(announcementUUID: string, userUUID: string): void

    pullSeeCountUUIDFromAnnouncementSrv(userUUID: string): void
}

export class AnnouncementService implements Service {
    constructor(private repository: AnnouncementRepository, private storage: CloudStorage) {}

    async getAnnouncementsSrv(filter: Pagination, isSignedURL: boolean = false) {
        logger.info(`Start service.announcement.getAnnouncementsSrv, "input": ${JSON.stringify({filter, isSignedURL})}`)

        const announcements = await this.repository.getAnnouncementsRepo(filter)

        if(announcements?.data) {
            for(let announcement of announcements.data) {
                if (announcement.announcementImages && isSignedURL) {
                    for(let i=0; i<announcement.announcementImages.length; i++) {
                        announcement.announcementImages[i].url = this.storage.publicURL(announcement.announcementImages[i].url)
                    }
                } else {
                    delete announcement.announcementImages
                }
                announcement.authorImageURL = await this.storage.signedURL(announcement.authorImageURL)
            }
        }

        logger.info(`End service.announcement.getAnnouncementsSrv, "output": {"total": ${announcements?.total || 0}, "data.length": ${announcements?.data?.length || 0}}`)
        return announcements
    }

    async getAnnouncementDetailSrv(announcementUUID: string) {
        logger.info(`Start service.announcement.getAnnouncementDetailSrv, "input": ${JSON.stringify({ announcementUUID })}`)

        const announcement = await this.repository.getAnnouncementDetailRepo(announcementUUID)

        if(announcement) {
            if (announcement.announcementImages) {
                for(let i=0; i<announcement.announcementImages.length; i++) {
                    announcement.announcementImages[i].url = this.storage.publicURL(announcement.announcementImages[i].url)
                }
            }
            announcement.authorImageURL = await this.storage.signedURL(announcement.authorImageURL)
        }

        logger.info(`End service.announcement.getAnnouncementDetailSrv, "output": ${JSON.stringify(announcement)}`)
        return announcement
    }

    async getAnnouncementsByAuthorUUIDSrv(authorUUID: string) {
        logger.info(`Start service.announcement.getAnnouncementsByAuthorUUIDSrv, "input": ${JSON.stringify({ authorUUID })}`)

        const announcements = await this.repository.getAnnouncementsByAuthorUUIDRepo(authorUUID)

        logger.info(`End service.announcement.getAnnouncementsByAuthorUUIDSrv, "output": ${JSON.stringify({ total: announcements?.length || 0 })}`)
        return announcements
    }

    async upsertAnnouncementSrv(announcement: Announcement, files: File[], announcementImageUUIDs?: string[]) {
        logger.info(`Start service.announcement.upsertAnnouncementSrv, "input": ${JSON.stringify({announcement, announcementImageUUIDs})}`)

        const uploadAnnouncementImage = async (announcement: Announcement, images?: Document[]) => {
            if (files) {
                announcement.announcementImages = images ? [...images] : []
                if (announcementImageUUIDs) {
                    announcement.announcementImages = announcement.announcementImages.filter(doc => !announcementImageUUIDs.includes(doc.uuid))
                }
                const newDocuments: Document[] = []
                for (const file of files) {
                    const { fileUUID, fileName } = await this.storage.uploadFile(file, `${storageFolder}/${announcement.announcementUUID}`)
                    await this.storage.setPublic(fileName)
                    const document = {
                        uuid: fileUUID,
                        url: fileName,
                    }
                    newDocuments.push({...document})
                    announcement.announcementImages.push({...document})
                }
                for (const newDocument of newDocuments) {
                    newDocument.url = await this.storage.signedURL(newDocument.url)
                }
                return newDocuments
            }
            return []
        }

        let newDocuments: Document[] = []
        if (announcement.announcementUUID) {
            const announcementReq = await this.repository.getAnnouncementRepo(announcement.announcementUUID)
            if (!announcementReq || !announcementReq.announcementUUID) {
                throw Error('announcementUUID is not found')
            }
            if (announcementImageUUIDs && announcementReq.announcementImages) {
                const announcementImageReq = announcementReq.announcementImages.filter(doc => announcementImageUUIDs.includes(doc.uuid))
                if (announcementImageReq) {
                    for (const announcementImage of announcementImageReq) {
                        try {
                            await this.storage.deleteFile(announcementImage.url)
                        } catch (error) {
                            logger.error(error)
                        }
                    }
                }
            }
            newDocuments = await uploadAnnouncementImage(announcement, announcementReq?.announcementImages)
            await this.repository.updateAnnouncementRepo(announcement)

        } else {
            announcement.announcementUUID = uuid()
            newDocuments = await uploadAnnouncementImage(announcement)
            await this.repository.createAnnouncementRepo(announcement)
        }

        const res = { announcementUUID: announcement.announcementUUID, documents: newDocuments }
        logger.info(`End service.announcement.upsertAnnouncementSrv, "output": ${JSON.stringify(res)}`)
        return res
    }

    async deleteAnnouncementSrv(announcementUUID: string) {
        logger.info(`Start service.announcement.deleteAnnouncementSrv, "input": ${JSON.stringify(announcementUUID)}`)

        const announcement = await this.repository.getAnnouncementRepo(announcementUUID)
        if (!announcement) {
            throw Error('announcementUUID is not found')
        }

        if (announcement.announcementImages) {
            for (const announcementImage of announcement.announcementImages) {
                try {
                    await this.storage.deleteFile(announcementImage.url)
                } catch (error) {
                    logger.error(error)
                }
            }
        }

        await this.repository.deleteAnnouncementRepo(announcementUUID)

        logger.info(`End service.announcement.deleteAnnouncementSrv`)
    }

    async seeAnnouncementSrv(announcementUUID: string, userUUID: string) {
        logger.info(`Start service.announcement.seeAnnouncementSrv, "input": ${JSON.stringify({announcementUUID, userUUID})}`)

        await this.repository.seeAnnouncementRepo(announcementUUID, userUUID)

        logger.info(`End service.announcement.seeAnnouncementSrv`)
    }

    async pullSeeCountUUIDFromAnnouncementSrv(userUUID: string) {
        logger.info(`Start service.announcement.pullSeeCountUUIDFromAnnouncementSrv, "input": ${JSON.stringify({ userUUID })}`)

        await this.repository.pullSeeCountUUIDFromAnnouncementRepo(userUUID)

        logger.info(`End service.announcement.pullSeeCountUUIDFromAnnouncementSrv`)
    }
}