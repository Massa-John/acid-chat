export interface User {
  id: number
  login: string
  online: boolean
}

export interface Message {
  id: number
  chat_id: number
  sender_id: number
  body: string
  created_at: string
}

export interface Chat {
  id: number
  peer: User
  last_message?: Message | null
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  expires_in: number
  user: User
}

export interface RealtimeEvent {
  type: 'message.new' | 'message.deleted' | 'presence' | 'error' | 'pong' | string
  data: Message | { id: number; chat_id: number } | { user_id: number; online: boolean } | { error: string } | null
}
