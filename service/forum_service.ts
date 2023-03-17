import { v4 as uuid } from "uuid";
import { CloudStorage, File } from '../cloud/google/storage';
import { FilterForum, Forum, ForumView } from "../model/forum";
import { ForumRepository } from "../repository/mongo/forum_repository";
import logger from "../util/logger";

const storageFolder = "forum"

export function newForumService(repository: ForumRepository, storage: CloudStorage) {
    return new ForumService(repository, storage)
}

interface Service {
    getForumsSrv(filter: FilterForum): Promise<{ total: number, data: ForumView[] }>
    getForumDetailSrv(forumUUID: string): Promise<ForumView>
    upsertForumSrv(forum: Forum, files: File[]): Promise<string>
    deleteForumSrv(forumUUID: string): void
    likeForumSrv(forumUUID: string, userUUID: string, isLike: boolean): void
}

export class ForumService implements Service {
    constructor(private repository: ForumRepository, private storage: CloudStorage) {}

    async getForumsSrv(filter: FilterForum) {
        logger.info(`Start service.forum.getForumsSrv, "input": ${JSON.stringify(filter)}`)

        const forums = await this.repository.getForumsRepo(filter)

        if(forums?.data) {
            for(let forum of forums.data) {
                // if (forum.forumImageURLs) {
                //     for(let i=0; i<forum.forumImageURLs.length; i++) {
                //         forum.forumImageURLs[i] = this.storage.publicURL(forum.forumImageURLs[i])
                //     }
                // }
                forum.authorImageURL = await this.storage.signedURL(forum.authorImageURL)
            }
        }

        logger.info(`End service.forum.getForumsSrv, "output": {"total": ${forums?.total || 0}, "data.length": ${forums?.data?.length || 0}}`)
        return forums
    }

    async getForumDetailSrv(forumUUID: string) {
        logger.info(`Start service.forum.getForumDetailSrv, "input": ${JSON.stringify({ forumUUID })}`)

        const forum = await this.repository.getForumDetailRepo(forumUUID)

        if(forum) {
            if (forum.forumImageURLs) {
                for(let i=0; i<forum.forumImageURLs.length; i++) {
                    forum.forumImageURLs[i] = this.storage.publicURL(forum.forumImageURLs[i])
                }
            }
            forum.authorImageURL = await this.storage.signedURL(forum.authorImageURL)
        }

        logger.info(`End service.forum.getForumDetailSrv, "output": ${JSON.stringify(forum)}`)
        return forum
    }

    async upsertForumSrv(forum: Forum, files: File[]) {
        logger.info(`Start service.forum.upsertForumSrv, "input": ${JSON.stringify(forum)}`)

        const uploadForumImage = async (forum: Forum) => {
            if (files) {
                forum.forumImageURLs = []
                for (const file of files) {
                    const fileName = await this.storage.uploadFile(file, `${storageFolder}/${forum.forumUUID}`)
                    await this.storage.setPublic(fileName)
                    forum.forumImageURLs.push(fileName)
                }
            }
        }

        if (forum.forumUUID) {
            const forumReq = await this.repository.getForumRepo(forum.forumUUID)
            if (!forumReq || !forumReq.forumUUID) {
                throw Error('forumUUID is not found')
            }
            if (forumReq.forumImageURLs) {
                for (const forumImageURL of forumReq.forumImageURLs) {
                    try {
                        await this.storage.deleteFile(forumImageURL)
                    } catch (error) {
                        logger.error(error)
                    }
                }
            }
            await uploadForumImage(forum)
            await this.repository.updateForumRepo(forum)

        } else {
            forum.forumUUID = uuid()
            await uploadForumImage(forum)
            await this.repository.createForumRepo(forum)
        }

        logger.info(`End service.forum.upsertForumSrv, "output": ${JSON.stringify({ forumUUID: forum.forumUUID })}`)
        return forum.forumUUID
    }

    async deleteForumSrv(forumUUID: string) {
        logger.info(`Start service.forum.deleteForumSrv, "input": ${JSON.stringify(forumUUID)}`)

        const forum = await this.repository.getForumRepo(forumUUID)
        if (!forum) {
            throw Error('forumUUID is not found')
        }

        if (forum.forumImageURLs) {
            for (const forumImageURL of forum.forumImageURLs) {
                try {
                    await this.storage.deleteFile(forumImageURL)
                } catch (error) {
                    logger.error(error)
                }
            }
        }

        await this.repository.deleteForumRepo(forumUUID)

        logger.info(`End service.forum.deleteForumSrv`)
    }

    async likeForumSrv(forumUUID: string, userUUID: string, isLike: boolean) {
        logger.info(`Start service.forum.likeForumSrv, "input": ${JSON.stringify({forumUUID, userUUID, isLike})}`)

        await this.repository.likeForumRepo(forumUUID, userUUID, isLike)

        logger.info(`End service.forum.likeForumSrv`)
    }
}