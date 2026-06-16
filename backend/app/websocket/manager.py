import logging
import socketio

from app.config import get_settings

settings = get_settings()

# Silence the noisy "Cannot send to sid" warnings that fire when a client
# disconnects between a pub/sub publish and its delivery. These are harmless
# race conditions, not real errors.
logging.getLogger("socketio.server").setLevel(logging.ERROR)
logging.getLogger("engineio.server").setLevel(logging.ERROR)

# Redis manager enables horizontal scaling via pub/sub
redis_manager = socketio.AsyncRedisManager(settings.redis_url)

sio = socketio.AsyncServer(
    async_mode="asgi",
    client_manager=redis_manager,
    cors_allowed_origins=settings.cors_origin_list,
    ping_interval=25,   # send ping every 25s (Socket.IO default)
    ping_timeout=20,    # declare dead if no pong in 20s (Socket.IO default)
    logger=False,
    engineio_logger=False,
)

# sid -> user_id mapping (per-instance; presence uses rooms)
connected_users: dict[str, str] = {}
