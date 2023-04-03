import dotenv from 'dotenv';
dotenv.config();

export interface Configuration {
    readonly app: AppConfiguration
    readonly mongo: DatabaseConfiguration
    readonly redis: DatabaseConfiguration
    readonly google: GoogleConfiguration
    readonly sendgrid: SendGridConfiguration
}

export interface AppConfiguration {
    readonly port: number
    readonly apiKey: string
    readonly jwtSecretKey: string
    readonly jwtAccessExpire: string
    readonly jwtRefreshExpire: string
    readonly defaultPassword: string
}

export interface DatabaseConfiguration {
    readonly host?: string
    readonly port?: number
    readonly auth: AuthConfiguration
    connectString?: string
}

export interface AuthConfiguration {
    readonly dbName: string
    readonly username: string
    readonly password: string
}

export interface GoogleConfiguration {
    readonly storage: StorageConfiguration
    readonly firebaseCredential: FirebaseCredentialConfiguration
    // readonly googleCredential: GoogleCredentialConfiguration
}

export interface StorageConfiguration {
    readonly bucketName: string
    readonly expireTime: number
}

export interface FirebaseCredentialConfiguration {
    readonly type: string
    readonly projectId: string
    readonly privateKeyId: string
    readonly privateKey: string
    readonly clientEmail: string
    readonly clientId: string
    readonly authUri: string
    readonly tokenUri: string
    readonly authProviderX509CertUrl: string
    readonly clientX509CertUrl: string
}

// export interface GoogleCredentialConfiguration {
//     readonly clientId: string
//     readonly projectId: string
//     readonly authUri: string
//     readonly tokenUri: string
//     readonly authProviderX509CertUrl: string
//     readonly clientSecret: string
//     readonly redirectUris: string[]
//     readonly javascriptOrigins: string[]
// }

export interface SendGridConfiguration {
    readonly apiKey: string
    readonly senderEmail: string
}

const config: Configuration = {
    app: {
        port: Number(process.env.APP_PORT!),
        apiKey: process.env.APP_API_KEY!,
        jwtSecretKey: process.env.APP_JWT_SECRET_KEY!,
        jwtAccessExpire: process.env.APP_JWT_ACCESS_EXPIRE!,
        jwtRefreshExpire: process.env.APP_JWT_REFRESH_EXPIRE!,
        defaultPassword: process.env.APP_DEFAULT_PASSWORD!,
    },
    mongo: {
        connectString: process.env.MONGO_CONNECTION_STRING!,
        auth:{
            dbName: process.env.MONGO_DATABASE!,
            username: process.env.MONGO_USERNAME!,
            password: process.env.MONGO_PASSWORD!,
        }
    },
    redis: {
        host: process.env.REDIS_HOST!,
        port: Number(process.env.REDIS_PORT!),
        auth:{
            dbName: process.env.REDIS_DATABASE!,
            username: process.env.REDIS_USERNAME!,
            password: process.env.REDIS_PASSWORD!,
        }
    },
    google: {
        storage: {
            bucketName: process.env.FIREBASE_STORAGE_BUCKET_NAME!,
            expireTime: Number(process.env.FIREBASE_STORAGE_EXPIRE_TIME),
        },
        firebaseCredential: {
            type: process.env.FIREBASE_TYPE!,
            projectId: process.env.FIREBASE_PROJECT_ID!,
            privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID!,
            privateKey: process.env.FIREBASE_PRIVATE_KEY!,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
            clientId: process.env.FIREBASE_CLIENT_ID!,
            authUri: process.env.FIREBASE_AUTH_URI!,
            tokenUri: process.env.FIREBASE_TOKEN_URI!,
            authProviderX509CertUrl: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL!,
            clientX509CertUrl: process.env.FIREBASE_CLIENT_CERT_URL!,
        },
        // googleCredential: {
        //     clientId: process.env.GOOGLE_PROJECT_ID!,
        //     projectId: process.env.GOOGLE_CLIENT_ID!,
        //     authUri: process.env.GOOGLE_CLIENT_SECRET!,
        //     tokenUri: process.env.GOOGLE_AUTH_URI!,
        //     authProviderX509CertUrl: process.env.GOOGLE_TOKEN_URI!,
        //     clientSecret: process.env.GOOGLE_AUTH_PROVIDER_x509_CERT_URL!,
        //     redirectUris: [
        //         process.env.GOOGLE_REDIRECT_URIS1!,
        //         process.env.GOOGLE_REDIRECT_URIS2!,
        //         process.env.GOOGLE_REDIRECT_URIS3!,
        //     ],
        //     javascriptOrigins: [
        //         process.env.GOOGLE_JAVASCRIPT_ORIGINS1!,
        //         process.env.GOOGLE_JAVASCRIPT_ORIGINS2!,
        //         process.env.GOOGLE_JAVASCRIPT_ORIGINS3!,
        //         process.env.GOOGLE_JAVASCRIPT_ORIGINS4!,
        //     ],
        // }
    },
    sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY!,
        senderEmail: process.env.SENDGRID_SENDER_EMAIL!,
    },
}
config.mongo.connectString = config.mongo.connectString?.replace("${USERNAME}", config.mongo.auth.username).replace("${PASSWORD}", config.mongo.auth.password)

export default config