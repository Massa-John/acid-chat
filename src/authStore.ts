import { create } from 'zustand'
import { useChatStore } from './chatStore'
import type { TokenPair, User } from './types'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  setSession: (tokens: TokenPair) => void
  setUser: (user: User) => void
  clearSession: () => void
}

function readSession(): Pick<AuthState, 'accessToken' | 'refreshToken' | 'user'> {
  try {
    const value = sessionStorage.getItem('acid-chat-session')
    if (!value) return { accessToken: null, refreshToken: null, user: null }
    const parsed = JSON.parse(value) as TokenPair
    if (!parsed.access_token || !parsed.refresh_token || !parsed.user) {
      sessionStorage.removeItem('acid-chat-session')
      return { accessToken: null, refreshToken: null, user: null }
    }
    return { accessToken: parsed.access_token, refreshToken: parsed.refresh_token, user: parsed.user }
  } catch {
    return { accessToken: null, refreshToken: null, user: null }
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...readSession(),
  setSession: (tokens) => {
    sessionStorage.setItem('acid-chat-session', JSON.stringify(tokens))
    set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, user: tokens.user })
  },
  setUser: (user) =>
    set((state) => {
      const value = sessionStorage.getItem('acid-chat-session')
      if (value) {
        try {
          sessionStorage.setItem('acid-chat-session', JSON.stringify({ ...JSON.parse(value), user }))
        } catch {
          sessionStorage.removeItem('acid-chat-session')
        }
      }
      return { ...state, user }
    }),
  clearSession: () => {
    sessionStorage.removeItem('acid-chat-session')
    useChatStore.getState().reset()
    set({ accessToken: null, refreshToken: null, user: null })
  },
}))
