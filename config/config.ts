import dotenv from 'dotenv';
dotenv.config();

export interface Configuration {
    readonly app: AppConfiguration
    readonly mongo: DatabaseConfiguration
}

export interface AppConfiguration {
    readonly port: number
}

export interface DatabaseConfiguration {
    readonly host?: string
    readonly port?: number
    readonly auth: AuthConfiguration
    connectString: string
}

export interface AuthConfiguration {
    readonly dbName: string
    readonly username: string
    readonly password: string
}

const config: Configuration = {
    app: {
        port: Number(process.env.APP_PORT!),
    },
    mongo: {
        connectString: process.env.MONGO_CONNECTION_STRING!,
        auth:{
            dbName: process.env.MONGO_DATABASE!,
            username: process.env.MONGO_USERNAME!,
            password: process.env.MONGO_PASSWORD!,
        }
    }
}
config.mongo.connectString = config.mongo.connectString
                                .replace("${USERNAME}", config.mongo.auth.username)
                                .replace("${PASSWORD}", config.mongo.auth.password)

export default config