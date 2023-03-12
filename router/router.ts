import express from 'express';
import { Configuration } from '@config/config';
import newConnection from '@repository/mongo/mongo';
import { newUserRepository } from '@repository/mongo/user_repository';
import { newUserHandler } from '@handler/http/user_handler';
import { newUserService } from '@service/user_service';

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

    // define repo
    const userRepository = newUserRepository(mongoDB)

    // define service
    const userService = newUserService(userRepository)

    // define handler
    newUserHandler(app, userService)

    return app
}
