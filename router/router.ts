import express from 'express';
import { Configuration } from '@config/config';
import newConnection from '@repository/mongo/mongo';
import { newUserRepository } from '@repository/mongo/user_repository';
import { newUserHandler } from '@handler/http/user_handler';
import { newUserService } from '@service/user_service';
import { newFirebaseAppWithServiceAccount } from '@cloud/google/firebase';
import { newAuthenService } from '@service/authen_service';
import { newAuthenHandler } from '@handler/http/authen_handler';

export default async function init(config: Configuration) {
    const app = express();
    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader("Content-Type", "application/json");
        next();
    });

    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    const mongoDB = await newConnection(config.mongo)

    const firebaseApp = newFirebaseAppWithServiceAccount(config.firebaseCredential)

    // define repo
    const userRepository = newUserRepository(mongoDB)

    // define service
    const userService = newUserService(userRepository)
    const authenService = newAuthenService(config.app.jwtSecretKey, firebaseApp)

    // define handler
    newAuthenHandler(app, config.app.apiKey, authenService, userService)
    newUserHandler(app, userService)

    return app
}
