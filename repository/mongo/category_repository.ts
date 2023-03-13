import { Category } from "@model/category";
import logger from "@util/logger";
import * as mongoDB from "mongodb";

export function newUserRepository(db: mongoDB.Db) {
    return new CategoryRepository(db)
}

const categoryCollection = "Category"

interface Repository {
    createCategory(category: Category): void
}

export class CategoryRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async createCategory(category: Category) {
        logger.info(`Start mongo.category.createCategory, "input": %s`, JSON.stringify(category))

        logger.info(`End mongo.category.createCategory`)
    }
}