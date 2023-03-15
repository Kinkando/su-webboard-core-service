import express from 'express';
import cors from 'cors'

import { Configuration } from '../config/config';
import { newFirebaseAppWithServiceAccount } from '../cloud/google/firebase';
import { newCloudStorage } from '../cloud/google/storage';
import { newGoogleService } from '../cloud/google/google';
import { newSendGrid } from '../cloud/sendgrid/sendgrid';
import { useJWT } from './middleware/middleware';

import newMongoConnection from '../repository/mongo/mongo';
import newRedisConnection from '../repository/redis/redis';

import { newAdminHandler } from '../handler/http/admin_handler';
import { newAuthenHandler } from '../handler/http/authen_handler';
import { newCategoryHandler } from '../handler/http/category_handler';
import { newHealthHandler } from '../handler/http/health_handler';
import { newUserHandler } from '../handler/http/user_handler';

import { newAuthenService } from '../service/authen_service';
import { newCategoryService } from '../service/category_service';
import { newUserService } from '../service/user_service';

import { newUserRepository } from '../repository/mongo/user_repository';
import { newCategoryRepository } from '../repository/mongo/category_repository';
import { newCacheRepository } from '../repository/redis/catche_repository';

export default async function init(config: Configuration) {
    const api = express();
    api.use(cors({ origin: true }))
    api.use((_, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.setHeader("Content-Type", "application/json");
        next();
    });

    api.use(express.json());
    api.use(express.urlencoded({ extended: false }));

    const mongoDB = await newMongoConnection(config.mongo)

    const redis = await newRedisConnection(config.redis)

    const googleService = newGoogleService()

    const firebaseApp = newFirebaseAppWithServiceAccount(config.google.firebaseCredential)

    const storage = newCloudStorage(firebaseApp, config.google.storage)

    const sendgrid = newSendGrid(config.sendgrid)

    api.use(useJWT(config.app.jwtSecretKey, redis as any))

    // define repo
    const cacheRepository = newCacheRepository(redis as any)
    const categoryRepository = newCategoryRepository(mongoDB)
    const userRepository = newUserRepository(mongoDB)

    // define service
    const authenService = newAuthenService(config.app, firebaseApp, cacheRepository)
    const categoryService = newCategoryService(categoryRepository)
    const userService = newUserService(userRepository, firebaseApp, storage, sendgrid)

    // define handler
    api.use('', newHealthHandler(mongoDB, redis as any))
    api.use('/admin', newAdminHandler(authenService, userService, categoryService))
    api.use('/authen', newAuthenHandler(config.app.apiKey, googleService, authenService, userService))
    api.use('/user', newUserHandler(userService, storage))
    api.use('/category', newCategoryHandler(categoryService))

    return api
}
