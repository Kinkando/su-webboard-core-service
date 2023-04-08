import { Namespace, Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import logger from '../../util/logger';
import { AdminSocket } from './admin_socket';

enum NotificationEvent {
    CreateNotification = 'createNotification',
    UpdateNotification = 'updateNotification',
    DeleteNotification = 'deleteNotification',
    ReadNotification = 'readNotification',
    RefreshNotification = 'refreshNotification',
}

export function newNotificationSocket(io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, adminSocket: AdminSocket) {
    const notificationNamespace = io.of('/notification')
    notificationNamespace.on('connection', socket => {
        socket.on('ping', () => socket.emit('pong', { message: 'pong' }))
        socket.on('join', async (data: {room: string}) => {
            socket.join(data.room)
            logger.debug(`Client is connected to socket with id: ${socket.id}, room: ${data.room} as userUUID`)
            adminSocket.userConnected(data.room, socket.id)
        })
        socket.on('refresh', (userUUID: string) => notificationNamespace.to(userUUID).emit(NotificationEvent.RefreshNotification))
        socket.on('read', (data: {userUUID: string, notiUUID?: string}) => notificationNamespace.to(data.userUUID).emit(NotificationEvent.ReadNotification, data.notiUUID))
        socket.once('disconnect', reason => adminSocket.userDisconnected({socketID: socket.id}))
    })

    return new NotificationSocket(notificationNamespace)
}

export class NotificationSocket {
    constructor( private sockets: Namespace ) {}

    createNotification(userUUID: string, notiUUID: string) {
        logger.info(`Start socket.notification.createNotification, "input": ${JSON.stringify({ userUUID, notiUUID })}`)
        this.sockets.to(userUUID).emit(NotificationEvent.CreateNotification, notiUUID)
        logger.info(`End socket.notification.createNotification`)
    }

    updateNotification(userUUID: string, notiUUID: string, action: 'push' | 'pop') {
        logger.info(`Start socket.notification.updateNotification, "input": ${JSON.stringify({ userUUID, notiUUID, action })}`)
        this.sockets.to(userUUID).emit(NotificationEvent.UpdateNotification, {notiUUID, action})
        logger.info(`End socket.notification.updateNotification`)
    }

    readNotification(userUUID: string, notiUUID?: string) {
        logger.info(`Start socket.notification.readNotification, "input": ${JSON.stringify({ userUUID, notiUUID })}`)
        this.sockets.to(userUUID).emit(NotificationEvent.ReadNotification, notiUUID)
        logger.info(`End socket.notification.readNotification`)
    }

    deleteNotification(userUUID: string, notiUUID: string) {
        logger.info(`Start socket.notification.deleteNotification, "input": ${JSON.stringify({ userUUID, notiUUID })}`)
        this.sockets.to(userUUID).emit(NotificationEvent.DeleteNotification, notiUUID)
        logger.info(`End socket.notification.deleteNotification`)
    }

    refreshNotification(userUUID: string) {
        logger.info(`Start socket.notification.refreshNotification, "input": ${JSON.stringify({ userUUID })}`)
        this.sockets.to(userUUID).emit(NotificationEvent.RefreshNotification)
        logger.info(`End socket.notification.refreshNotification`)
    }
}