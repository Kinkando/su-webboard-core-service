import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

export function newNotificationSocket(io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
    const notificationNamespace = io.of('/notification')
    notificationNamespace.on('connection', socket => {
        socket.on('ping', () => socket.emit('pong', { message: 'pong' }))
        // notificationSocketClients.push()
    })

    return new NotificationSocket(io)
}

export class NotificationSocket {
    constructor( private io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> ) {}
}