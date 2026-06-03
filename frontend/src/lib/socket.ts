import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

function getBaseUrl(): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  
  return apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl
}

export function getChatSocket(token: string): Socket {
  
  if (socket && socket.connected) return socket

  
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }

  socket = io(`${getBaseUrl()}/chat`, {
    auth:                { token },
    transports:          ['websocket', 'polling'],
    reconnection:        true,
    reconnectionDelay:   1000,
    reconnectionAttempts: 15,
    timeout:             10000,
  })

  return socket
}

export function disconnectChatSocket() {
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
  }
}
