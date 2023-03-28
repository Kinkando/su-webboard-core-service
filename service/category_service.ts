import { Pagination } from "../model/common";
import { Category, CategoryDetail } from "../model/category";
import { CategoryRepository } from "../repository/mongo/category_repository";
import logger from "../util/logger";

export function newCategoryService(repository: CategoryRepository) {
    return new CategoryService(repository)
}

interface Service {
    getCategoryDetailsSrv(): Promise<CategoryDetail[]>
    getCategoriesPaginationSrv(query: Pagination): Promise<{ total: number, data: Category[] }>
    getCategoriesSrv(): Promise<Category[]>
    upsertCategorySrv(category: Category): void
    deleteCategoriesSrv(categoryIDs: number[]): void
}

export class CategoryService implements Service {
    constructor(private repository: CategoryRepository) {}

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

    async deleteCategoriesSrv(categoryIDs: number[]) {
        logger.info(`Start service.category.deleteCategoriesSrv, "input": ${JSON.stringify(categoryIDs)}`)

        categoryIDs.forEach(async(categoryID) => await this.repository.deleteCategoryRepo(categoryID))

        logger.info(`End service.category.deleteCategoriesSrv`)
    }
}