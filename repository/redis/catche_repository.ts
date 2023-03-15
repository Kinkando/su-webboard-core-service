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
    isExistToken(jwt: AccessToken | RefreshToken): Promise<boolean>
    createAccessTokenRepo(accessToken: AccessToken): void
    createRefreshTokenRepo(refreshToken: RefreshToken): void
    revokeAccessTokenRepo(accessToken: AccessToken): void
    revokeRefreshTokenRepo(refreshToken: RefreshToken): void
    revokeExpiredTokensRepo(): void
}

export class CacheRepository implements Repository {
    constructor(private db: RedisClientType) {}

    async isExistToken(jwt: AccessToken | RefreshToken) {
        logger.info(`Start redis.cache.isExistToken, "input": ${JSON.stringify({ jwt })}`)

        const key = `${jwt.type === 'access' ? ACCESS_TOKEN_PREFIX : REFRESH_TOKEN_PREFIX}:${jwt.userType}:${jwt.userUUID}:${jwt.sessionUUID}`
        const isExist = (await this.db.KEYS(key)).length > 0

        logger.info(`End redis.cache.isExistToken, "output": ${JSON.stringify({ isExist })}`)
        return isExist
    }

    async createAccessTokenRepo(accessToken: AccessToken) {
        logger.info(`Start redis.cache.createAccessTokenRepo, "input": ${JSON.stringify({ accessToken })}`)

        const key = tokenKey(accessToken)
        await this.db.SET(key, `${accessToken.iat}:${accessToken.exp}`)

        logger.info(`End redis.cache.createAccessTokenRepo`)
    }

    async createRefreshTokenRepo(refreshToken: RefreshToken) {
        logger.info(`Start redis.cache.createRefreshTokenRepo, "input": ${JSON.stringify({ refreshToken })}`)

        const key = tokenKey(refreshToken)
        await this.db.SET(key, `${refreshToken.iat}:${refreshToken.exp}`)

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

    async revokeExpiredTokensRepo() {
        logger.info(`Start redis.cache.revokeExpiredTokensRepo`)

        const now = Math.floor(new Date().getTime() / 1000)

        let total = 0;

        const tokens = await this.db.KEYS('*')
        for (const key of tokens) {
            const timestamp = await this.db.get(key)
            if (timestamp) {
                const exp = Number(timestamp.split(":")[1])
                if (now > exp) {
                    total++;
                    await this.db.del(key)
                }
            }
        }
        logger.warn(`delete expired token: ${total} token(s)`)

        logger.info(`End redis.cache.revokeExpiredTokensRepo`)
    }
}