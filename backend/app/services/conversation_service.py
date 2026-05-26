from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import UserPublic
from app.schemas.conversation import DirectConversationResponse


class ConversationService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = ConversationRepository(session)
        self.user_repo = UserRepository(session)

    async def list_for_user(self, user: User) -> list[DirectConversationResponse]:
        convs = await self.repo.list_for_user(user.id)
        results: list[DirectConversationResponse] = []
        for conv in convs:
            other_id = conv.user_two_id if conv.user_one_id == user.id else conv.user_one_id
            other = await self.user_repo.get_by_id(other_id)
            last = await self.repo.get_last_message(conv.id)
            results.append(
                DirectConversationResponse(
                    id=conv.id,
                    user_one_id=conv.user_one_id,
                    user_two_id=conv.user_two_id,
                    created_at=conv.created_at,
                    other_user=UserPublic.model_validate(other) if other else None,
                    last_message=last.content if last else None,
                )
            )
        return results

    async def get_or_create(self, user: User, other_user_id: UUID) -> DirectConversationResponse:
        if user.id == other_user_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot DM yourself")
        other = await self.user_repo.get_by_id(other_user_id)
        if not other:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        conv = await self.repo.get_between_users(user.id, other_user_id)
        if not conv:
            conv = await self.repo.create(user.id, other_user_id)

        return DirectConversationResponse(
            id=conv.id,
            user_one_id=conv.user_one_id,
            user_two_id=conv.user_two_id,
            created_at=conv.created_at,
            other_user=UserPublic.model_validate(other),
        )
