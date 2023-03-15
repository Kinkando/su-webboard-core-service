import { RedisClientType } from "redis";
import { AccessToken, RefreshToken } from "../../model/authen";
import logger from "../../util/logger";

const ACCESS_TOKEN_PREFIX = 'ACCESS_TOKEN'
const REFRESH_TOKEN_PREFIX = 'REFRESH_TOKEN'

export function newCacheRepository(redis: RedisClientType) {
    return new CacheRepository(redis)
}

export function tokenKey(token: AccessToken | RefreshToken): string {
    if (token.type === 'access') {
        return `${ACCESS_TOKEN_PREFIX}:${token.userType}:${token.userUUID}:${token.sessionUUID}`
    }
    return `${REFRESH_TOKEN_PREFIX}:${token.userType}:${token.userUUID}:${token.sessionUUID}`
}

interface Repository {
    checkExistRepo(sessionUUID: string): Promise<boolean>
    createAccessTokenRepo(accessToken: AccessToken): void
    createRefreshTokenRepo(refreshToken: RefreshToken): void
    revokeAccessTokenRepo(accessToken: AccessToken): void
    revokeRefreshTokenRepo(refreshToken: RefreshToken): void
}

export class CacheRepository implements Repository {
    constructor(private db: RedisClientType) {}

    async checkExistRepo(sessionUUID: string) {
        logger.info(`Start redis.cache.checkExistRepo, "input": ${JSON.stringify({ sessionUUID })}`)

        const isExist = true

        logger.info(`End redis.cache.checkExistRepo, "output": ${JSON.stringify({ isExist })}`)
        return isExist
    }

    async createAccessTokenRepo(accessToken: AccessToken) {
        logger.info(`Start redis.cache.createAccessTokenRepo, "input": ${JSON.stringify({ accessToken })}`)

        const key = tokenKey(accessToken)
        await this.db.SET(key, key)

        logger.info(`End redis.cache.createAccessTokenRepo`)
    }

    async createRefreshTokenRepo(refreshToken: RefreshToken) {
        logger.info(`Start redis.cache.createRefreshTokenRepo, "input": ${JSON.stringify({ refreshToken })}`)

        const key = tokenKey(refreshToken)
        await this.db.SET(key, key)

        logger.info(`End redis.cache.createRefreshTokenRepo`)
    }

    async revokeAccessTokenRepo(accessToken: AccessToken) {
        logger.info(`Start redis.cache.revokeAccessTokenRepo, "input": ${JSON.stringify({ accessToken })}`)

        const key = tokenKey(accessToken)
        await this.db.DEL(key)

        logger.info(`End redis.cache.revokeAccessTokenRepo`)
    }

    async revokeRefreshTokenRepo(refreshToken: RefreshToken) {
        logger.info(`Start redis.cache.revokeRefreshTokenRepo, "input": ${JSON.stringify({ refreshToken })}`)

        const key = tokenKey(refreshToken)
        await this.db.DEL(key)

        logger.info(`End redis.cache.revokeRefreshTokenRepo`)
    }
}