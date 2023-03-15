import { NextFunction, Request, Response, Router } from 'express';
import * as mongoDB from "mongodb";
import { RedisClientType } from "redis";
import HTTP from '../../common/http';
import logger from '../../util/logger';

export function newHealthHandler(mongoDB: mongoDB.Db, redis: RedisClientType) {
    const healthHandler = new HealthHandler(mongoDB, redis)

    const healthRouter = Router()
    healthRouter.get('/_health', (req, res, next) => healthHandler.health(req, res, next))

    return healthRouter
}

export class HealthHandler {
    constructor(private mongoDB: mongoDB.Db, private redis: RedisClientType) {}

    async health(req: Request, res: Response, next: NextFunction) {
        logger.info("Start http.health.health")

        try {
            const pingRedis = await this.redis.ping("ping")
            const pingMongo = await this.mongoDB.command({ ping: 1 });

            logger.info("End http.health.health")
            return res.status(HTTP.StatusOK).send({ redis: "OK", mongo: "OK" })

        } catch (error) {
            logger.error(error)
            return res.status(HTTP.StatusInternalServerError).send({ error: (error as Error).message })
        }

    }
}