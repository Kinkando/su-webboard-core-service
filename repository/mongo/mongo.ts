import * as mongoDB from "mongodb";
import { DatabaseConfiguration } from "@config/config";
import { connect } from "mongoose";

export default async function newConnection(mongoConfig: DatabaseConfiguration) {
    await connect(mongoConfig.connectString, { dbName: mongoConfig.auth.dbName })
    const client = new mongoDB.MongoClient(mongoConfig.connectString);
    await client.connect();
    return client.db(mongoConfig.auth.dbName);
}