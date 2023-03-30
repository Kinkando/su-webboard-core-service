import { Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import logger from '../../util/logger';

enum ForumEvent {
    UpdateForum = 'updateForum',
    DeleteForum = 'deleteForum',
    CreateComment = 'createComment',
    UpdateComment = 'updateComment',
    DeleteComment = 'deleteComment',
}

export function newForumSocket(io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
    return new ForumSocket(io)
}

export class ForumSocket {
    constructor( private io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any> ) {}

    updateForum(sessionUUID: string, forumUUID: string) {
        logger.info(`Start socket.forum.updateForum, "input": ${JSON.stringify({ sessionUUID, forumUUID })}`)
        this.io.sockets.to(forumUUID).emit(ForumEvent.UpdateForum, sessionUUID)
        logger.info(`End socket.forum.updateForum`)
    }

    deleteForum(sessionUUID: string, forumUUID: string) {
        logger.info(`Start socket.forum.deleteForum, "input": ${JSON.stringify({ sessionUUID, forumUUID })}`)
        this.io.sockets.to(forumUUID).emit(ForumEvent.DeleteForum, sessionUUID)
        logger.info(`End socket.forum.deleteForum`)
    }

    createComment(sessionUUID: string, forumUUID: string, commentUUID: string, replyCommentUUID?: string) {
        logger.info(`Start socket.forum.createComment, "input": ${JSON.stringify({ sessionUUID, forumUUID, commentUUID, replyCommentUUID })}`)
        this.io.sockets.to(forumUUID).emit(ForumEvent.CreateComment, { sessionUUID, commentUUID, replyCommentUUID })
        logger.info(`End socket.forum.createComment`)
    }

    updateComment(sessionUUID: string, forumUUID: string, commentUUID: string, replyCommentUUID?: string) {
        logger.info(`Start socket.forum.updateComment, "input": ${JSON.stringify({ sessionUUID, forumUUID, commentUUID, replyCommentUUID })}`)
        this.io.sockets.to(forumUUID).emit(ForumEvent.UpdateComment, { sessionUUID, commentUUID, replyCommentUUID })
        logger.info(`End socket.forum.updateComment`)
    }

    deleteComment(sessionUUID: string, forumUUID: string, commentUUID: string, replyCommentUUID?: string) {
        logger.info(`Start socket.forum.deleteComment, "input": ${JSON.stringify({ sessionUUID, forumUUID, commentUUID, replyCommentUUID })}`)
        this.io.sockets.to(forumUUID).emit(ForumEvent.DeleteComment, { sessionUUID, commentUUID, replyCommentUUID })
        logger.info(`End socket.forum.deleteComment`)
    }
}