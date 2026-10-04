import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { authApi, chatApi, api } from './api'
import { useAuthStore } from './authStore'
import { useChatStore } from './chatStore'
import { connectRealtime } from './realtime'
import type { Chat, Message, RealtimeEvent, User } from './types'

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error ?? error.message ?? 'The service is unavailable.'
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const registering = mode === 'register'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!/^[a-z]{3,32}$/.test(login)) {
      setError('Login must be 3–32 lowercase letters (a–z).')
      return
    }
    if (password.length < 6 || password.length > 72) {
      setError('Password must contain 6–72 characters.')
      return
    }
    setBusy(true)
    try {
      if (registering) await authApi.register(login, password)
      else await authApi.login(login, password)
      navigate('/', { replace: true })
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-card panel">
        <a className="wordmark" href="/" aria-label="ACID Chat home">ACID<span>//</span>CHAT</a>
        <div className="eyebrow">PRIVATE CHANNEL / 01</div>
        <h1>{registering ? 'Create account' : 'Welcome back'}<span className="cursor">_</span></h1>
        <p className="muted">Your people. Your signal. No noise.</p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="login">LOGIN</label>
          <input
            id="login"
            autoComplete="username"
            autoCapitalize="none"
            maxLength={32}
            value={login}
            onChange={(event) => setLogin(event.target.value.toLowerCase())}
            placeholder="e.g. acidfox"
            required
          />
          <label htmlFor="password">PASSWORD</label>
          <input
            id="password"
            type="password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            minLength={6}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>
            {busy ? 'CONNECTING…' : registering ? 'CREATE ACCOUNT ↗' : 'ENTER THE CHAT ↗'}
          </button>
        </form>
        <p className="auth-switch">
          {registering ? 'Already have an account?' : 'New to the network?'}{' '}
          <a href={registering ? '/login' : '/register'}>{registering ? 'Sign in' : 'Register'}</a>
        </p>
        <div className="auth-foot"><span className="status-dot" /> AUTHENTICATED SESSION</div>
      </div>
    </main>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken)
  return accessToken ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  const accessToken = useAuthStore((state) => state.accessToken)
  return (
    <Routes>
      <Route path="/login" element={accessToken ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={accessToken ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route path="/" element={<ProtectedRoute><MessengerPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={accessToken ? '/' : '/login'} replace />} />
    </Routes>
  )
}

function MessengerPage() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const clearSession = useAuthStore((state) => state.clearSession)
  const chats = useChatStore((state) => state.chats)
  const activeChatId = useChatStore((state) => state.activeChatId)
  const messagesByChat = useChatStore((state) => state.messages)
  const setChats = useChatStore((state) => state.setChats)
  const setActiveChat = useChatStore((state) => state.setActiveChat)
  const setMessages = useChatStore((state) => state.setMessages)
  const addMessage = useChatStore((state) => state.addMessage)
  const deleteMessage = useChatStore((state) => state.deleteMessage)
  const setPresence = useChatStore((state) => state.setPresence)
  const addChat = useChatStore((state) => state.addChat)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [searching, setSearching] = useState(false)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const socketRef = useRef<ReturnType<typeof connectRealtime> | null>(null)
  const selectedChat = chats.find((chat) => chat.id === activeChatId) ?? null
  const messages = activeChatId ? messagesByChat[activeChatId] ?? [] : []

  useEffect(() => {
    let mounted = true
    Promise.all([chatApi.currentUser(), chatApi.listChats()])
      .then(([current, list]) => {
        if (!mounted) return
        setUser(current)
        setChats(list)
      })
      .catch((requestError) => {
        if (mounted) setError(errorText(requestError))
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [setChats, setUser])

  useEffect(() => {
    const handleEvent = (event: RealtimeEvent) => {
      if (event.type === 'message.new') addMessage(event.data as Message)
      if (event.type === 'message.deleted') {
        const deleted = event.data as { id: number; chat_id: number }
        deleteMessage(deleted.chat_id, deleted.id)
      }
      if (event.type === 'presence') {
        const presence = event.data as { user_id: number; online: boolean }
        setPresence(presence.user_id, presence.online)
        setResults((existing) => existing.map((item) =>
          item.id === presence.user_id ? { ...item, online: presence.online } : item,
        ))
      }
      if (event.type === 'error') setError((event.data as { error: string }).error)
    }
    socketRef.current = connectRealtime(handleEvent, setConnected)
    return () => socketRef.current?.close()
  }, [addMessage, deleteMessage, setPresence])

  useEffect(() => {
    const cleaned = query.trim()
    if (!cleaned || !/^[a-z]{1,32}$/.test(cleaned)) {
      setResults([])
      setSearching(false)
      return
    }
    let current = true
    const timer = window.setTimeout(() => {
      setSearching(true)
      chatApi.searchUsers(cleaned)
        .then((found) => { if (current) setResults(found) })
        .catch((requestError) => { if (current) setError(errorText(requestError)) })
        .finally(() => { if (current) setSearching(false) })
    }, 250)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    if (activeChatId === null) return
    let current = true
    chatApi.messages(activeChatId)
      .then((items) => { if (current) setMessages(activeChatId, items) })
      .catch((requestError) => { if (current) setError(errorText(requestError)) })
    return () => { current = false }
  }, [activeChatId, setMessages])

  async function openChat(login: string) {
    setError('')
    try {
      const chat = await chatApi.createChat(login)
      addChat(chat)
      setQuery('')
      setResults([])
    } catch (requestError) {
      setError(errorText(requestError))
    }
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      clearSession()
    }
    navigate('/login', { replace: true })
  }

  async function loadEarlier() {
    if (!activeChatId || messages.length === 0) return
    try {
      const older = await chatApi.messages(activeChatId, messages[0].id)
      setMessages(activeChatId, older, true)
    } catch (requestError) {
      setError(errorText(requestError))
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!activeChatId || !body || [...body].length > 4000) return
    setSending(true)
    setError('')
    const delivered = socketRef.current?.send('message.send', { chat_id: activeChatId, body })
    if (!delivered) {
      try {
        const { data } = await api.post<Message>(`/api/chats/${activeChatId}/messages`, { body })
        addMessage(data)
      } catch (requestError) {
        setError(errorText(requestError))
      }
    }
    setDraft('')
    setSending(false)
  }

  async function removeMessage(message: Message) {
    try {
      await chatApi.deleteMessage(message.id)
      deleteMessage(message.chat_id, message.id)
    } catch (requestError) {
      setError(errorText(requestError))
    }
  }

  return (
    <main className="workspace">
      <section className="search-panel panel" aria-label="User search">
        <div className="brand-row">
          <a className="wordmark" href="/" aria-label="ACID Chat home">ACID<span>//</span>CHAT</a>
          <button className="icon-button logout-button" title="Sign out" aria-label="Sign out" onClick={logout}>↗</button>
        </div>
        <div className="account-strip">
          <span className="avatar avatar-self">{user?.login.slice(0, 1).toUpperCase() ?? 'A'}</span>
          <span><strong>{user?.login ?? 'connecting…'}</strong><small>OPERATIVE / ONLINE</small></span>
          <span className="live-indicator" title="Live connection status"><i className={connected ? 'status-dot' : 'status-dot offline'} />{connected ? 'LIVE' : 'LINKING'}</span>
        </div>
        <div className="section-label"><span>01</span> FIND YOUR PEOPLE</div>
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value.toLowerCase())}
            placeholder="Search by login…"
            aria-label="Search users by login"
            autoComplete="off"
            autoCapitalize="none"
          />
          {searching && <span className="mini-loader" />}
        </label>
        <div className="search-results">
          {results.map((result) => (
            <button className="search-result" key={result.id} onClick={() => void openChat(result.login)}>
              <span className="avatar">{result.login[0].toUpperCase()}</span>
              <span className="person-copy"><strong>{result.login}</strong><small>{result.online ? 'ONLINE' : 'OFFLINE'}</small></span>
              <i className={`status-dot ${result.online ? '' : 'offline'}`} />
              <span className="result-arrow">↗</span>
            </button>
          ))}
          {query.length > 0 && !searching && results.length === 0 && /^[a-z]{1,32}$/.test(query) && (
            <p className="empty-hint">No users match this login.</p>
          )}
        </div>
        <div className="search-footer"><span>ACID//NETWORK</span><span>v.01.26</span></div>
      </section>

      <section className="chat-list-panel panel" aria-label="Recent chats">
        <div className="section-heading">
          <div><div className="section-label"><span>02</span> YOUR CHANNELS</div><h2>Recent chats<span className="count-badge">{chats.length.toString().padStart(2, '0')}</span></h2></div>
          <span className="signal-mark">⌁</span>
        </div>
        <div className="chat-list">
          {loading && <div className="empty-state small">SYNCING CHANNELS<span className="loading-line" /></div>}
          {!loading && chats.length === 0 && <div className="empty-state small">No chats yet.<br />Search for someone to start a signal.</div>}
          {chats.map((chat) => <ChatRow key={chat.id} chat={chat} selected={chat.id === activeChatId} onClick={() => setActiveChat(chat.id)} />)}
        </div>
        <div className="list-footer"><span><i className="status-dot" /> ENCRYPTED CHANNELS</span><span>{chats.length} ACTIVE</span></div>
      </section>

      <section className="conversation-panel panel" aria-label="Chat conversation">
        {selectedChat ? (
          <Conversation
            chat={selectedChat}
            messages={messages}
            userId={user?.id}
            draft={draft}
            sending={sending}
            onDraft={setDraft}
            onSend={sendMessage}
            onDelete={(message) => void removeMessage(message)}
            onLoadEarlier={() => void loadEarlier()}
          />
        ) : (
          <div className="conversation-empty">
            <div className="empty-orbit"><span>ACID</span><i>//</i></div>
            <p className="eyebrow">YOUR SIGNAL, YOUR SPACE</p>
            <h1>Pick a channel<span className="cursor">_</span></h1>
            <p className="muted">Choose a recent chat or search for someone<br />to start a new conversation.</p>
            <div className="empty-coordinate">LATENCY: <span>{connected ? 'LOW' : 'SYNCING'}</span><b>·</b> ENCRYPTION: <span>ACTIVE</span></div>
          </div>
        )}
      </section>
      {error && <div className="toast" role="alert"><span>!</span>{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    </main>
  )
}

function ChatRow({ chat, selected, onClick }: { chat: Chat; selected: boolean; onClick: () => void }) {
  return (
    <button className={`chat-row ${selected ? 'selected' : ''}`} onClick={onClick}>
      <span className="avatar chat-avatar">{chat.peer.login[0].toUpperCase()}<i className={`status-dot ${chat.peer.online ? '' : 'offline'}`} /></span>
      <span className="chat-row-copy">
        <span className="chat-row-title"><strong>{chat.peer.login}</strong><time>{chat.last_message ? formatTime(chat.last_message.created_at) : 'NEW'}</time></span>
        <span className="chat-preview">{chat.last_message?.body ?? 'Start a conversation'}</span>
      </span>
      {selected && <span className="selected-mark">●</span>}
    </button>
  )
}

function Conversation({
  chat, messages, userId, draft, sending, onDraft, onSend, onDelete, onLoadEarlier,
}: {
  chat: Chat
  messages: Message[]
  userId?: number
  draft: string
  sending: boolean
  onDraft: (value: string) => void
  onSend: (event: FormEvent<HTMLFormElement>) => void
  onDelete: (message: Message) => void
  onLoadEarlier: () => void
}) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const draftLength = [...draft].length
  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages.length])
  return (
    <div className="conversation">
      <header className="conversation-header">
        <div className="conversation-person">
          <span className="avatar conversation-avatar">{chat.peer.login[0].toUpperCase()}<i className={`status-dot ${chat.peer.online ? '' : 'offline'}`} /></span>
          <span><strong>{chat.peer.login}</strong><small><i className={`status-dot ${chat.peer.online ? '' : 'offline'}`} />{chat.peer.online ? 'ONLINE NOW' : 'OFFLINE'}</small></span>
        </div>
        <div className="conversation-meta"><span>DIRECT CHANNEL</span><b>#{chat.id.toString().padStart(4, '0')}</b></div>
      </header>
      <div className="messages-area">
        {messages.length >= 50 && <button className="load-earlier" onClick={onLoadEarlier}>↑ LOAD EARLIER MESSAGES</button>}
        {messages.length === 0 ? (
          <div className="empty-state message-empty">This channel is quiet.<br /><span>Send the first signal.</span></div>
        ) : messages.map((message, index) => (
          <div className={`message ${message.sender_id === userId ? 'outgoing' : ''}`} key={message.id}>
            {index === 0 || new Date(messages[index - 1].created_at).toDateString() !== new Date(message.created_at).toDateString()
              ? <div className="date-divider"><span>{formatDate(message.created_at)}</span></div>
              : null}
            <div className="message-line">
              <div className="message-bubble">
                <p>{message.body}</p>
                <time>{formatTime(message.created_at)}</time>
              </div>
              {message.sender_id === userId && (
                <button className="delete-message" onClick={() => onDelete(message)} title="Delete message" aria-label="Delete message">×</button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="composer" onSubmit={onSend}>
        <div className="compose-prompt">↳</div>
        <input
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          placeholder={`Message ${chat.peer.login}…`}
          maxLength={8000}
          aria-label="Write a message"
        />
        <span className="char-count">{draftLength}/4000</span>
        <button className="send-button" type="submit" disabled={sending || !draft.trim() || draftLength > 4000} aria-label="Send message">↑</button>
      </form>
      <div className="composer-note"><span>↵ ENTER TO TRANSMIT</span><span>MESSAGES ARE PRIVATE</span></div>
    </div>
  )
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
}

export default App
