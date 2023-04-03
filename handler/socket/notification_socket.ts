import logger from '../../util/logger';
import { Namespace, Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

enum NotificationEvent {
    CreateNotification = 'createNotification',
    UpdateNotification = 'updateNotification',
    DeleteNotification = 'deleteNotification',
    ReadNotification = 'readNotification',
}

export function newNotificationSocket(io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
    const notificationNamespace = io.of('/notification')
    notificationNamespace.on('connection', socket => {
        socket.on('ping', () => socket.emit('pong', { message: 'pong' }))
        socket.on('join', (data: {room: string}) => {
            socket.join(data.room)
            logger.debug(`Client is connected to socket with id: ${socket.id}, room: ${data.room} (same with userUUID)`)
        })
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
}