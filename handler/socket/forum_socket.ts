import { Namespace, Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import logger from '../../util/logger';

enum ForumEvent {
    UpdateForum = 'updateForum',
    DeleteForum = 'deleteForum',
    CreateComment = 'createComment',
    UpdateComment = 'updateComment',
    DeleteComment = 'deleteComment',
}

interface SocketClient {
    socketID: string
    sessionUUID: string
    room: string
}

export function newForumSocket(io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
    let forumSocketClients: SocketClient[] = []

    const forumNamespace = io.of('/forum')
    forumNamespace.on('connection', socket => {
        socket.on('ping', () => socket.emit('pong', { message: 'pong' }))
        socket.on('join', (data: {room: string, sessionUUID: string}) => {
            forumSocketClients = forumSocketClients.filter(client => {
                const isMatch = client.sessionUUID === data.sessionUUID
                if (isMatch) {
                    const matchSocket = io.sockets.sockets.get(client.socketID)
                    matchSocket?.leave(client.room)
                    matchSocket?.disconnect()
                    logger.warn(`Client socket is leave room by duplicate sessionUUID with socket id: ${socket.id}, room: ${client.room}, sessionUUID: ${client.sessionUUID}`)
                }
                return !isMatch
            })
            forumSocketClients.push({
                room: data.room,
                sessionUUID: data.sessionUUID,
                socketID: socket.id,
            })
            socket.join(data.room)
            logger.debug(`Client is connected to socket with id: ${socket.id}, room: ${data.room}, sessionUUID: ${data.sessionUUID}`)
        })
        socket.on('disconnect', reason => {
            logger.warn(`Client is disconnected to socket with id: ${socket.id}`)
            const socketClient = forumSocketClients.find(client => client.socketID === socket.id)
            if (socketClient) {
                forumSocketClients = forumSocketClients.filter(client => client.socketID !== socket.id)
                socket.leave(socketClient.room)
                logger.warn(`Client is disconnected to socket with id: ${socket.id}, room: ${socketClient.room}, sessionUUID: ${socketClient.sessionUUID}, reason: ${JSON.stringify(reason)}`)
            }
        })
    })

    return new ForumSocket(forumNamespace)
}

export class ForumSocket {
    constructor( private sockets: Namespace ) {}

    updateForum(sessionUUID: string, forumUUID: string) {
        logger.info(`Start socket.forum.updateForum, "input": ${JSON.stringify({ sessionUUID, forumUUID })}`)
        this.sockets.to(forumUUID).emit(ForumEvent.UpdateForum, sessionUUID)
        logger.info(`End socket.forum.updateForum`)
    }

    deleteForum(sessionUUID: string, forumUUID: string) {
        logger.info(`Start socket.forum.deleteForum, "input": ${JSON.stringify({ sessionUUID, forumUUID })}`)
        this.sockets.to(forumUUID).emit(ForumEvent.DeleteForum, sessionUUID)
        logger.info(`End socket.forum.deleteForum`)
    }

    createComment(sessionUUID: string, forumUUID: string, commentUUID: string, replyCommentUUID?: string) {
        logger.info(`Start socket.forum.createComment, "input": ${JSON.stringify({ sessionUUID, forumUUID, commentUUID, replyCommentUUID })}`)
        this.sockets.to(forumUUID).emit(ForumEvent.CreateComment, { sessionUUID, commentUUID, replyCommentUUID })
        logger.info(`End socket.forum.createComment`)
    }

    updateComment(sessionUUID: string, forumUUID: string, commentUUID: string, replyCommentUUID?: string) {
        logger.info(`Start socket.forum.updateComment, "input": ${JSON.stringify({ sessionUUID, forumUUID, commentUUID, replyCommentUUID })}`)
        this.sockets.to(forumUUID).emit(ForumEvent.UpdateComment, { sessionUUID, commentUUID, replyCommentUUID })
        logger.info(`End socket.forum.updateComment`)
    }

    deleteComment(sessionUUID: string, forumUUID: string, commentUUID: string, replyCommentUUID?: string) {
        logger.info(`Start socket.forum.deleteComment, "input": ${JSON.stringify({ sessionUUID, forumUUID, commentUUID, replyCommentUUID })}`)
        this.sockets.to(forumUUID).emit(ForumEvent.DeleteComment, { sessionUUID, commentUUID, replyCommentUUID })
        logger.info(`End socket.forum.deleteComment`)
    }
}