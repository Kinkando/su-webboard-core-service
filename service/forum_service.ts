import { v4 as uuid } from "uuid";
import { filePath } from "../common/file_path";
import { CloudStorage, File } from '../cloud/google/storage';
import { Document } from "../model/common";
import { FilterForum, Forum, ForumView, RankingForum } from "../model/forum";
import { ForumRepository } from "../repository/mongo/forum_repository";
import logger from "../util/logger";

const storageFolder = "forum"

export function newForumService(repository: ForumRepository, storage: CloudStorage) {
    return new ForumService(repository, storage)
}

interface Service {
    getForumsPaginationSrv(filter: FilterForum, isSignedURL: boolean, userUUID: string): Promise<{ total: number, data: ForumView[] }>
    getForumDetailSrv(forumUUID: string, userUUID: string, isRaw: boolean): Promise<ForumView>
    getForumsSrv(key: { authorUUID?: string, categoryID?: number, likeUserUUID?: string }): Promise<Forum[]>
    upsertForumSrv(userUUID: string, forum: Forum, files: File[], forumImageUUIDs?: string[]): Promise<{ forumUUID: string, documents: Document[] }>
    deleteForumSrv(forumUUID: string, userUUID?: string): void
    likeForumSrv(forumUUID: string, userUUID: string, isLike: boolean): void
    favoriteForumSrv(forumUUID: string, userUUID: string, isFavorite: boolean): void
    pullFavoriteAndLikeUserUUIDFromForumSrv(userUUID: string): void
    deleteCategoryIDToForumSrv(forumUUID: string, categoryID: number): void
}

export class ForumService implements Service {
    constructor(private repository: ForumRepository, private storage: CloudStorage) {}

    private async deleteForumImagesSrv(...documents: Document[]) {
        for (const document of documents) {
            try {
                await this.storage.deleteFile(document.url)
                logger.warn(`delete forum image from cloud storage with object: ${document.url}`)
            } catch (error) {
                logger.error(error)
            }
        }
    }

    async assertAnonymousSrv(forum: ForumView, userUUID: string) {
        if (forum.isAnonymous) {
            forum.authorName = 'ผู้ใช้นิรนาม'
            if (forum.authorUUID === userUUID) {
                forum.authorName += ' (คุณ)'
            } else {
                forum.authorUUID = "unknown"
            }
        }
        forum.authorImageURL = await this.storage.signedURL(forum.isAnonymous ? filePath.anonymousAvatar : forum.authorImageURL)
        // delete forum.isAnonymous

        forum.isFavorite = forum.favoriteUserUUIDs?.includes(userUUID) || false
        delete forum.favoriteUserUUIDs
    }

    async getForumsPaginationSrv(filter: FilterForum, isSignedURL: boolean, userUUID: string) {
        logger.info(`Start service.forum.getForumsPaginationSrv, "input": ${JSON.stringify({filter, isSignedURL, userUUID})}`)

        let ranking: RankingForum = {}
        if (filter.sortBy?.includes("ranking")) {
            ranking = await this.repository.calculateForumRankingsRepo()
        }

        const forums = await this.repository.getForumsPaginationRepo(filter, ranking)

        if(forums?.data) {
            for(let forum of forums.data) {
                if (forum.forumImages && isSignedURL) {
                    for(let i=0; i<forum.forumImages.length; i++) {
                        forum.forumImages[i].url = this.storage.publicURL(forum.forumImages[i].url)
                    }
                }
                await this.assertAnonymousSrv(forum, userUUID)
            }
        }

        logger.info(`End service.forum.getForumsPaginationSrv, "output": {"total": ${forums?.total || 0}, "data.length": ${forums?.data?.length || 0}}`)
        return forums
    }

    async getForumDetailSrv(forumUUID: string, userUUID: string, isRaw = false) {
        logger.info(`Start service.forum.getForumDetailSrv, "input": ${JSON.stringify({ forumUUID, userUUID })}`)

        const forum = await this.repository.getForumDetailRepo(forumUUID)

        if(!isRaw && forum) {
            if (forum.forumImages) {
                for(let i=0; i<forum.forumImages.length; i++) {
                    forum.forumImages[i].url = this.storage.publicURL(forum.forumImages[i].url)
                }
            }
            await this.assertAnonymousSrv(forum, userUUID)
        }

        logger.info(`End service.forum.getForumDetailSrv, "output": ${JSON.stringify(forum)}`)
        return forum
    }

    async upsertForumSrv(userUUID: string, forum: Forum, files: File[], forumImageUUIDs?: string[]) {
        logger.info(`Start service.forum.upsertForumSrv, "input": ${JSON.stringify({userUUID, forum, forumImageUUIDs, totalFiles: files?.length || 0})}`)

        const uploadForumImage = async (forum: Forum, images?: Document[]) => {
            if (files) {
                forum.forumImages = images ? [...images] : []
                if (forumImageUUIDs) {
                    forum.forumImages = forum.forumImages.filter(doc => !forumImageUUIDs.includes(doc.uuid))
                }
                const newDocuments: Document[] = []
                for (const file of files) {
                    const { fileUUID, fileName } = await this.storage.uploadFile(file, `${storageFolder}/${forum.forumUUID}`)
                    await this.storage.setPublic(fileName)
                    const document = {
                        uuid: fileUUID,
                        url: fileName,
                    }
                    newDocuments.push({...document})
                    forum.forumImages.push({...document})
                }
                for (const newDocument of newDocuments) {
                    newDocument.url = await this.storage.signedURL(newDocument.url)
                }
                return newDocuments
            }
            return []
        }

        let newDocuments: Document[] = []
        if (forum.forumUUID) {
            const forumReq = await this.repository.getForumRepo(forum.forumUUID)
            if (!forumReq || !forumReq.forumUUID) {
                throw Error('forumUUID is not found')
            }

            if (forumReq.authorUUID !== userUUID) {
                throw Error('unable to update forum: permission is denied')
            }

            if (forumImageUUIDs && forumReq.forumImages) {
                const forumImageReq = forumReq.forumImages.filter(doc => forumImageUUIDs.includes(doc.uuid))
                if (forumImageReq) {
                    await this.deleteForumImagesSrv(...forumImageReq)
                }
            }
            newDocuments = await uploadForumImage(forum, forumReq?.forumImages)
            await this.repository.updateForumRepo(forum)

        } else {
            forum.forumUUID = uuid()
            newDocuments = await uploadForumImage(forum)
            await this.repository.createForumRepo(forum)
        }

        const res = { forumUUID: forum.forumUUID, documents: newDocuments }
        logger.info(`End service.forum.upsertForumSrv, "output": ${JSON.stringify(res)}`)
        return res
    }

    async deleteForumSrv(forumUUID: string, userUUID?: string) {
        logger.info(`Start service.forum.deleteForumSrv, "input": ${JSON.stringify({forumUUID, userUUID})}`)

        const forum = await this.repository.getForumRepo(forumUUID)
        if (!forum) {
            throw Error('forumUUID is not found')
        }

        if (userUUID && userUUID !== forum.authorUUID) {
            throw Error('unable to delete forum: permission is denied')
        }

        if (forum.forumImages) {
            for (const forumImage of forum.forumImages) {
                try {
                    await this.storage.deleteFile(forumImage.url)
                } catch (error) {
                    logger.error(error)
                }
            }
        }

        await this.repository.deleteForumRepo(forumUUID)

        logger.info(`End service.forum.deleteForumSrv`)
    }

    async getForumsSrv(key: { authorUUID?: string, categoryID?: number, likeUserUUID?: string }) {
        logger.info(`Start service.forum.getForumsSrv, "input": ${JSON.stringify(key)}`)

        const forums = await this.repository.getForumsRepo(key)

        logger.info(`End service.forum.getForumsSrv, "output": ${JSON.stringify({ found: forums?.length || 0 })}`)
        return forums
    }

    async likeForumSrv(forumUUID: string, userUUID: string, isLike: boolean) {
        logger.info(`Start service.forum.likeForumSrv, "input": ${JSON.stringify({forumUUID, userUUID, isLike})}`)

        await this.repository.likeForumRepo(forumUUID, userUUID, isLike)

        logger.info(`End service.forum.likeForumSrv`)
    }

    async favoriteForumSrv(forumUUID: string, userUUID: string, isFavorite: boolean) {
        logger.info(`Start service.forum.favoriteForumSrv, "input": ${JSON.stringify({forumUUID, userUUID, isFavorite})}`)

        await this.repository.favoriteForumRepo(forumUUID, userUUID, isFavorite)

        logger.info(`End service.forum.favoriteForumSrv`)
    }

    async pullFavoriteAndLikeUserUUIDFromForumSrv(userUUID: string) {
        logger.info(`Start service.forum.pullFavoriteAndLikeUserUUIDFromForumSrv, "input": ${JSON.stringify({ userUUID })}`)

        await this.repository.pullFavoriteAndLikeUserUUIDFromForumRepo(userUUID)

        logger.info(`End service.forum.pullFavoriteAndLikeUserUUIDFromForumSrv`)
    }

    async deleteCategoryIDToForumSrv(forumUUID: string, categoryID: number) {
        logger.info(`Start service.forum.deleteCategoryIDToForumSrv, "input": ${JSON.stringify({ forumUUID, categoryID })}`)

        await this.repository.deleteCategoryIDToForumRepo(forumUUID, categoryID)

        logger.info(`End service.forum.deleteCategoryIDToForumSrv`)
    }
}