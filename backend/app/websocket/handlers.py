import secrets
from datetime import UTC, datetime
from uuid import UUID

from app.database import AsyncSessionLocal
from app.models.call_session import CallSession, CallStatus
from app.models.message import Message
from app.repositories.call_repository import CallRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.room_repository import RoomRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserPublic
from app.schemas.message import MessageCreate
from app.services.message_service import MessageService
from app.websocket.auth import authenticate_socket, require_user
from app.websocket.manager import connected_users, sio


def _room_channel(room_id: str) -> str:
    return f"room:{room_id}"


def _user_channel(user_id: str) -> str:
    return f"user:{user_id}"


def _dm_channel(conversation_id: str) -> str:
    return f"dm:{conversation_id}"


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None) -> bool:
    user_id = await authenticate_socket(environ, auth)
    if not user_id:
        return False

    connected_users[sid] = user_id
    await sio.enter_room(sid, _user_channel(user_id))

    async with AsyncSessionLocal() as session:
        repo = UserRepository(session)
        user = await repo.get_by_id(UUID(user_id))
        if user:
            user.is_online = True
            user.last_seen_at = datetime.now(UTC)
            await session.commit()

    await sio.emit(
        "presence_update",
        {"user_id": user_id, "is_online": True},
        skip_sid=sid,
    )
    return True


@sio.event
async def disconnect(sid: str) -> None:
    user_id = connected_users.pop(sid, None)
    if not user_id:
        return

    # Only mark offline / end calls if no other sessions remain for this user
    still_connected = any(uid == user_id for uid in connected_users.values())
    if not still_connected:
        ended_call_other_uid: str | None = None

        last_seen_iso: str | None = None
        async with AsyncSessionLocal() as session:
            repo = UserRepository(session)
            offline_user = await repo.set_online(UUID(user_id), False)
            if offline_user and offline_user.last_seen_at:
                last_seen_iso = offline_user.last_seen_at.isoformat()

            # End any ringing/active call so the other party isn't left hanging
            call_repo = CallRepository(session)
            active_call = await call_repo.get_active_for_user(UUID(user_id))
            if active_call:
                ended_call_other_uid = (
                    str(active_call.callee_id)
                    if str(active_call.caller_id) == user_id
                    else str(active_call.caller_id)
                )
                active_call.status = CallStatus.ENDED
                active_call.ended_at = datetime.now(UTC)

            await session.commit()

        if ended_call_other_uid:
            await sio.emit("call_ended", {"from_id": user_id}, room=_user_channel(ended_call_other_uid))

        await sio.emit("presence_update", {"user_id": user_id, "is_online": False, "last_seen_at": last_seen_iso})


@sio.event
async def going_offline(sid: str, _data: dict) -> None:
    """Client fires this right before it disconnects (beforeunload or explicit logout).
    Marks the user offline immediately and removes the sid so the subsequent
    disconnect event is a no-op, avoiding double processing and stale-sid issues."""
    user_id = connected_users.pop(sid, None)
    if not user_id:
        return
    last_seen_iso: str | None = None
    async with AsyncSessionLocal() as session:
        repo = UserRepository(session)
        offline_user = await repo.set_online(UUID(user_id), False)
        if offline_user and offline_user.last_seen_at:
            last_seen_iso = offline_user.last_seen_at.isoformat()
        await session.commit()
    await sio.emit(
        "presence_update",
        {"user_id": user_id, "is_online": False, "last_seen_at": last_seen_iso},
        skip_sid=sid,
    )


@sio.event
async def join_room(sid: str, data: dict) -> None:
    user_id = await require_user(sid)
    if not user_id:
        return

    room_id = data.get("room_id")
    if not room_id:
        return

    # Only subscribe existing members — joining a channel must go through the REST API.
    async with AsyncSessionLocal() as session:
        repo = RoomRepository(session)
        if not await repo.is_member(UUID(room_id), UUID(user_id)):
            return

    await sio.enter_room(sid, _room_channel(room_id))
    await sio.emit("room_joined", {"room_id": room_id, "user_id": user_id}, room=sid)


@sio.event
async def leave_room(sid: str, data: dict) -> None:
    room_id = data.get("room_id")
    if room_id:
        await sio.leave_room(sid, _room_channel(room_id))


@sio.event
async def send_message(sid: str, data: dict) -> None:
    user_id = await require_user(sid)
    if not user_id:
        return

    content = (data.get("content") or "").strip()
    attachment_ids_raw = data.get("attachment_ids") or []
    if not content and not attachment_ids_raw:
        return

    room_id = data.get("room_id")
    conversation_id = data.get("conversation_id")
    parent_id = data.get("parent_id")

    # Block check for DMs
    if conversation_id:
        async with AsyncSessionLocal() as check_session:
            from app.repositories.conversation_repository import ConversationRepository
            from app.repositories.friend_repository import FriendRepository
            conv = await ConversationRepository(check_session).get_by_id(UUID(conversation_id))
            if conv:
                other_id = conv.user_two_id if str(conv.user_one_id) == user_id else conv.user_one_id
                if await FriendRepository(check_session).is_blocked_between(UUID(user_id), other_id):
                    await sio.emit("error", {"message": "You cannot message this user."}, room=sid)
                    return

    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_id(UUID(user_id))
        if not user:
            return

        msg_service = MessageService(session)
        try:
            response = await msg_service.create(
                user,
                MessageCreate(
                    content=content,
                    room_id=UUID(room_id) if room_id else None,
                    conversation_id=UUID(conversation_id) if conversation_id else None,
                    parent_id=UUID(parent_id) if parent_id else None,
                    attachment_ids=[UUID(a) for a in attachment_ids_raw if a],
                ),
            )
        except Exception:
            return
        await session.commit()
        payload = response.model_dump(mode="json")

    if room_id:
        await sio.emit("new_message", payload, room=_room_channel(room_id))
    elif conversation_id:
        await sio.emit("new_message", payload, room=_dm_channel(conversation_id))
        # Notify each participant's personal channel so they see the conversation
        # update even when they have a different chat open (sidebar unread counts etc.)
        conv = await _get_conversation_participants(conversation_id)
        if conv:
            for uid in conv:
                await sio.emit("dm_notification", payload, room=_user_channel(uid))


@sio.event
async def typing_start(sid: str, data: dict) -> None:
    user_id = await require_user(sid)
    if not user_id:
        return
    payload = {**data, "user_id": user_id, "typing": True}
    await _broadcast_typing(payload, sid)


@sio.event
async def typing_stop(sid: str, data: dict) -> None:
    user_id = await require_user(sid)
    if not user_id:
        return
    payload = {**data, "user_id": user_id, "typing": False}
    await _broadcast_typing(payload, sid)


async def _broadcast_typing(payload: dict, sid: str) -> None:
    room_id = payload.get("room_id")
    conversation_id = payload.get("conversation_id")
    if room_id:
        await sio.emit("typing", payload, room=_room_channel(room_id), skip_sid=sid)
    elif conversation_id:
        await sio.emit("typing", payload, room=_dm_channel(conversation_id), skip_sid=sid)


@sio.event
async def message_read(sid: str, data: dict) -> None:
    user_id = await require_user(sid)
    if not user_id:
        return
    message_id = data.get("message_id")
    if not message_id:
        return

    async with AsyncSessionLocal() as session:
        repo = MessageRepository(session)
        read = await repo.mark_read(UUID(message_id), UUID(user_id))
        await session.commit()
        if not read:
            return

    payload = {
        "message_id": message_id,
        "user_id": user_id,
        "read_at": read.read_at.isoformat(),
    }
    room_id = data.get("room_id")
    conversation_id = data.get("conversation_id")
    if room_id:
        await sio.emit("message_read", payload, room=_room_channel(room_id))
    elif conversation_id:
        await sio.emit("message_read", payload, room=_dm_channel(conversation_id))


@sio.event
async def join_dm(sid: str, data: dict) -> None:
    conversation_id = data.get("conversation_id")
    if conversation_id:
        await sio.enter_room(sid, _dm_channel(conversation_id))


@sio.event
async def presence_update(sid: str, data: dict) -> None:
    user_id = await require_user(sid)
    if not user_id:
        return
    await sio.emit("presence_update", {"user_id": user_id, **data}, skip_sid=sid)


@sio.event
async def set_idle(sid: str, _data: dict) -> None:
    user_id = await require_user(sid)
    if not user_id:
        return
    await sio.emit(
        "presence_update",
        {"user_id": user_id, "is_online": True, "is_idle": True},
        skip_sid=sid,
    )


@sio.event
async def set_active(sid: str, _data: dict) -> None:
    user_id = await require_user(sid)
    if not user_id:
        return
    await sio.emit(
        "presence_update",
        {"user_id": user_id, "is_online": True, "is_idle": False},
        skip_sid=sid,
    )


# --- WebRTC signaling ---

@sio.event
async def call_offer(sid: str, data: dict) -> None:
    caller_id = await require_user(sid)
    if not caller_id:
        return

    callee_id = data.get("callee_id")
    sdp = data.get("sdp")
    if not callee_id or not sdp:
        return

    room_key = secrets.token_urlsafe(16)
    caller_name = "Unknown"
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        caller = await user_repo.get_by_id(UUID(caller_id))
        if caller:
            caller_name = caller.display_name

        call_repo = CallRepository(session)
        call = CallSession(
            caller_id=UUID(caller_id),
            callee_id=UUID(callee_id),
            room_key=room_key,
            status=CallStatus.RINGING,
        )
        await call_repo.create(call)
        await session.commit()

    await sio.emit(
        "incoming_call",
        {
            "caller_id": caller_id,
            "caller_name": caller_name,
            "room_key": room_key,
            "sdp": sdp,
            "type": data.get("type", "offer"),
            "with_video": data.get("with_video", True),
        },
        room=_user_channel(callee_id),
    )


@sio.event
async def call_answer(sid: str, data: dict) -> None:
    user_id = await require_user(sid)
    if not user_id:
        return

    caller_id = data.get("caller_id")
    room_key = data.get("room_key")
    sdp = data.get("sdp")
    if not caller_id or not room_key or not sdp:
        return

    async with AsyncSessionLocal() as session:
        call_repo = CallRepository(session)
        call = await call_repo.get_by_room_key(room_key)
        if call:
            call.status = CallStatus.ACTIVE
            call.started_at = datetime.now(UTC)
            await session.commit()

    await sio.emit(
        "call_answered",
        {"callee_id": user_id, "room_key": room_key, "sdp": sdp, "type": data.get("type", "answer")},
        room=_user_channel(caller_id),
    )


@sio.event
async def ice_candidate(sid: str, data: dict) -> None:
    user_id = await require_user(sid)
    if not user_id:
        return

    target_id = data.get("target_id")
    candidate = data.get("candidate")
    room_key = data.get("room_key")
    if not target_id or not candidate:
        return

    await sio.emit(
        "ice_candidate",
        {"from_id": user_id, "candidate": candidate, "room_key": room_key},
        room=_user_channel(target_id),
    )


@sio.event
async def call_end(sid: str, data: dict) -> None:
    user_id = await require_user(sid)
    if not user_id:
        return

    target_id = data.get("target_id")
    room_key = data.get("room_key")

    if room_key:
        async with AsyncSessionLocal() as session:
            call_repo = CallRepository(session)
            call = await call_repo.get_by_room_key(room_key)
            if call:
                call.status = CallStatus.ENDED
                call.ended_at = datetime.now(UTC)
                await session.commit()

    if target_id:
        await sio.emit(
            "call_ended",
            {"from_id": user_id, "room_key": room_key},
            room=_user_channel(target_id),
        )


async def _get_conversation_participants(conversation_id: str) -> list[str] | None:
    async with AsyncSessionLocal() as session:
        repo = ConversationRepository(session)
        conv = await repo.get_by_id(UUID(conversation_id))
        if not conv:
            return None
        return [str(conv.user_one_id), str(conv.user_two_id)]
