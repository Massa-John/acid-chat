import { useAuthStore } from './authStore'
import { chatApi } from './api'
import type { RealtimeEvent } from './types'

const socketUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/ws'

export function connectRealtime(
  onEvent: (event: RealtimeEvent) => void,
  onStatus: (connected: boolean) => void,
) {
  let socket: WebSocket | null = null
  let disposed = false
  let reconnectTimer: number | undefined
  let pingTimer: number | undefined
  let retry = 0

  const connect = () => {
    if (disposed) return
    const token = useAuthStore.getState().accessToken
    if (!token) return
    socket = new WebSocket(`${socketUrl}${socketUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`)
    socket.onopen = () => {
      retry = 0
      onStatus(true)
      pingTimer = window.setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'ping', data: null }))
      }, 25_000)
    }
    socket.onmessage = (event) => {
      try {
        onEvent(JSON.parse(event.data) as RealtimeEvent)
      } catch {
        // Ignore malformed server events and keep the connection alive.
      }
    }
    socket.onclose = () => {
      if (pingTimer) window.clearInterval(pingTimer)
      onStatus(false)
      if (disposed) return
      const delay = Math.min(1_000 * 2 ** retry, 15_000)
      retry += 1
      reconnectTimer = window.setTimeout(() => {
        void chatApi.currentUser().catch(() => undefined).finally(connect)
      }, delay)
    }
    socket.onerror = () => socket?.close()
  }

  connect()
  return {
    send(type: string, data: unknown) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false
      socket.send(JSON.stringify({ type, data }))
      return true
    },
    close() {
      disposed = true
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      if (pingTimer) window.clearInterval(pingTimer)
      socket?.close()
    },
  }
}
