from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.message import MessageCreate, MessageResponse
from app.services.message_service import MessageService
from app.websocket.manager import sio

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("", response_model=MessageResponse, status_code=201)
async def create_message(
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    service = MessageService(db)
    return await service.create(current_user, data)


@router.get("/room/{room_id}", response_model=list[MessageResponse])
async def room_messages(
    room_id: UUID,
    limit: int = Query(default=50, le=100),
    before_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MessageResponse]:
    service = MessageService(db)
    return await service.list_room_messages(current_user, room_id, limit=limit, before_id=before_id)


@router.get("/dm/{conversation_id}", response_model=list[MessageResponse])
async def dm_messages(
    conversation_id: UUID,
    limit: int = Query(default=50, le=100),
    before_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[MessageResponse]:
    service = MessageService(db)
    return await service.list_dm_messages(current_user, conversation_id, limit=limit, before_id=before_id)


@router.delete("/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    service = MessageService(db)
    info = await service.delete(current_user, message_id)
    await db.commit()

    payload = {"message_id": info["message_id"]}
    if info["room_id"]:
        await sio.emit("message_deleted", payload, room=f"room:{info['room_id']}")
    elif info["conversation_id"]:
        await sio.emit("message_deleted", payload, room=f"dm:{info['conversation_id']}")


@router.post("/{message_id}/read", response_model=MessageResponse)
async def mark_read(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    service = MessageService(db)
    result = await service.mark_read(current_user, message_id)
    return result  # type: ignore[return-value]
