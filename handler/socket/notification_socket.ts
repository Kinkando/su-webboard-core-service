import logger from '@util/logger';
import { Namespace, Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

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
}