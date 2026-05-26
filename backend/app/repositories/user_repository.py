from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_username(self, username: str) -> User | None:
        result = await self.session.execute(select(User).where(User.username == username))
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        await self.session.refresh(user)
        return user

    async def list_all(self, limit: int = 100) -> list[User]:
        result = await self.session.execute(select(User).limit(limit))
        return list(result.scalars().all())

    async def mark_all_offline(self) -> None:
        """Set every user offline — called once on server startup to clear stale state."""
        await self.session.execute(
            update(User).values(is_online=False, last_seen_at=datetime.now(UTC))
        )

    async def set_online(self, user_id: UUID, is_online: bool) -> User | None:
        user = await self.get_by_id(user_id)
        if user:
            user.is_online = is_online
            if not is_online:
                user.last_seen_at = datetime.now(UTC)
            await self.session.flush()
        return user
