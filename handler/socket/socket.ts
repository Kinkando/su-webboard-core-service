import { Server as SocketServer } from "socket.io"
import { Server } from 'http'
import logger from "../../util/logger"

interface SocketClient {
    socketID: string
    sessionUUID: string
    room: string
}

export function newSocket(server: Server) {
    let socketClients: SocketClient[] = []
    const uniqueSessionUUIDs = new Set<string>()

    const io = new SocketServer(server, { cors: { origin: '*' } })
    io.on('connection', socket => {
        socket.on('ping', () => socket.emit('pong', { message: 'pong' }))
        socket.on('join', (data: {room: string, sessionUUID: string}) => {
            socketClients = socketClients.filter(client => {
                const isMatch = client.sessionUUID === data.sessionUUID
                if (isMatch) {
                    const matchSocket = io.sockets.sockets.get(client.socketID)
                    matchSocket?.leave(client.room)
                    logger.warn(`Client socket is leave room by duplicate sessionUUID with socket id: ${socket.id}, room: ${client.room}, sessionUUID: ${client.sessionUUID}`)
                }
                return !isMatch
            })
            socketClients.push({
                room: data.room,
                sessionUUID: data.sessionUUID,
                socketID: socket.id,
            })
            socket.join(data.room)
            uniqueSessionUUIDs.add(data.sessionUUID)
            logger.debug(`Client is connected to socket with id: ${socket.id}, room: ${data.room}, sessionUUID: ${data.sessionUUID}`)

            // if (!uniqueSessionUUIDs.has(data.sessionUUID)) {
            //     uniqueSessionUUIDs.add(data.sessionUUID)
            //     socketClients.push({
            //         room: data.room,
            //         sessionUUID: data.sessionUUID,
            //         socketID: socket.id,
            //     })
            //     socket.join(data.room)
            //     logger.debug(`Client is connected to socket with id: ${socket.id}, room: ${data.room}, sessionUUID: ${data.sessionUUID}`)
            // }

            // if (!socketClients.find(socket => socket.sessionUUID !== data.sessionUUID)) {
            //     socketClients.push({
            //         room: data.room,
            //         sessionUUID: data.sessionUUID,
            //         socketID: socket.id,
            //     })
            //     socket.join(data.room)
            //     logger.debug(`Client is connected to socket with id: ${socket.id}, room: ${data.room}, sessionUUID: ${data.sessionUUID}`)
            //     console.log('$$$$$$$ SOCKET COUNTS:',socketClients.length)
            // }
        })
        socket.on('disconnect', reason => {
            logger.warn(`Client is disconnected to socket with id: ${socket.id}`)
            const socketClient = socketClients.find(client => client.socketID === socket.id)
            if (socketClient) {
                socketClients = socketClients.filter(client => client.socketID !== socket.id)
                uniqueSessionUUIDs.delete(socketClient.sessionUUID)
                socket.leave(socketClient.room)
                logger.warn(`Client is disconnected to socket with id: ${socket.id}, room: ${socketClient.room}, sessionUUID: ${socketClient.sessionUUID}, reason: ${JSON.stringify(reason)}`)
            }
        })
    })

    return io
}