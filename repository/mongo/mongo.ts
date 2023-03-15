import * as mongoDB from "mongodb";
import { connect } from "mongoose";
import { DatabaseConfiguration } from "../../config/config";
import logger from '../../util/logger';

export default async function newMongoConnection(mongoConfig: DatabaseConfiguration) {
    await connect(mongoConfig.connectString!, { dbName: mongoConfig.auth.dbName })
    const client = new mongoDB.MongoClient(mongoConfig.connectString!);
    client.on('connectionCreated', () => logger.debug('Mongo connected'))
    await client.connect();
    return client.db(mongoConfig.auth.dbName);
}