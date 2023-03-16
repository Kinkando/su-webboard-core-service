import express from 'express';
import cors from 'cors'
import { Server } from 'socket.io';

import { Configuration } from '../config/config';
import { newFirebaseAppWithServiceAccount } from '../cloud/google/firebase';
import { newCloudStorage } from '../cloud/google/storage';
import { newGoogleService } from '../cloud/google/google';
import { newSendGrid } from '../cloud/sendgrid/sendgrid';
import { useJWT } from './middleware/middleware';
import logger from '../util/logger';

import newMongoConnection from '../repository/mongo/mongo';
import newRedisConnection from '../repository/redis/redis';

import { newAdminHandler } from '../handler/http/admin_handler';
import { newAuthenHandler } from '../handler/http/authen_handler';
import { newCategoryHandler } from '../handler/http/category_handler';
import { newHealthHandler } from '../handler/http/health_handler';
import { newUserHandler } from '../handler/http/user_handler';
import { NotificationSocket, newNotificationSocket } from '../handler/socket/notification_socket';
import { ForumSocket, newForumSocket } from '../handler/socket/forum_socket';

import { newAuthenService } from '../service/authen_service';
import { newCategoryService } from '../service/category_service';
import { newUserService } from '../service/user_service';

import { newUserRepository } from '../repository/mongo/user_repository';
import { newCategoryRepository } from '../repository/mongo/category_repository';
import { newCacheRepository } from '../repository/redis/catche_repository';

export default async function init(config: Configuration) {
    const PORT = process.env.PORT || config.app.port;

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

    const server = api.listen(PORT, () => logger.debug(`Server is listening on port :${PORT}`));

    let notificationSocket!: NotificationSocket
    let forumSocket!: ForumSocket

    // initialize socket
    const io = new Server(server, { cors: { origin: '*' } })
    io.on('connection', socket => {
        logger.debug(`Client is connected to socket with id: ${socket.id}`)
        socket.on('ping', () => socket.emit('pong', { message: 'pong' }))
        notificationSocket = newNotificationSocket(io, socket)
        forumSocket = newForumSocket(io, socket)
    })

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
    api.use('/admin', newAdminHandler(authenService, userService, categoryService, notificationSocket))
    api.use('/authen', newAuthenHandler(config.app.apiKey, googleService, authenService, userService))
    api.use('/user', newUserHandler(userService, storage))
    api.use('/category', newCategoryHandler(categoryService))

    return api
}
