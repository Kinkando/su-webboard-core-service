import { Category } from "@model/category";
import { CategoryRepository } from "@repository/mongo/category_repository";
import logger from "@util/logger";

export function newCategoryService(repository: CategoryRepository) {
    return new CategoryService(repository)
}

interface Service {
    upsertCategorySrv(category: Category): void
}

export class CategoryService implements Service {
    constructor(private repository: CategoryRepository) {}

    async upsertCategorySrv(category: Category) {
        logger.info(`Start service.category.upsertCategorySrv, "input": %s`, JSON.stringify(category))

        category.categoryHexColor = category.categoryHexColor.toUpperCase()

        if (category.categoryID) {
            await this.repository.createCategoryRepo(category)
        } else {
            await this.repository.updateCategoryRepo(category)
        }

        logger.info(`End service.category.upsertCategorySrv`)
    }
}