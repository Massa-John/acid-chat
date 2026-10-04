# ACID//CHAT

ACID//CHAT — фронтенд современного веб-мессенджера (React + TypeScript + Vite) с неоновым кислотным стилем.

## Требования

- Node.js 20+
- npm 9+
- Доступный backend (см. `Massa-John/back_pure`)

## Переменные окружения

Создайте файл `.env` (или используйте значения по умолчанию):

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
```

## Запуск локально

```bash
npm install
npm run dev
```

Приложение будет доступно на `http://localhost:5173`.

## Запуск через Docker Compose

В репозитории есть `docker-compose.yaml`.

```bash
docker compose up --build
```

После запуска откройте: `http://localhost:5173`.

Остановка:

```bash
docker compose down
```

## Полезно

- Backend repository: `https://github.com/Massa-John/back_pure`
- После успешной авторизации `/login` открывается главная страница с 3 зонами:
  1. Поиск пользователей
  2. Список последних чатов
  3. Область активного чата
