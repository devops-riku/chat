import secrets
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.room import Room, RoomType
from app.models.user import User
from app.repositories.room_repository import RoomRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserPublic
from app.schemas.room import GroupCreate, RoomCreate, RoomResponse


class RoomService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = RoomRepository(session)
        self.user_repo = UserRepository(session)

    async def list_rooms(self, user: User) -> list[RoomResponse]:
        general = await self.repo.get_by_slug("general")
        if general and not await self.repo.is_member(general.id, user.id):
            await self.repo.add_member(general.id, user.id)
        rooms = await self.repo.list_for_user(user.id)
        return [RoomResponse.model_validate(r) for r in rooms]

    async def create_room(self, user: User, data: RoomCreate) -> RoomResponse:
        if await self.repo.get_by_slug(data.slug):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already exists")
        room = Room(
            name=data.name,
            slug=data.slug,
            description=data.description,
            room_type=data.room_type,
        )
        room = await self.repo.create(room)
        await self.repo.add_member(room.id, user.id)
        return RoomResponse.model_validate(room)

    async def create_group(self, user: User, data: GroupCreate) -> RoomResponse:
        slug = f"group-{secrets.token_hex(4)}"
        room = Room(
            name=data.name,
            slug=slug,
            description=data.description,
            room_type=RoomType.GROUP,
        )
        room = await self.repo.create(room)
        await self.repo.add_member(room.id, user.id)

        for member_id in set(data.member_ids):
            if member_id == user.id:
                continue
            member_user = await self.user_repo.get_by_id(member_id)
            if member_user:
                await self.repo.add_member(room.id, member_id)

        return RoomResponse.model_validate(room)

    async def join_room(self, user: User, room_id: UUID) -> None:
        room = await self.repo.get_by_id(room_id)
        if not room:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
        if not await self.repo.is_member(room_id, user.id):
            await self.repo.add_member(room_id, user.id)

    async def get_members(self, room_id: UUID) -> list[UserPublic]:
        members = await self.repo.get_members(room_id)
        return [UserPublic.model_validate(m.user) for m in members if m.user]

    async def browse_channels(self, user: User) -> list[RoomResponse]:
        rooms = await self.repo.list_joinable(user.id)
        return [RoomResponse.model_validate(r) for r in rooms]

    async def delete_group(self, user: User, room_id: UUID) -> None:
        room = await self.repo.get_by_id(room_id)
        if not room:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
        if room.room_type not in (RoomType.GROUP,):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete this room")
        if not await self.repo.is_member(room_id, user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member")
        await self.repo.delete(room)

    async def ensure_default_rooms(self) -> None:
        if not await self.repo.get_by_slug("general"):
            room = Room(
                name="General",
                slug="general",
                description="Global chat for everyone",
                room_type=RoomType.GLOBAL,
            )
            await self.repo.create(room)
