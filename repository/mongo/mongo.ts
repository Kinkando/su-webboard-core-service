import * as mongoDB from "mongodb";
import { DatabaseConfiguration } from "@config/config";

export default async function newConnection(mongoConfig: DatabaseConfiguration) {
    const client = new mongoDB.MongoClient(mongoConfig.connectString);
    await client.connect();
    return client.db(mongoConfig.auth.dbName);
}