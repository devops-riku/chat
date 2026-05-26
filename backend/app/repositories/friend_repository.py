from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.friendship import Friendship, FriendshipStatus


class FriendRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, friendship_id: UUID) -> Friendship | None:
        result = await self.session.execute(
            select(Friendship)
            .where(Friendship.id == friendship_id)
            .options(selectinload(Friendship.requester), selectinload(Friendship.addressee))
        )
        return result.scalar_one_or_none()

    async def get_between(self, user_a: UUID, user_b: UUID) -> Friendship | None:
        result = await self.session.execute(
            select(Friendship).where(
                or_(
                    (Friendship.requester_id == user_a) & (Friendship.addressee_id == user_b),
                    (Friendship.requester_id == user_b) & (Friendship.addressee_id == user_a),
                )
            )
        )
        return result.scalar_one_or_none()

    async def create(self, friendship: Friendship) -> Friendship:
        self.session.add(friendship)
        await self.session.flush()
        await self.session.refresh(friendship)
        return friendship

    async def list_friends(self, user_id: UUID) -> list[Friendship]:
        result = await self.session.execute(
            select(Friendship)
            .where(
                Friendship.status == FriendshipStatus.ACCEPTED,
                or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
            )
            .options(selectinload(Friendship.requester), selectinload(Friendship.addressee))
        )
        return list(result.scalars().all())

    async def list_pending_incoming(self, user_id: UUID) -> list[Friendship]:
        result = await self.session.execute(
            select(Friendship)
            .where(
                Friendship.addressee_id == user_id,
                Friendship.status == FriendshipStatus.PENDING,
            )
            .options(selectinload(Friendship.requester))
        )
        return list(result.scalars().all())

    async def delete(self, friendship: Friendship) -> None:
        await self.session.delete(friendship)

    async def get_blocked_by(self, user_id: UUID) -> list[Friendship]:
        """Friendships where this user is the blocker."""
        result = await self.session.execute(
            select(Friendship)
            .where(Friendship.requester_id == user_id, Friendship.status == FriendshipStatus.BLOCKED)
            .options(selectinload(Friendship.addressee))
        )
        return list(result.scalars().all())

    async def get_blocking_user(self, user_id: UUID) -> list[Friendship]:
        """Friendships where someone else has blocked this user."""
        result = await self.session.execute(
            select(Friendship)
            .where(Friendship.addressee_id == user_id, Friendship.status == FriendshipStatus.BLOCKED)
            .options(selectinload(Friendship.requester))
        )
        return list(result.scalars().all())

    async def is_blocked_between(self, user_a: UUID, user_b: UUID) -> bool:
        """True if either user has blocked the other."""
        result = await self.session.execute(
            select(Friendship).where(
                Friendship.status == FriendshipStatus.BLOCKED,
                or_(
                    (Friendship.requester_id == user_a) & (Friendship.addressee_id == user_b),
                    (Friendship.requester_id == user_b) & (Friendship.addressee_id == user_a),
                ),
            )
        )
        return result.scalar_one_or_none() is not None

    async def search_users(self, query: str, exclude_id: UUID, limit: int = 20) -> list:
        from app.models.user import User

        pattern = f"%{query}%"
        result = await self.session.execute(
            select(User)
            .where(
                User.id != exclude_id,
                or_(User.username.ilike(pattern), User.display_name.ilike(pattern), User.email.ilike(pattern)),
            )
            .limit(limit)
        )
        return list(result.scalars().all())
