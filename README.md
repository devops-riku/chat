# NexusChat

A production-ready MVP realtime communication platform — Discord/Slack-style chat with presence, typing indicators, read receipts, and 1-on-1 WebRTC video calls.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Socket.IO client |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2.0, Pydantic v2, Socket.IO |
| Data | PostgreSQL, Redis (Socket.IO adapter + pub/sub) |
| Media | WebRTC, Coturn (TURN/STUN) |
| Infra | Docker Compose, Traefik |

## Project structure

```
├── backend/           # FastAPI app (clean architecture)
│   └── app/
│       ├── routers/   # REST endpoints
│       ├── services/  # Business logic
│       ├── repositories/
│       ├── models/    # SQLAlchemy 2.0
│       ├── schemas/   # Pydantic v2
│       └── websocket/ # Socket.IO handlers
├── frontend/          # Next.js 15 App Router
│   └── src/
│       ├── app/       # Routes
│       ├── components/
│       ├── hooks/     # useSocket, useWebRTC
│       └── stores/    # Zustand
├── infrastructure/    # Traefik, Coturn configs
└── docs/              # API, WebSocket, WebRTC guides
```

## Quick start (Docker)

### 1. Prerequisites

- Docker Desktop (running)

### 2. Configure environment

```bash
cp .env.example .env
```

Ensure these point at localhost (default — no Traefik required):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
```

### 3. Start services (recommended on Windows)

```bash
docker compose up --build -d
```

Traefik is **off by default** (avoids Docker socket errors on Windows). Apps are exposed directly:

| Service | URL |
|---------|-----|
| App | http://localhost:3000 |
| API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

**Optional — Traefik reverse proxy** (Linux or if Docker socket works):

```bash
# Add to hosts: 127.0.0.1 app.localhost api.localhost
# Set NEXT_PUBLIC_API_URL=http://api.localhost in .env, rebuild frontend
docker compose --profile proxy up --build -d
```

If Traefik logs `Provider error` / `Error response from daemon`, skip the proxy profile and use the localhost URLs above.

### 4. Register & chat

1. Open http://localhost:3000/register
2. Create an account (auto-joined to **#general**)
3. Open a second browser/incognito window, register another user
4. Send messages in **#general**, start DMs, or place a video call from the members panel

## Local development (without full Docker UI)

### Infrastructure only

```bash
docker compose up postgres redis coturn -d
```

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

# Set env (or copy root .env)
set DATABASE_URL=postgresql+asyncpg://nexus:nexus_secret@localhost:5432/nexus_chat
set REDIS_URL=redis://localhost:6379/0

alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Database migrations (Alembic)

Schema changes are managed with [Alembic](https://alembic.sqlalchemy.org/) under `backend/alembic/`.

```bash
cd backend

# Apply all pending migrations
alembic upgrade head

# Roll back one revision
alembic downgrade -1

# Create a new migration after model changes (autogenerate)
alembic revision --autogenerate -m "describe your change"

# View history
alembic history
```

Docker runs `alembic upgrade head` automatically before the API starts.

**Existing database?** If you previously used `create_all` and tables already exist, either:

- Drop and recreate: `docker compose down -v` then `docker compose up --build`, or
- Stamp current state: `alembic stamp head` (only if schema matches the migration)

### Frontend

```bash
cd frontend
cp ../.env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8000
# Set NEXT_PUBLIC_SOCKET_URL=http://localhost:8000

npm install
npm run dev
```

Open http://localhost:3000

## Features

- **Auth**: Register, login, JWT in HTTP-only cookies, protected routes, session validation
- **Chat**: Global/channel rooms, DMs, live messages, typing, presence, read receipts
- **Calls**: 1-on-1 WebRTC with mute, video toggle, camera switch, screen share, TURN fallback
- **Security**: bcrypt passwords, CORS, socket auth, rate limiting, env-based secrets
- **Scale**: Redis Socket.IO adapter for multi-instance deployments

## Documentation

- [API Reference](docs/API.md)
- [WebSocket Events](docs/WEBSOCKET.md)
- [WebRTC Signaling](docs/WEBRTC.md)

## Environment variables

See [.env.example](.env.example) for the full list. Critical production changes:

- `SECRET_KEY` / `JWT_SECRET_KEY` — strong random values
- `COOKIE_SECURE=true` — requires HTTPS
- `POSTGRES_PASSWORD` — strong database password
- `TURN_PASSWORD` — rotate Coturn credentials

## Architecture

```
Browser → Traefik → FastAPI (REST + Socket.IO)
                         ↓
                    Redis pub/sub
                         ↓
                    PostgreSQL

WebRTC media: Browser ↔ Browser (TURN via Coturn when needed)
```

## License

MIT
