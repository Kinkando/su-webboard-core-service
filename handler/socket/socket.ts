import { Server as SocketServer } from "socket.io"
import { Server } from 'http'

export function newSocket(server: Server) {
    return new SocketServer(server, { cors: { origin: '*' } })
}