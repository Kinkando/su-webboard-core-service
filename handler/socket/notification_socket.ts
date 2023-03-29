import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

export function newNotificationSocket(io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
    return new NotificationSocket(io)
}

export class NotificationSocket {
    constructor( private io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> ) {}
}