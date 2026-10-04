# ACID//CHAT

An acid-neon React + TypeScript web messenger frontend for the Go REST and WebSocket backend in [Massa-John/back_pure](https://github.com/Massa-John/back_pure). The home screen has three primary regions: user search, recent chats, and the active conversation.

## Requirements

- Node.js 20.19+ (or 22.12+) and npm
- The `back_pure` service running and reachable from the browser
- PostgreSQL and Redis available to the backend as configured there

## Install and run

```sh
npm install
cp .env.example .env
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). To create a production build or serve it locally:

```sh
npm run build
npm run preview
```

The frontend is a static Vite app. Run it separately from `back_pure`; its `CORS_ORIGIN` backend setting defaults to `*` and can be set to the frontend origin (`http://localhost:5173` when using Vite).

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8080` | Origin of the backend REST API. Do not include `/api`. |
| `VITE_WS_URL` | `ws://localhost:8080/api/ws` | WebSocket endpoint. Use `wss://` in HTTPS deployments. |

Vite embeds `VITE_*` values in the client bundle. Never put secrets in these variables.

## Backend integration

The frontend follows the endpoints and DTOs implemented in `back_pure/main.go` and documented in `back_pure/win.yaml`:

- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, and `/api/auth/logout`
- `GET /api/me`, `GET /api/users/search?q=…`, `GET` and `POST /api/chats`
- `GET` and `POST /api/chats/{id}/messages`, `DELETE /api/messages/{id}`
- WebSocket `GET /api/ws?token=<access_token>`

Access and rotating refresh tokens are held in tab-scoped `sessionStorage`. A shared Axios response interceptor refreshes once on an expired/invalid access token, updates both tokens, and retries the original request. If refresh fails, the session is cleared. WebSocket events (`message.new`, `message.deleted`, and `presence`) update the chat UI in real time; the client sends periodic `ping` events to refresh its online presence. Messages use WebSocket when connected and fall back to the matching REST endpoint otherwise.

The UI validates backend constraints (lowercase `a-z` login, 3–32 characters; password 6–72 characters; message 1–4000 characters). Backend errors are shown in the interface; message deletion is available for the current user's own messages, as enforced by the API.

## Architecture

- `src/App.tsx` — `/login`, `/register`, guarded home route, three-region chat UI, and user flows
- `src/api.ts` — typed API calls and automatic access-token refresh/retry
- `src/authStore.ts` and `src/chatStore.ts` — Zustand auth, chats, messages, and presence state
- `src/realtime.ts` — authenticated WebSocket lifecycle, heartbeat, reconnect, and events
- `src/styles.css` — responsive black and neon-lime interface, grid, glow, and scanlines

There is no backend code or persistence implementation in this repository.
