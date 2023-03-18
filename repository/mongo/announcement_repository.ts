import * as mongoDB from "mongodb";
import { Announcement, AnnouncementView } from "../../model/announcement"
import { Pagination } from "../../model/common"
import { UserCollection } from "./user_repository";
import logger from "../../util/logger";

export function newAnnouncementRepository(db: mongoDB.Db) {
    return new AnnouncementRepository(db)
}

export const AnnouncementCollection = "Announcement"

interface Repository {
    getAnnouncementRepo(announcementUUID: string): Promise<Announcement>
    getAnnouncementDetailRepo(announcementUUID: string): Promise<AnnouncementView>
    getAnnouncementsRepo(filter: Pagination): Promise<{ total: number, data: AnnouncementView[] }>
    createAnnouncementRepo(announcement: Announcement): void
    updateAnnouncementRepo(announcement: Announcement): void
    deleteAnnouncementRepo(announcementUUID: string): void
}

export class AnnouncementRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getAnnouncementRepo(announcementUUID: string) {
        logger.info(`Start mongo.announcement.getAnnouncementRepo, "input": ${JSON.stringify({ announcementUUID })}`)

        const announcement = await this.db.collection<Announcement>(AnnouncementCollection).findOne({announcementUUID})

        logger.info(`End mongo.announcement.getAnnouncementRepo, "output": ${JSON.stringify(announcement)}`)
        return announcement as Announcement
    }

    async getAnnouncementDetailRepo(announcementUUID: string) {
        logger.info(`Start mongo.announcement.getAnnouncementDetailRepo, "input": ${JSON.stringify({ announcementUUID })}`)

        const forumDetail = (await this.db.collection<AnnouncementView>(AnnouncementCollection).aggregate([
            {$match: { announcementUUID }},
            {$lookup: {
                from: UserCollection,
                localField: 'authorUUID',
                foreignField: 'userUUID',
                as: 'user'
            }},
            {$unwind: '$user'},
        ]).map(doc => {
            doc.authorName = doc.user.userDisplayName
            doc.authorImageURL = doc.user.userImageURL
            delete doc._id
            delete doc.user
            delete doc.updatedAt
            return doc as AnnouncementView
        }).toArray())[0];

        logger.info(`End mongo.announcement.getAnnouncementDetailRepo, "output": ${JSON.stringify(forumDetail)}`)
        return forumDetail
    }

    async getAnnouncementsRepo(filter: Pagination) {
        logger.info(`Start mongo.announcement.getAnnouncementsRepo, "input": ${JSON.stringify(filter)}`)

        const data = (await this.db.collection(AnnouncementCollection).aggregate([
            {$sort: { createdAt: -1 }},
            {$lookup: {
                from: UserCollection,
                localField: 'authorUUID',
                foreignField: 'userUUID',
                as: 'user'
            }},
            {$unwind: '$user'},
            {$facet:{
                "stage1" : [ { "$group": { _id: null, count: { $sum: 1 } } } ],
                "stage2" : [ { "$skip": filter.offset }, { "$limit": filter.limit || 10 } ],
            }},
            {$unwind: "$stage1"},

            //output projection
            {$project:{
                total: "$stage1.count",
                data: "$stage2"
            }}
        ]).map(doc => {
            const data: AnnouncementView[] = []
            doc.data.forEach((forum: AnnouncementView) => {
                forum.authorName = (forum as any).user.userDisplayName
                forum.authorImageURL = (forum as any).user.userImageURL
                delete (forum as any)._id
                delete (forum as any).user
                delete (forum as any).announcementImages
                delete (forum as any).updatedAt
                data.push({...forum})
            })
            return { total: Number(doc.total), data }
        }).toArray())[0];

        logger.info(`End mongo.announcement.getAnnouncementsRepo, "output": ${JSON.stringify(data)}`)
        return data
    }

    async createAnnouncementRepo(announcement: Announcement) {
        logger.info(`Start mongo.announcement.createAnnouncementRepo, "input": ${JSON.stringify(announcement)}`)

        await this.db.collection(AnnouncementCollection).insertOne({...announcement, createdAt: new Date()})

        logger.info(`End mongo.announcement.createAnnouncementRepo, "output": ${JSON.stringify("")}`)
    }

    async updateAnnouncementRepo(announcement: Announcement) {
        logger.info(`Start mongo.announcement.updateAnnouncementRepo, "input": ${JSON.stringify(announcement)}`)

        await this.db.collection(AnnouncementCollection).updateOne({announcementUUID: announcement.announcementUUID}, {  $set: {...announcement, updatedAt: new Date()} })

        logger.info(`End mongo.announcement.updateAnnouncementRepo`)
    }

    async deleteAnnouncementRepo(announcementUUID: string) {
        logger.info(`Start mongo.announcement.deleteAnnouncementRepo, "input": ${JSON.stringify({ announcementUUID })}`)

        await this.db.collection(AnnouncementCollection).deleteOne({ announcementUUID })

        logger.info(`End mongo.announcement.deleteAnnouncementRepo`)
    }

}