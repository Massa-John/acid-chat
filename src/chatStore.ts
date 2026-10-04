import { create } from 'zustand'
import type { Chat, Message } from './types'

interface ChatState {
  chats: Chat[]
  activeChatId: number | null
  messages: Record<number, Message[]>
  setChats: (chats: Chat[]) => void
  setActiveChat: (id: number | null) => void
  setMessages: (chatId: number, messages: Message[], prepend?: boolean) => void
  addMessage: (message: Message) => void
  deleteMessage: (chatId: number, messageId: number) => void
  setPresence: (userId: number, online: boolean) => void
  addChat: (chat: Chat) => void
  reset: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  chats: [],
  activeChatId: null,
  messages: {},
  setChats: (chats) => set({ chats }),
  setActiveChat: (activeChatId) => set({ activeChatId }),
  setMessages: (chatId, incoming, prepend = false) =>
    set((state) => {
      const existing = state.messages[chatId] ?? []
      const combined = prepend ? [...incoming, ...existing] : incoming
      const unique = [...new Map(combined.map((message) => [message.id, message])).values()]
      return { messages: { ...state.messages, [chatId]: unique } }
    }),
  addMessage: (message) =>
    set((state) => {
      const current = state.messages[message.chat_id] ?? []
      if (current.some((item) => item.id === message.id)) return state
      const chats = [...state.chats]
      const chatIndex = chats.findIndex((chat) => chat.id === message.chat_id)
      if (chatIndex >= 0) {
        const [chat] = chats.splice(chatIndex, 1)
        chats.unshift({ ...chat, last_message: message })
      }
      return {
        messages: { ...state.messages, [message.chat_id]: [...current, message] },
        chats,
      }
    }),
  deleteMessage: (chatId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [chatId]: (state.messages[chatId] ?? []).filter((message) => message.id !== messageId),
      },
      chats: state.chats.map((chat) =>
        chat.id === chatId && chat.last_message?.id === messageId
          ? { ...chat, last_message: null }
          : chat,
      ),
    })),
  setPresence: (userId, online) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.peer.id === userId ? { ...chat, peer: { ...chat.peer, online } } : chat,
      ),
    })),
  addChat: (chat) =>
    set((state) => ({
      chats: [chat, ...state.chats.filter((item) => item.id !== chat.id)],
      activeChatId: chat.id,
    })),
  reset: () => set({ chats: [], activeChatId: null, messages: {} }),
}))
