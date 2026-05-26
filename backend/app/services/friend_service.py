from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.friendship import Friendship, FriendshipStatus
from app.models.user import User
from app.repositories.friend_repository import FriendRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserPublic
from app.schemas.friend import FriendshipResponse


class FriendService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = FriendRepository(session)
        self.user_repo = UserRepository(session)

    async def list_friends(self, user: User) -> list[UserPublic]:
        friendships = await self.repo.list_friends(user.id)
        friends: list[UserPublic] = []
        for f in friendships:
            other = f.addressee if f.requester_id == user.id else f.requester
            if other:
                friends.append(UserPublic.model_validate(other))
        return friends

    async def list_pending_requests(self, user: User) -> list[FriendshipResponse]:
        incoming = await self.repo.list_pending_incoming(user.id)
        return [
            FriendshipResponse(
                id=f.id,
                requester_id=f.requester_id,
                addressee_id=f.addressee_id,
                status=f.status.value,
                created_at=f.created_at,
                friend=UserPublic.model_validate(f.requester) if f.requester else None,
            )
            for f in incoming
        ]

    async def send_request(self, user: User, target_id: UUID) -> FriendshipResponse:
        if user.id == target_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot add yourself")

        target = await self.user_repo.get_by_id(target_id)
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        existing = await self.repo.get_between(user.id, target_id)
        if existing:
            if existing.status == FriendshipStatus.ACCEPTED:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already friends")
            if existing.status == FriendshipStatus.PENDING:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request already pending")
            existing.status = FriendshipStatus.PENDING
            existing.requester_id = user.id
            existing.addressee_id = target_id
            await self.session.flush()
            return FriendshipResponse(
                id=existing.id,
                requester_id=existing.requester_id,
                addressee_id=existing.addressee_id,
                status=existing.status.value,
                created_at=existing.created_at,
                friend=UserPublic.model_validate(target),
            )

        friendship = Friendship(
            requester_id=user.id,
            addressee_id=target_id,
            status=FriendshipStatus.PENDING,
        )
        friendship = await self.repo.create(friendship)
        return FriendshipResponse(
            id=friendship.id,
            requester_id=friendship.requester_id,
            addressee_id=friendship.addressee_id,
            status=friendship.status.value,
            created_at=friendship.created_at,
            friend=UserPublic.model_validate(target),
        )

    async def accept_request(self, user: User, friendship_id: UUID) -> FriendshipResponse:
        friendship = await self.repo.get_by_id(friendship_id)
        if not friendship or friendship.addressee_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
        if friendship.status != FriendshipStatus.PENDING:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request not pending")

        friendship.status = FriendshipStatus.ACCEPTED
        await self.session.flush()
        friend_user = friendship.requester
        return FriendshipResponse(
            id=friendship.id,
            requester_id=friendship.requester_id,
            addressee_id=friendship.addressee_id,
            status=friendship.status.value,
            created_at=friendship.created_at,
            friend=UserPublic.model_validate(friend_user) if friend_user else None,
        )

    async def reject_request(self, user: User, friendship_id: UUID) -> dict[str, str]:
        friendship = await self.repo.get_by_id(friendship_id)
        if not friendship or friendship.addressee_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
        friendship.status = FriendshipStatus.REJECTED
        await self.session.flush()
        return {"status": "rejected"}

    async def list_blocking_me(self, user: User) -> list[UserPublic]:
        friendships = await self.repo.get_blocking_user(user.id)
        return [UserPublic.model_validate(f.requester) for f in friendships if f.requester]

    async def list_blocked(self, user: User) -> list[UserPublic]:
        friendships = await self.repo.get_blocked_by(user.id)
        return [UserPublic.model_validate(f.addressee) for f in friendships if f.addressee]

    async def unblock(self, user: User, target_id: UUID) -> None:
        friendship = await self.repo.get_between(user.id, target_id)
        if not friendship or friendship.status != FriendshipStatus.BLOCKED or friendship.requester_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Block not found")
        # Restore to accepted so they remain friends, or delete entirely
        friendship.status = FriendshipStatus.ACCEPTED
        await self.session.flush()

    async def unfriend(self, user: User, target_id: UUID) -> None:
        friendship = await self.repo.get_between(user.id, target_id)
        if not friendship or friendship.status != FriendshipStatus.ACCEPTED:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not friends")
        await self.repo.delete(friendship)

    async def block(self, user: User, target_id: UUID) -> None:
        if user.id == target_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot block yourself")
        target = await self.user_repo.get_by_id(target_id)
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        friendship = await self.repo.get_between(user.id, target_id)
        if friendship:
            friendship.status = FriendshipStatus.BLOCKED
            friendship.requester_id = user.id
            friendship.addressee_id = target_id
            await self.session.flush()
        else:
            new_f = Friendship(
                requester_id=user.id,
                addressee_id=target_id,
                status=FriendshipStatus.BLOCKED,
            )
            await self.repo.create(new_f)

    async def search_users(self, user: User, query: str) -> list[UserPublic]:
        if len(query.strip()) < 2:
            return []
        users = await self.repo.search_users(query.strip(), user.id)
        return [UserPublic.model_validate(u) for u in users]
