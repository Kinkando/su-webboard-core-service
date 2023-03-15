import { DatabaseConfiguration } from '../../config/config';
import { createClient } from 'redis';
import logger from '../../util/logger';

export default async function newRedisConnection(config: DatabaseConfiguration) {
    const client = createClient({
        password: config.auth.password,
        socket: {
            host: config.host,
            port: config.port,
        }
    });
    client.on('connect', () => logger.debug('Redis connected'))
    await client.connect()
    return client
}
