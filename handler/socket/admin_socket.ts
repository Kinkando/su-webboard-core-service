import { Namespace, Server } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { UserService } from '../../service/user_service';
import logger from '../../util/logger';

enum AdminEvent {
    UserConnect = 'userConnected',
    UserUpdate = 'userUpdated',
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
    loginAt: Date
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
            loginAt: new Date(),
        }
        userConnectedList.push(user)
        this.sockets.emit(AdminEvent.UserConnect, {user, socketID})

        logger.info(`End socket.admin.userConnected`)
    }

    async userUpdated(userUUID: string) {
        logger.info(`Start socket.admin.userUpdated, "input": ${JSON.stringify({ userUUID })}`)

        const findIndex = userConnectedList.findIndex(user => user.userUUID === userUUID)
        if (findIndex !== -1) {
            const userProfile = await this.userService.getUserProfileSrv({userUUID})
            if (!userProfile || !userProfile.userUUID) {
                logger.error(`userUUID: ${userUUID} is not found`)
                return
            }

            userConnectedList.forEach((user, index) => {
                if (user.userUUID === userUUID) {
                    userConnectedList[index].userDisplayName = userProfile.userDisplayName!
                    userConnectedList[index].userFullName = userProfile.userFullName!
                    userConnectedList[index].userImageURL = userProfile.userImageURL!
                    if (userConnectedList[index].userType === 'std') {
                        userConnectedList[index].studentID = userProfile.studentID!
                    }
                }
            })
            this.sockets.emit(AdminEvent.UserUpdate, userProfile)
        }

        logger.info(`End socket.admin.userUpdated`)
    }

    async userDisconnected(data: {socketID?: string, userUUID?: string}) {
        logger.info(`Start socket.admin.userDisconnected, "input": ${JSON.stringify(data)}`)

        userConnectedList = userConnectedList.filter(user => {
            if (data.socketID) {
                return user.socketID !== data.socketID
            }
            return user.userUUID !== data.userUUID
        })
        this.sockets.emit(AdminEvent.UserDisconnect, data)

        logger.info(`End socket.admin.userDisconnected`)
    }
}