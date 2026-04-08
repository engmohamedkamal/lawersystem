import { Server as SocketServer, Socket } from "socket.io"
import { Server as HttpServer } from "http"
import { TokenType, verifyToken } from "../utils/token"

const onlineUsers = new Map<string, string>()

let io: SocketServer

export const initSocket = (httpServer: HttpServer) => {
    io = new SocketServer(httpServer, {
        cors: {
            origin:      true,
            credentials: true,
        },
    })

    io.use((socket: Socket, next) => {
        try {
            const token = socket.handshake.auth?.token
            if (!token) return next(new Error("unauthorized"))

            const decoded = verifyToken(token)
            if (!decoded) return next(new Error("unauthorized"))

            ;(socket as any).userId = (decoded as any).id
            next()
        } catch {
            next(new Error("unauthorized"))
        }
    })

    io.on("connection", (socket: Socket) => {
        const userId = (socket as any).userId as string
        onlineUsers.set(userId, socket.id)
        console.log(`🟢 user connected: ${userId}`)

        socket.on("disconnect", () => {
            onlineUsers.delete(userId)
            console.log(`🔴 user disconnected: ${userId}`)
        })
    })

    return io
}

export const emitToUser = (userId: string, event: string, data: any) => {
    const socketId = onlineUsers.get(userId)
    if (socketId && io) {
        io.to(socketId).emit(event, data)
    }
}

export const getIO = () => io