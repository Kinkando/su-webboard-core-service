import { model, Schema, Model, Document } from 'mongoose';

const categoryCollection = "Category"

interface ICategory extends Document {
    categoryID: number
    categoryName: string
    categoryHexColor: string
    createdAt: Date
    updatedAt: Date
}

const categorySchema: Schema = new Schema(
    {
        categoryID: { type: Number, unique: true, required: false },
        categoryName: { type: String, unique: true, required: true },
        categoryHexColor: { type: String, unique: true, required: true },
        createdAt: { type: Date, required: false },
        updatedAt: { type: Date, required: false },
    },
    {
        versionKey: false, // You should be aware of the outcome after set to false
    }
);

const category: Model<ICategory> = model(categoryCollection, categorySchema, categoryCollection) as any;

export default category