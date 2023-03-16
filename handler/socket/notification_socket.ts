import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

export function newNotificationSocket(io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
    return new NotificationSocket(io, socket)
}

export class NotificationSocket {
    constructor(
        private io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
        private socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    ) {}
}