import { Namespace, Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { UserService } from '../../service/user_service';
import logger from '../../util/logger';

enum AdminEvent {
    UserConnect = 'userConnected',
    UserDisconnect = 'userDisconnected',
    AdminConnect = 'adminConnected'
}

interface User {
    socketID: string
    userUUID: string
    userType: string
    userDisplayName: string
    userFullName: string
    userImageURL: string
    studentID?: string
}

let userConnectedList: User[] = []

export function newAdminSocket(io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, userService: UserService) {
    const adminNamespace = io.of('/admin')
    adminNamespace.on('connection', socket => {
        socket.on('ping', () => socket.emit('pong', { message: 'pong' }))
        logger.debug(`admin is connected to socket namespace "/admin" with socket id: ${socket.id}`)
        socket.emit(AdminEvent.AdminConnect, userConnectedList)
    })

    return new AdminSocket(adminNamespace, userService)
}

export class AdminSocket {
    constructor( private sockets: Namespace, private userService: UserService ) {}

    async userConnected(userUUID: string, socketID: string) {
        logger.info(`Start socket.admin.userConnected, "input": ${JSON.stringify({ userUUID, socketID })}`)

        const userProfile = await this.userService.getUserProfileSrv({userUUID})
        if (!userProfile || !userProfile.userUUID) {
            logger.error(`userUUID: ${userUUID} is not found`)
            return
        }

        const user: User = {
            socketID,
            userUUID,
            userType: userProfile.userType!,
            userDisplayName: userProfile.userDisplayName!,
            userFullName: userProfile.userFullName!,
            userImageURL: userProfile.userImageURL!,
            studentID: userProfile.studentID,
        }
        userConnectedList.push(user)
        this.sockets.emit(AdminEvent.UserConnect, {user, socketID})

        logger.info(`End socket.admin.userConnected`)
    }

    async userDisconnected(socketID: string) {
        logger.info(`Start socket.admin.userDisconnected, "input": ${JSON.stringify({ socketID })}`)

        userConnectedList = userConnectedList.filter(user => user.socketID !== socketID)
        this.sockets.emit(AdminEvent.UserDisconnect, socketID)

        logger.info(`End socket.admin.userDisconnected`)
    }
}