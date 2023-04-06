import { NextFunction, Request, Response, Router } from 'express';
import { CategoryService } from "../../service/category_service"
import logger from '../../util/logger';
import { getProfile } from '../../util/profile';
import HTTP from '../../common/http';

export function newCategoryHandler(categoryService: CategoryService) {
    const categoryHandler = new CategoryHandler(categoryService)

    const categoryRouter = Router()
    categoryRouter.get('', (req, res, next) => categoryHandler.getCategories(req, res, next))
    categoryRouter.get('/:categoryID', (req, res, next) => categoryHandler.getCategory(req, res, next))

    return categoryRouter
}

class CategoryHandler {
    constructor(private categoryService: CategoryService) {}

    async getCategories(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.category.getCategories")
        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const categories = await this.categoryService.getCategoriesSrv()

            logger.info("End http.category.getCategories")
            return res.status(categories ? HTTP.StatusOK : HTTP.StatusNoContent).send(categories);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }

    async getCategory(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.category.getCategory")
        try {
            const profile = getProfile(req)
            if (profile.userType === 'adm') {
                logger.error('permission is denied')
                return res.status(HTTP.StatusUnauthorized).send({ error: "permission is denied" })
            }

            const categoryID = Number(req.params['categoryID'])
            if (!categoryID) {
                logger.error('categoryID is required')
                return res.status(HTTP.StatusBadRequest).send({ error: "categoryID is required" })
            }

            const category = await this.categoryService.getCategorySrv(categoryID)
            if (!category || !category.categoryID) {
                logger.error('categoryID is not found')
                return res.status(HTTP.StatusNotFound).send({ error: "categoryID is not found" })
            }
            delete (category as any)._id
            delete (category as any).createdAt
            delete (category as any).updatedAt

            logger.info("End http.category.getCategory")
            return res.status(HTTP.StatusOK).send(category);

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }
    }
}