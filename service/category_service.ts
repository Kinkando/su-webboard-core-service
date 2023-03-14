import { Category } from "../model/category";
import { CategoryRepository } from "../repository/mongo/category_repository";
import logger from "../util/logger";

export function newCategoryService(repository: CategoryRepository) {
    return new CategoryService(repository)
}

interface Service {
    getCategoriesPaginationSrv(limit: number, offset: number, search?: string): Promise<{ total: number, data: Category[] }>
    getCategoriesSrv(): Promise<Category[]>
    upsertCategorySrv(category: Category): void
    deleteCategoriesSrv(categoryIDs: number[]): void
}

export class CategoryService implements Service {
    constructor(private repository: CategoryRepository) {}

    async getCategoriesPaginationSrv(limit: number, offset: number, search?: string) {
        logger.info(`Start service.category.getCategoriesPaginationSrv, "input": %s`, JSON.stringify({limit, offset, search}))

        const data = await this.repository.getCategoriesPaginationRepo(limit, offset, search)

        logger.info(`End service.category.getCategoriesPaginationSrv, "output": %s`, JSON.stringify({ total: data?.total || 0, length: data?.data?.length || 0 }))
        return data
    }

    async getCategoriesSrv() {
        logger.info(`Start service.category.getCategoriesSrv`)

        const categories = await this.repository.getCategoriesRepo()

        logger.info(`End service.category.getCategoriesSrv, "total": ${categories.length}`)
        return categories
    }

    async upsertCategorySrv(category: Category) {
        logger.info(`Start service.category.upsertCategorySrv, "input": %s`, JSON.stringify(category))

        category.categoryHexColor = category.categoryHexColor.toUpperCase()

        if (category.categoryID) {
            await this.repository.updateCategoryRepo(category)
        } else {
            await this.repository.createCategoryRepo(category)
        }

        logger.info(`End service.category.upsertCategorySrv`)
    }

    async deleteCategoriesSrv(categoryIDs: number[]) {
        logger.info(`Start service.category.deleteCategoriesSrv, "input": %s`, JSON.stringify(categoryIDs))

        categoryIDs.forEach(async(categoryID) => await this.repository.deleteCategoryRepo(categoryID))

        logger.info(`End service.category.deleteCategoriesSrv`)
    }
}