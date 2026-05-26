from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text

from app.config import get_settings
from app.database import engine
from app.middleware.rate_limit import limiter
from app.routers import auth, conversations, friends, messages, rooms, uploads
from app.services.room_service import RoomService
from app.database import AsyncSessionLocal
import app.websocket.handlers  # noqa: F401 — register socket events
from app.websocket.manager import sio

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema is managed by Alembic (alembic upgrade head)
    async with AsyncSessionLocal() as session:
        room_service = RoomService(session)
        await room_service.ensure_default_rooms()
        await session.commit()

    # Ensure MinIO bucket exists
    from app.services.storage_service import ensure_bucket
    ensure_bucket()

    # Mark all users offline and flush stale Socket.IO sids from Redis.
    # On a fresh start no sockets are connected, so any leftover "online" rows
    # or Redis socket entries are from a previous crashed/stopped instance.
    from app.repositories.user_repository import UserRepository
    from app.websocket.manager import redis_manager
    async with AsyncSessionLocal() as session:
        await UserRepository(session).mark_all_offline()
        await session.commit()
    # Clear stale Socket.IO sid/room entries left from a previous crashed instance.
    async for key in redis_manager.redis.scan_iter("socketio/*"):
        await redis_manager.redis.delete(key)

    yield
    await engine.dispose()


fastapi_app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

fastapi_app.state.limiter = limiter
fastapi_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
fastapi_app.add_middleware(SlowAPIMiddleware)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(auth.router, prefix="/api")
fastapi_app.include_router(rooms.router, prefix="/api")
fastapi_app.include_router(messages.router, prefix="/api")
fastapi_app.include_router(conversations.router, prefix="/api")
fastapi_app.include_router(friends.router, prefix="/api")
fastapi_app.include_router(uploads.router, prefix="/api")


@fastapi_app.get("/api/health")
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def health(request: Request) -> dict:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "healthy", "app": settings.app_name}


@fastapi_app.get("/api/turn-config")
async def turn_config() -> dict:
    import os

    return {
        "iceServers": [
            {"urls": "stun:stun.l.google.com:19302"},
            {
                "urls": os.getenv("NEXT_PUBLIC_TURN_URL", "turn:localhost:3478"),
                "username": os.getenv("NEXT_PUBLIC_TURN_USERNAME", "nexus"),
                "credential": os.getenv("NEXT_PUBLIC_TURN_CREDENTIAL", "nexus_turn_secret"),
            },
        ]
    }


# Combined ASGI app: Socket.IO wraps FastAPI
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="/socket.io")
