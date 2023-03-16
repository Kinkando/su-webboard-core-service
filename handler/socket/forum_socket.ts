import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

export function newForumSocket(io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
    return new ForumSocket(io, socket)
}

export class ForumSocket {
    constructor(
        private io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
        private socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>,
    ) {}
}