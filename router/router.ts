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
import { newAdminService } from '@service/admin_service';
import { newAdminHandler } from '@handler/http/admin_handler';

export default async function init(config: Configuration) {
    const api = express();
    api.use((_, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader("Content-Type", "application/json");
        next();
    });

    api.use(express.json());
    api.use(express.urlencoded({ extended: false }));
    api.use(useJWT(config.app.jwtSecretKey))

    const mongoDB = await newConnection(config.mongo)

    const firebaseApp = newFirebaseAppWithServiceAccount(config.google.firebaseCredential)

    const storage = newCloudStorage(firebaseApp, config.google.storage)

    // define repo
    const userRepository = newUserRepository(mongoDB)

    // define service
    const adminService = newAdminService(userRepository, firebaseApp, storage)
    const authenService = newAuthenService(config.app.jwtSecretKey, firebaseApp)
    const userService = newUserService(userRepository)

    // define handler
    api.use('/admin', newAdminHandler(adminService))
    api.use('/authen', newAuthenHandler(config.app.apiKey, authenService, userService))
    api.use('/user', newUserHandler(userService, storage))

    return api
}
