import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

export function newForumSocket(io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
    return new ForumSocket(io)
}

export class ForumSocket {
    constructor( private io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> ) {}

    updateForum(userUUID: string, forumUUID: string) {
        this.io.sockets.to(forumUUID).emit('updateForum', userUUID)
    }

    deleteForum(userUUID: string, forumUUID: string) {
        this.io.sockets.to(forumUUID).emit('deleteForum', userUUID)
    }

    createComment(userUUID: string, forumUUID: string, commentUUID: string, replyCommentUUID?: string) {
        this.io.sockets.to(forumUUID).emit('createComment', { editorUUID: userUUID, commentUUID, replyCommentUUID })
    }

    updateComment(userUUID: string, forumUUID: string, commentUUID: string, replyCommentUUID?: string) {
        this.io.sockets.to(forumUUID).emit('updateComment', { editorUUID: userUUID, commentUUID, replyCommentUUID })
    }

    deleteComment(userUUID: string, forumUUID: string, commentUUID: string, replyCommentUUID?: string) {
        this.io.sockets.to(forumUUID).emit('deleteComment', { editorUUID: userUUID, commentUUID, replyCommentUUID })
    }
}