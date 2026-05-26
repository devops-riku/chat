# NexusChat API Reference

Base URL: `http://api.localhost/api` (via Traefik) or `http://localhost:8000/api` (direct)

All authenticated endpoints require the `access_token` HTTP-only cookie set by login.

## Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login (sets cookies) |
| POST | `/auth/logout` | Clear cookies |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Current user profile |

### Register body
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "display_name": "John Doe",
  "password": "securepass123"
}
```

## Rooms

| Method | Path | Description |
|--------|------|-------------|
| GET | `/rooms` | List channels |
| POST | `/rooms` | Create channel |
| POST | `/rooms/{id}/join` | Join channel |
| GET | `/rooms/{id}/members` | List members |

## Messages

| Method | Path | Description |
|--------|------|-------------|
| POST | `/messages` | Send message (REST fallback) |
| GET | `/messages/room/{room_id}` | Room history |
| GET | `/messages/dm/{conversation_id}` | DM history |
| POST | `/messages/{id}/read` | Mark message read |

## Conversations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations` | List DMs |
| POST | `/conversations/with/{user_id}` | Get or create DM |
| GET | `/conversations/users` | List users for DMs |

## Utility

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/turn-config` | WebRTC ICE servers |

Interactive docs: `http://api.localhost/docs`
