import { Category } from "@model/category";
import logger from "@util/logger";
import * as mongoDB from "mongodb";
import categoryModel from './model/category'

export function newCategoryRepository(db: mongoDB.Db) {
    return new CategoryRepository(db)
}

const categoryCollection = "Category"

interface Repository {
    getCategoriesPaginationRepo(limit: number, offset: number, search?: string): Promise<{ total: number, data: Category[] }>
    getCategoriesRepo(): Promise<Category[]>
    createCategoryRepo(category: Category): void
    updateCategoryRepo(category: Category): void
    deleteCategoryRepo(categoryID: number): void
}

export class CategoryRepository implements Repository {
    constructor(private db: mongoDB.Db) {}

    async getCategoriesPaginationRepo(limit: number, offset: number, search?: string) {
        logger.info(`Start mongo.category.getCategoriesPaginationRepo, "input": %s`, JSON.stringify({limit, offset}))

        const filter = { $regex: `.*${search ?? ''}.*`, $options: "i" }
        const data = (await this.db.collection(categoryCollection).aggregate([
            {$sort: { categoryID: 1 }},
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
                "stage2" : [ { "$skip": offset }, { "$limit": limit || 10 } ],
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

        logger.info(`End mongo.category.getCategoriesPaginationRepo, "output": %s`, JSON.stringify(data))
        return data
    }

    async getCategoriesRepo() {
        logger.info(`Start mongo.category.getCategoriesRepo`)

        const categoryDocs = await this.db.collection<Category>(categoryCollection).find({}, { sort: { categoryID: 1 }}).toArray()
        const categories = categoryDocs.map(category => category as Category)

        logger.info(`End mongo.category.getCategoriesRepo, "output": %s`, JSON.stringify(categories))
        return categories
    }

    async createCategoryRepo(category: Category) {
        logger.info(`Start mongo.category.createCategoryRepo, "input": %s`, JSON.stringify(category))

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
        logger.info(`Start mongo.category.updateCategoryRepo, "input": %s`, JSON.stringify(category))

        await categoryModel.updateOne({ categoryID: category.categoryID }, {...category, createdAt: new Date()})

        logger.info(`End mongo.category.updateCategoryRepo`)
    }

    async deleteCategoryRepo(categoryID: number) {
        logger.info(`Start mongo.category.deleteCategoryRepo, "input": %s`, JSON.stringify(categoryID))

        await this.db.collection(categoryCollection).deleteOne({ categoryID })

        logger.info(`End mongo.category.deleteCategoryRepo`)
    }
}