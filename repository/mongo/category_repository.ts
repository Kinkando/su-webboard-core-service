import { Category } from "@model/category";
import logger from "@util/logger";
import * as mongoDB from "mongodb";

export function newCategoryRepository(db: mongoDB.Db) {
    return new CategoryRepository(db)
}

const categoryCollection = "Category"

interface Repository {
    getCategoriesRepo(limit?: number, offset?: number): Promise<Category[]>
    createCategoryRepo(category: Category): void
    updateCategoryRepo(category: Category): void
    deleteCategoryRepo(categoryID: number): void
}

export class CategoryRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getCategoriesRepo(limit?: number, offset?: number) {
        logger.info(`Start mongo.category.getCategoriesRepo, "input": %s`, JSON.stringify({limit, offset}))

        // await this.db.collection(categoryCollection).insertOne({...category, createdAt: new Date()})
        const categories: Category[] = []

        logger.info(`End mongo.category.getCategoriesRepo, "output": %s`, JSON.stringify(categories))
        return categories
    }

    async createCategoryRepo(category: Category) {
        logger.info(`Start mongo.category.createCategoryRepo, "input": %s`, JSON.stringify(category))

        await this.db.collection(categoryCollection).insertOne({...category, createdAt: new Date()})

        logger.info(`End mongo.category.createCategoryRepo`)
    }

    async updateCategoryRepo(category: Category) {
        logger.info(`Start mongo.category.updateCategoryRepo, "input": %s`, JSON.stringify(category))

        await this.db.collection(categoryCollection).updateOne({ categoryID: category.categoryID }, {...category, updatedAt: new Date()})

        logger.info(`End mongo.category.updateCategoryRepo`)
    }

    async deleteCategoryRepo(categoryID: number) {
        logger.info(`Start mongo.category.deleteCategoryRepo, "input": %s`, JSON.stringify(categoryID))

        await this.db.collection(categoryCollection).deleteOne({ categoryID })

        logger.info(`End mongo.category.deleteCategoryRepo`)
    }
}