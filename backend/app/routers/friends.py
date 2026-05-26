from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserPublic
from app.schemas.friend import FriendRequestCreate, FriendshipResponse
from app.services.friend_service import FriendService
from app.websocket.manager import sio

router = APIRouter(prefix="/friends", tags=["friends"])


@router.get("", response_model=list[UserPublic])
async def list_friends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserPublic]:
    service = FriendService(db)
    return await service.list_friends(current_user)


@router.get("/requests", response_model=list[FriendshipResponse])
async def list_friend_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[FriendshipResponse]:
    service = FriendService(db)
    return await service.list_pending_requests(current_user)


@router.get("/search", response_model=list[UserPublic])
async def search_users(
    q: str = Query(min_length=2),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserPublic]:
    service = FriendService(db)
    return await service.search_users(current_user, q)


@router.post("/request", response_model=FriendshipResponse, status_code=201)
async def send_friend_request(
    data: FriendRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FriendshipResponse:
    service = FriendService(db)
    result = await service.send_request(current_user, data.user_id)
    await sio.emit(
        "friend_request_received",
        result.model_dump(mode="json"),
        room=f"user:{data.user_id}",
    )
    return result


@router.post("/requests/{friendship_id}/accept", response_model=FriendshipResponse)
async def accept_friend_request(
    friendship_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FriendshipResponse:
    service = FriendService(db)
    result = await service.accept_request(current_user, friendship_id)
    await sio.emit(
        "friend_request_accepted",
        result.model_dump(mode="json"),
        room=f"user:{result.requester_id}",
    )
    return result


@router.get("/blocking-me", response_model=list[UserPublic])
async def list_blocking_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserPublic]:
    service = FriendService(db)
    return await service.list_blocking_me(current_user)


@router.get("/blocked", response_model=list[UserPublic])
async def list_blocked(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserPublic]:
    service = FriendService(db)
    return await service.list_blocked(current_user)


@router.post("/{user_id}/unblock", status_code=status.HTTP_204_NO_CONTENT)
async def unblock_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    service = FriendService(db)
    await service.unblock(current_user, user_id)
    await db.commit()
    await sio.emit("you_are_unblocked", {"by_user_id": str(current_user.id)}, room=f"user:{user_id}")


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unfriend(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    service = FriendService(db)
    await service.unfriend(current_user, user_id)
    await db.commit()


@router.post("/{user_id}/block", status_code=status.HTTP_204_NO_CONTENT)
async def block_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    service = FriendService(db)
    await service.block(current_user, user_id)
    await db.commit()
    await sio.emit("you_are_blocked", {"by_user_id": str(current_user.id)}, room=f"user:{user_id}")


@router.post("/requests/{friendship_id}/reject")
async def reject_friend_request(
    friendship_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    service = FriendService(db)
    return await service.reject_request(current_user, friendship_id)
