import * as mongoDB from "mongodb";
import { DatabaseConfiguration } from "@config/config";

export default async function newConnection(mongoConfig: DatabaseConfiguration) {
    const client: mongoDB.MongoClient = new mongoDB.MongoClient(mongoConfig.connectString);
    await client.connect();
    const db: mongoDB.Db = client.db(mongoConfig.auth.dbName);
    return db
}