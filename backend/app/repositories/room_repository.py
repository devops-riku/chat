from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.room import Room, RoomType
from app.models.room_member import RoomMember


class RoomRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, room_id: UUID) -> Room | None:
        result = await self.session.execute(select(Room).where(Room.id == room_id))
        return result.scalar_one_or_none()

    async def get_by_slug(self, slug: str) -> Room | None:
        result = await self.session.execute(select(Room).where(Room.slug == slug))
        return result.scalar_one_or_none()

    async def list_all(self) -> list[Room]:
        result = await self.session.execute(select(Room).order_by(Room.name))
        return list(result.scalars().all())

    async def list_joinable(self, user_id: UUID) -> list[Room]:
        """Channels the user is NOT yet a member of (excludes global and group rooms)."""
        member_room_ids = select(RoomMember.room_id).where(RoomMember.user_id == user_id)
        result = await self.session.execute(
            select(Room)
            .where(
                Room.room_type == RoomType.CHANNEL,
                Room.id.not_in(member_room_ids),
            )
            .order_by(Room.name)
        )
        return list(result.scalars().all())

    async def list_for_user(self, user_id: UUID) -> list[Room]:
        result = await self.session.execute(
            select(Room)
            .join(RoomMember, RoomMember.room_id == Room.id)
            .where(RoomMember.user_id == user_id)
            .order_by(Room.name)
        )
        return list(result.scalars().unique().all())

    async def create(self, room: Room) -> Room:
        self.session.add(room)
        await self.session.flush()
        await self.session.refresh(room)
        return room

    async def add_member(self, room_id: UUID, user_id: UUID) -> RoomMember:
        member = RoomMember(room_id=room_id, user_id=user_id)
        self.session.add(member)
        await self.session.flush()
        return member

    async def is_member(self, room_id: UUID, user_id: UUID) -> bool:
        result = await self.session.execute(
            select(RoomMember).where(RoomMember.room_id == room_id, RoomMember.user_id == user_id)
        )
        return result.scalar_one_or_none() is not None

    async def delete(self, room: Room) -> None:
        await self.session.delete(room)

    async def get_members(self, room_id: UUID) -> list[RoomMember]:
        result = await self.session.execute(
            select(RoomMember)
            .where(RoomMember.room_id == room_id)
            .options(selectinload(RoomMember.user))
        )
        return list(result.scalars().all())
