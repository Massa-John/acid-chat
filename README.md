# ACID//CHAT

ACID//CHAT — фронтенд современного веб-мессенджера (React + TypeScript + Vite) с кислотно-неоновым дизайном и поддержкой работы с Go backend.

## Требования

- Docker + Docker Compose
- Git
- Доступ к внешней Docker сети `ve13_app-network`
- Работающий backend (`Massa-John/back_pure`) в той же Docker-сети

## Ветка для запуска

Нужная ветка:

```bash
git checkout copilot/create-frontend-project-acid-chat
```

## Переменные окружения

Создайте файл `.env` в корне проекта:

```env
VITE_API_BASE_URL=http://back-pure:8080
VITE_WS_URL=ws://back-pure:8080/ws
```

Если у вашего backend другой hostname/service-name в Docker сети, замените `back-pure` на реальное имя сервиса контейнера.

## Запуск в Docker контейнере

### 1) Подключение к сети Docker

Убедитесь, что сеть существует:

```bash
docker network ls | grep ve13_app-network
```

Если сети нет — создайте её:

```bash
docker network create ve13_app-network
```

### 2) Запуск frontend

```bash
docker compose up --build
```

Приложение будет доступно по адресу:

```text
http://localhost:5173
```

### 3) Остановка

```bash
docker compose down
```

## Что важно для networking

Файл `docker-compose.yaml` подключает контейнер к внешней сети:

```yaml
networks:
  ve13_app-network:
    external: true
```

Это позволяет frontend видеть backend в сети Docker, если backend работает в той же виртуальной сети.

## Локальный запуск без Docker

```bash
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

## Примечание по backend

Repo backend:

```text
https://github.com/Massa-John/back_pure
```

После успешной авторизации пользователь попадает на главную страницу, где есть:
1. поиск пользователя;
2. список последних чатов;
3. область чата.

## Стиль проекта

- чёрный фон;
- кислотно-неоновый лайм;
- glow-эффекты;
- scanlines;
- моноширинный шрифт;
- жёсткая визуальная сетка старого терминала.
