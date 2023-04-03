import express from 'express';
import cors from 'cors'

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
import { newAnnouncementHandler } from '../handler/http/announcement_handler';
import { newAuthenHandler } from '../handler/http/authen_handler';
import { newCategoryHandler } from '../handler/http/category_handler';
import { newHealthHandler } from '../handler/http/health_handler';
import { newHomeHandler } from '../handler/http/home_handler';
import { newCommentHandler } from '../handler/http/comment_handler';
import { newForumHandler } from '../handler/http/forum_handler';
import { newNotificationHandler } from '../handler/http/notification_handler';
import { newUserHandler } from '../handler/http/user_handler';
import { newNotificationSocket } from '../handler/socket/notification_socket';
import { newForumSocket } from '../handler/socket/forum_socket';
import { newSocket } from '../handler/socket/socket';

import { newAuthenService } from '../service/authen_service';
import { newAnnouncementService } from '../service/announcement_service';
import { newCategoryService } from '../service/category_service';
import { newCommentService } from '../service/comment_service';
import { newForumService } from '../service/forum_service';
import { newNotificationService } from '../service/notification_service';
import { newUserService } from '../service/user_service';

import { newAnnouncementRepository } from '../repository/mongo/announcement_repository';
import { newCategoryRepository } from '../repository/mongo/category_repository';
import { newForumRepository } from '../repository/mongo/forum_repository';
import { newCommentRepository } from '../repository/mongo/comment_repository';
import { newNotificationRepository } from '../repository/mongo/notification_repository';
import { newUserRepository } from '../repository/mongo/user_repository';
import { newCacheRepository } from '../repository/redis/cache_repository';

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
    const firebaseAuth = firebaseApp.auth()

    const storage = newCloudStorage(firebaseApp, config.google.storage)

    const sendgrid = newSendGrid(config.sendgrid)

    const middleware = useJWT(config.app.jwtSecretKey, redis as any)

    const server = api.listen(PORT, () => logger.debug(`Server is listening on port :${PORT}`));

    // initialize socket
    const socketServer = newSocket(server)
    const notificationSocket = newNotificationSocket(socketServer)
    const forumSocket = newForumSocket(socketServer)

    // define repo
    const announcementRepository = newAnnouncementRepository(mongoDB)
    const cacheRepository = newCacheRepository(redis as any)
    const categoryRepository = newCategoryRepository(mongoDB)
    const commentRepository = newCommentRepository(mongoDB)
    const forumRepository = newForumRepository(mongoDB)
    const notificationRepository = newNotificationRepository(mongoDB)
    const userRepository = newUserRepository(mongoDB)

    // define service
    const announcementService = newAnnouncementService(announcementRepository, storage)
    const authenService = newAuthenService(config.app, firebaseAuth, cacheRepository)
    const categoryService = newCategoryService(categoryRepository)
    const commentService = newCommentService(commentRepository, storage)
    const forumService = newForumService(forumRepository, storage)
    const notificationService = newNotificationService(notificationRepository, forumService, storage)
    const userService = newUserService(userRepository, firebaseAuth, storage, sendgrid)

    // define handler
    api.use('', newHealthHandler(mongoDB, redis as any))
    api.use('/admin', middleware, newAdminHandler(
        announcementService,
        authenService,
        categoryService,
        commentService,
        forumService,
        userService,
        notificationService,
        forumSocket,
        notificationSocket,
    ))
    api.use('/announcement', middleware, newAnnouncementHandler(announcementService, notificationService, notificationSocket))
    api.use('/authen', newAuthenHandler(config.app.apiKey, googleService, authenService, userService))
    api.use('/category', middleware, newCategoryHandler(categoryService))
    api.use('/home', middleware, newHomeHandler(categoryService, forumService, announcementService))
    api.use('/forum', middleware, newForumHandler(forumService, commentService, notificationService, userService, forumSocket, notificationSocket))
    api.use('/comment', middleware, newCommentHandler(commentService, forumService, notificationService, forumSocket, notificationSocket))
    api.use('/user', middleware, newUserHandler(userService, notificationService, notificationSocket))
    api.use('/notification', middleware, newNotificationHandler(notificationService, notificationSocket))

    return api
}
