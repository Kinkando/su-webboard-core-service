import express from 'express';
import { Configuration } from '@config/config';
import newConnection from '@repository/mongo/mongo';
import { newUserRepository } from '@repository/mongo/user_repository';
import { newUserHandler } from '@handler/http/user_handler';
import { newUserService } from '@service/user_service';
import { newFirebaseAppWithServiceAccount } from '@cloud/google/firebase';
import { newAuthenService } from '@service/authen_service';
import { newAuthenHandler } from '@handler/http/authen_handler';
import { useJWT } from './middleware/middleware';
import { newCloudStorage } from '@cloud/google/storage';
import { newAdminHandler } from '@handler/http/admin_handler';
import { newSendGrid } from '@cloud/sendgrid/sendgrid';
import { newCategoryRepository } from '@repository/mongo/category_repository';
import { newCategoryService } from '@service/category_service';
import { newCategoryHandler } from '@handler/http/category_handler';

export default async function init(config: Configuration) {
    const api = express();
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
    api.use(useJWT(config.app.jwtSecretKey))

    const mongoDB = await newConnection(config.mongo)

    const firebaseApp = newFirebaseAppWithServiceAccount(config.google.firebaseCredential)

    const storage = newCloudStorage(firebaseApp, config.google.storage)

    const sendgrid = newSendGrid(config.sendgrid)

    // define repo
    const categoryRepository = newCategoryRepository(mongoDB)
    const userRepository = newUserRepository(mongoDB)

    // define service
    const authenService = newAuthenService(config.app.jwtSecretKey, firebaseApp)
    const categoryService = newCategoryService(categoryRepository)
    const userService = newUserService(userRepository, firebaseApp, storage, sendgrid)

    // define handler
    api.use('/admin', newAdminHandler(userService, categoryService))
    api.use('/authen', newAuthenHandler(config.app.apiKey, authenService, userService))
    api.use('/user', newUserHandler(userService, storage))
    api.use('/category', newCategoryHandler(categoryService))

    return api
}
