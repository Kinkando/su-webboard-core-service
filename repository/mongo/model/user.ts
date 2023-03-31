import { UserType } from '../../../model/authen';
import { model, Schema, Model, Document } from 'mongoose';

const userCollection = "User"

interface IUser extends Document {
    userUUID: string
    userType: UserType
    userDisplayName: string
    userFullName: string
    userEmail: string
    studentID?: string
    userImageURL: string
    firebaseID: string
    lastLogin?: Date
    followerUserUUIDs?: string[]
    followingUserUUIDs?: string[]
    notiUserUUIDs?: string[]
    createdAt: Date
    updatedAt?: Date
}

const userSchema: Schema = new Schema(
    {
        userUUID: { type: String, required: true, unique: true },
        userType: { type: String, required: false },
        userDisplayName: { type: String, required: false },
        userFullName: { type: String, required: false },
        userEmail: { type: String, required: false, unique: true },
        studentID: { type: String, required: false, unique: true },
        userImageURL: { type: String, required: false },
        firebaseID: { type: String, required: false, unique: true },
        lastLogin: { type: Date, required: false },
        followerUserUUIDs: { type: Array<String>, required: false },
        followingUserUUIDs: { type: Array<String>, required: false },
        notiUserUUIDs: { type: Array<String>, required: false },
        createdAt: { type: Date, required: false },
        updatedAt: { type: Date, required: false },
    },
    {
        versionKey: false, // You should be aware of the outcome after set to false
    }
);

const user: Model<IUser> = model(userCollection, userSchema, userCollection) as any;

export default user