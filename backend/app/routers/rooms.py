from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.repositories.room_repository import RoomRepository
from app.schemas.auth import UserPublic
from app.schemas.room import GroupCreate, RoomCreate, RoomResponse
from app.services.room_service import RoomService
from app.websocket.manager import sio

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("/browse", response_model=list[RoomResponse])
async def browse_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RoomResponse]:
    service = RoomService(db)
    return await service.browse_channels(current_user)


@router.get("", response_model=list[RoomResponse])
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RoomResponse]:
    service = RoomService(db)
    return await service.list_rooms(current_user)


@router.post("", response_model=RoomResponse, status_code=201)
async def create_room(
    data: RoomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RoomResponse:
    service = RoomService(db)
    return await service.create_room(current_user, data)


@router.post("/groups", response_model=RoomResponse, status_code=201)
async def create_group(
    data: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RoomResponse:
    service = RoomService(db)
    return await service.create_group(current_user, data)


@router.post("/{room_id}/join")
async def join_room(
    room_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    service = RoomService(db)
    await service.join_room(current_user, room_id)
    return {"status": "joined"}


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    room_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    # Collect member ids before deletion for the broadcast
    repo = RoomRepository(db)
    members = await repo.get_members(room_id)
    member_ids = [str(m.user_id) for m in members]

    service = RoomService(db)
    await service.delete_group(current_user, room_id)
    await db.commit()

    # Notify all members so their UI removes the group
    for uid in member_ids:
        await sio.emit("group_deleted", {"room_id": str(room_id)}, room=f"user:{uid}")


@router.get("/{room_id}/members", response_model=list[UserPublic])
async def room_members(
    room_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserPublic]:
    service = RoomService(db)
    return await service.get_members(room_id)
