from uuid import UUID

from app.auth.security import decode_token
from app.database import AsyncSessionLocal
from app.repositories.user_repository import UserRepository
from app.websocket.manager import connected_users, sio


async def authenticate_socket(environ: dict, auth: dict | None) -> str | None:
    """Validate JWT from Socket.IO auth payload. Returns user_id string or None."""
    if not auth:
        token = None
        # Cookie fallback from handshake headers
        cookie_header = environ.get("HTTP_COOKIE", "")
        from app.config import get_settings

        settings = get_settings()
        for part in cookie_header.split(";"):
            part = part.strip()
            if part.startswith(f"{settings.access_token_cookie}="):
                token = part.split("=", 1)[1]
                break
    else:
        token = auth.get("token")

    if not token:
        return None

    try:
        payload = decode_token(token, expected_type="access")
        return payload["sub"]
    except ValueError:
        return None


async def require_user(sid: str) -> str | None:
    return connected_users.get(sid)
