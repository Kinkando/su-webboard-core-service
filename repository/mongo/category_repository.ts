import { Category, CategoryDetail } from "../../model/category";
import logger from "../../util/logger";
import * as mongoDB from "mongodb";
import categoryModel from './model/category'
import { Pagination } from "../../model/common";
import { ForumCollection } from "./forum_repository";

export function newCategoryRepository(db: mongoDB.Db) {
    return new CategoryRepository(db)
}

export const CategoryCollection = "Category"

interface Repository {
    getCategoryDetailsRepo(): Promise<CategoryDetail[]>
    getCategoriesPaginationRepo(query: Pagination): Promise<{ total: number, data: Category[] }>
    getCategoriesRepo(): Promise<Category[]>
    getCategoryRepo(categoryID: number): Promise<Category | null>
    createCategoryRepo(category: Category): void
    updateCategoryRepo(category: Category): void
    deleteCategoryRepo(categoryID: number): void
}

export class CategoryRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getCategoryDetailsRepo() {
        logger.info(`Start mongo.category.getCategoryDetailsRepo`)

        const categories = await this.db.collection(CategoryCollection).aggregate([
            {$lookup: {
                from: ForumCollection,
                localField: 'categoryID',
                foreignField: 'categoryIDs',
                as: 'forums'
            }},
            {$addFields: {
                forumCount: { $size: { "$ifNull": [ "$forums", [] ] } },
                lastActive: { $max: '$forums.createdAt' },
            }},
            {$sort: { categoryName: 1 }},
        ]).map(doc => {
            delete doc._id
            delete doc._createdAt
            delete doc._updatedAt
            delete doc.categories
            return doc as CategoryDetail
        }).toArray()

        logger.info(`End mongo.category.getCategoryDetailsRepo, "output": ${JSON.stringify(categories)}`)
        return categories
    }

    async getCategoriesPaginationRepo(query: Pagination) {
        logger.info(`Start mongo.category.getCategoriesPaginationRepo, "input": ${JSON.stringify(query)}`)

        let sort: Record<string, 1 | -1> = {}
        if (query.sortBy) {
            for(let sortField of query.sortBy.split(',')) {
                sortField = sortField.trim()
                const sortOption = sortField.split("@")
                const field = sortOption[0].trim()
                sort[field] = sortOption.length > 1 && sortOption[1].toLowerCase().trim() === 'desc' ? -1 : 1
            }
        } else {
            sort = { categoryID: 1 }
        }

        const filter = { $regex: `.*${query.search ?? ''}.*`, $options: "i" }
        const data = (await this.db.collection(CategoryCollection).aggregate([
            {$sort: sort},
            {$match:{
                $and: [
                    { $or: [
                        { categoryID: filter },
                        { categoryName: filter },
                        { categoryHexColor: filter },
                    ]}
                ]
            }},
            {$facet:{
                "stage1" : [ { "$group": { _id: null, count: { $sum: 1 } } } ],
                "stage2" : [ { "$skip": query.offset }, { "$limit": query.limit || 10 } ],
            }},
            {$unwind: "$stage1"},

            //output projection
            {$project:{
                total: "$stage1.count",
                data: "$stage2"
            }}
        ]).map(doc => {
            const data: Category[] = []
            doc.data.forEach((category: Category) => {
                data.push({
                    categoryID: category.categoryID,
                    categoryName: category.categoryName,
                    categoryHexColor: category.categoryHexColor,
                })
            })
            return { total: Number(doc.total), data }
        }).toArray())[0];

        logger.info(`End mongo.category.getCategoriesPaginationRepo, "output": ${JSON.stringify(data)}`)
        return data
    }

    async getCategoriesRepo() {
        logger.info(`Start mongo.category.getCategoriesRepo`)

        const categoryDocs = await this.db.collection<Category>(CategoryCollection).find({}, { sort: { categoryName: 1 }}).toArray()
        const categories = categoryDocs.map<Category>(category => {
            return {
                categoryID: category.categoryID,
                categoryName: category.categoryName,
                categoryHexColor: category.categoryHexColor,
            }
        })

        logger.info(`End mongo.category.getCategoriesRepo, "output": ${JSON.stringify(categories)}`)
        return categories
    }

    async getCategoryRepo(categoryID: number) {
        logger.info(`Start mongo.category.getCategoryRepo, "input": ${JSON.stringify({categoryID})}`)

        const category = await this.db.collection<Category>(CategoryCollection).findOne({categoryID})

        logger.info(`End mongo.category.getCategoryRepo, "output": ${JSON.stringify(category)}`)
        return category as Category
    }

    async createCategoryRepo(category: Category) {
        logger.info(`Start mongo.category.createCategoryRepo, "input": ${JSON.stringify(category)}`)

        await categoryModel.find().then(async(docs) => {
            let categoryID = 1;
            while(docs.find(doc => doc.categoryID === categoryID)) {
                categoryID++;
            }
            await categoryModel.create({categoryID, ...category, createdAt: new Date()})
        })

        logger.info(`End mongo.category.createCategoryRepo`)
    }

    async updateCategoryRepo(category: Category) {
        logger.info(`Start mongo.category.updateCategoryRepo, "input": ${JSON.stringify(category)}`)

        await categoryModel.updateOne({ categoryID: category.categoryID }, {...category, updatedAt: new Date()})

        logger.info(`End mongo.category.updateCategoryRepo`)
    }

    async deleteCategoryRepo(categoryID: number) {
        logger.info(`Start mongo.category.deleteCategoryRepo, "input": ${JSON.stringify(categoryID)}`)

        await this.db.collection(CategoryCollection).deleteOne({ categoryID })

        logger.info(`End mongo.category.deleteCategoryRepo`)
    }
}