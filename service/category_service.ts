import { Pagination } from "../model/common";
import { Category, CategoryDetail, CategoryOccurrence } from "../model/category";
import { CategoryRepository } from "../repository/mongo/category_repository";
import logger from "../util/logger";

export function newCategoryService(repository: CategoryRepository) {
    return new CategoryService(repository)
}

interface Service {
    getCategorySrv(categoryID: number): Promise<Category | null>
    getCategoryDetailsSrv(): Promise<CategoryDetail[]>
    getCategoriesPaginationSrv(query: Pagination): Promise<{ total: number, data: Category[] }>
    getCategoriesSrv(): Promise<Category[]>
    upsertCategorySrv(category: Category): void
    deleteCategorySrv(categoryID: number): void
}

export class CategoryService implements Service {
    constructor(private repository: CategoryRepository) {}

    async getCategorySrv(categoryID: number) {
        logger.info(`Start service.category.getCategorySrv, "input": ${JSON.stringify({categoryID})}`)

        const category = await this.repository.getCategoryRepo(categoryID)

        logger.info(`End service.category.getCategorySrv, "output": ${JSON.stringify(category)}`)
        return category
    }

    async getCategoryDetailsSrv() {
        logger.info(`Start service.category.getCategoryDetailsSrv`)

        const categories = await this.repository.getCategoryDetailsRepo()

        logger.info(`End service.category.getCategoryDetailsSrv, "output": ${JSON.stringify({ total: categories.length })}`)
        return categories
    }

    async getCategoriesPaginationSrv(query: Pagination) {
        logger.info(`Start service.category.getCategoriesPaginationSrv, "input": ${JSON.stringify(query)}`)

        const data = await this.repository.getCategoriesPaginationRepo(query)

        logger.info(`End service.category.getCategoriesPaginationSrv, "output": ${JSON.stringify({ total: data?.total || 0, length: data?.data?.length || 0 })}`)
        return data
    }

    async getCategoriesSrv() {
        logger.info(`Start service.category.getCategoriesSrv`)

        const categories = await this.repository.getCategoriesRepo()

        logger.info(`End service.category.getCategoriesSrv, "total": ${categories.length}`)
        return categories
    }

    async upsertCategorySrv(category: Category) {
        logger.info(`Start service.category.upsertCategorySrv, "input": ${JSON.stringify(category)}`)

        category.categoryHexColor = category.categoryHexColor.toUpperCase()

        if (category.categoryID) {
            await this.repository.updateCategoryRepo(category)
        } else {
            await this.repository.createCategoryRepo(category)
        }

        logger.info(`End service.category.upsertCategorySrv`)
    }

    async deleteCategorySrv(categoryID: number) {
        logger.info(`Start service.category.deleteCategorySrv, "input": ${JSON.stringify({categoryID})}`)

        await this.repository.deleteCategoryRepo(categoryID)

        logger.info(`End service.category.deleteCategorySrv`)
    }
}