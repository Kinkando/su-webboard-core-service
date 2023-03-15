import { RedisClientType } from "redis";
import { AccessToken, RefreshToken } from "../../model/authen";
import logger from "../../util/logger";

export function newCacheRepository(redis: RedisClientType) {
    return new CacheRepository(redis)
}

interface Repository {
    checkExistRepo(userUUID: string, sessionUUID: string): boolean
    createAccessTokenRepo(accessToken: AccessToken): void
    createRefreshTokenRepo(refreshToken: RefreshToken): void
    revokeAccessTokenRepo(accessToken: AccessToken): void
    revokeRefreshTokenRepo(refreshToken: RefreshToken): void
}

export class CacheRepository implements Repository {
    constructor(private db: RedisClientType) {}

    checkExistRepo(userUUID: string, sessionUUID: string) {
        logger.info(`Start redis.cache.checkExistRepo, "input": ${JSON.stringify({ userUUID, sessionUUID })}`)

        const isExist = true

        logger.info(`End redis.cache.checkExistRepo, "output": ${JSON.stringify({ isExist })}`)
        return isExist
    }

    createAccessTokenRepo(accessToken: AccessToken) {
        logger.info(`Start redis.cache.createAccessTokenRepo, "input": ${JSON.stringify({ accessToken })}`)

        logger.info(`End redis.cache.createAccessTokenRepo`)
    }

    createRefreshTokenRepo(refreshToken: RefreshToken) {
        logger.info(`Start redis.cache.createRefreshTokenRepo, "input": ${JSON.stringify({ refreshToken })}`)

        logger.info(`End redis.cache.createRefreshTokenRepo`)
    }

    revokeAccessTokenRepo(accessToken: AccessToken) {
        logger.info(`Start redis.cache.revokeAccessTokenRepo, "input": ${JSON.stringify({ accessToken })}`)

        logger.info(`End redis.cache.revokeAccessTokenRepo`)
    }

    revokeRefreshTokenRepo(refreshToken: RefreshToken) {
        logger.info(`Start redis.cache.revokeRefreshTokenRepo, "input": ${JSON.stringify({ refreshToken })}`)

        logger.info(`End redis.cache.revokeRefreshTokenRepo`)
    }
}