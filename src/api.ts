import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from './authStore'
import type { Chat, Message, TokenPair, User } from './types'

const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/+$/, '')

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})

let refreshRequest: Promise<TokenPair> | null = null

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined
    const excluded = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh']
    if (error.response?.status === 401 && original?._retry) {
      useAuthStore.getState().clearSession()
    }
    if (
      error.response?.status !== 401 ||
      !original ||
      original._retry ||
      excluded.some((path) => original.url?.includes(path))
    ) {
      return Promise.reject(error)
    }

    const refreshToken = useAuthStore.getState().refreshToken
    if (!refreshToken) {
      useAuthStore.getState().clearSession()
      return Promise.reject(error)
    }
    original._retry = true

    try {
      refreshRequest ??= axios
        .post<TokenPair>(`${baseURL}/api/auth/refresh`, { refresh_token: refreshToken })
        .then(({ data }) => {
          useAuthStore.getState().setSession(data)
          return data
        })
        .finally(() => {
          refreshRequest = null
        })
      await refreshRequest
      return api(original)
    } catch (refreshError) {
      useAuthStore.getState().clearSession()
      return Promise.reject(refreshError)
    }
  },
)

export const authApi = {
  async login(login: string, password: string) {
    const { data } = await api.post<TokenPair>('/api/auth/login', { login, password })
    useAuthStore.getState().setSession(data)
    return data
  },
  async register(login: string, password: string) {
    const { data } = await api.post<TokenPair>('/api/auth/register', { login, password })
    useAuthStore.getState().setSession(data)
    return data
  },
  async logout() {
    const { accessToken, refreshToken } = useAuthStore.getState()
    try {
      if (accessToken) await api.post('/api/auth/logout', { refresh_token: refreshToken })
    } finally {
      useAuthStore.getState().clearSession()
    }
  },
}

export const chatApi = {
  async currentUser() {
    const { data } = await api.get<User>('/api/me')
    return data
  },
  async searchUsers(query: string) {
    const { data } = await api.get<User[]>('/api/users/search', { params: { q: query } })
    return data
  },
  async listChats() {
    const { data } = await api.get<Chat[]>('/api/chats')
    return data
  },
  async createChat(login: string) {
    const { data } = await api.post<Chat>('/api/chats', { login })
    return data
  },
  async messages(chatId: number, before = 0) {
    const { data } = await api.get<Message[]>(`/api/chats/${chatId}/messages`, {
      params: { before, limit: 50 },
    })
    return data
  },
  async deleteMessage(messageId: number) {
    await api.delete(`/api/messages/${messageId}`)
  },
}
