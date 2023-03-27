import { Router, Request, Response, NextFunction } from "express";
import HTTP from "../../common/http";
import { AnnouncementService } from "../../service/announcement_service";
import { CategoryService } from "../../service/category_service";
import { ForumService } from "../../service/forum_service";
import logger from "../../util/logger";
import { getProfile } from "../../util/profile";

export function newHomeHandler(categoryService: CategoryService, forumService: ForumService, announcementService: AnnouncementService) {
    const homeHandler = new HomeHandler(categoryService, forumService, announcementService)

    const homeRouter = Router()
    homeRouter.get('', (req, res, next) => homeHandler.home(req, res, next))

    return homeRouter
}

export class HomeHandler {
    constructor(
        private categoryService: CategoryService,
        private forumService: ForumService,
        private announcementService: AnnouncementService,
    ) {}

    async home(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.home.home")

        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }


            const filter = {
                offset: 0,
                limit: 10,
                sortBy: 'ranking@ASC'
            }
            const announcement = await this.announcementService.getAnnouncementsSrv(filter, true)
            const popularForum = await this.forumService.getForumsSrv(filter, true, profile.userUUID)

            // Mockup for forum count in each category and latest active date
            const categories = await this.categoryService.getCategoriesSrv()
            categories.forEach((category: any) => {
                category.lastActive = new Date()
                category.forumCount = Math.floor(Math.random() * 1000)
            })

            logger.info("End http.home.home")
            return res.status(HTTP.StatusOK).send({ announcements: announcement.data, popularTopics: popularForum.data, categories: categories });

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}