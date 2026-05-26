from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.direct_conversation import DirectConversation
from app.models.message import Message


class ConversationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, conversation_id: UUID) -> DirectConversation | None:
        result = await self.session.execute(
            select(DirectConversation).where(DirectConversation.id == conversation_id)
        )
        return result.scalar_one_or_none()

    async def get_between_users(self, user_a: UUID, user_b: UUID) -> DirectConversation | None:
        result = await self.session.execute(
            select(DirectConversation).where(
                or_(
                    (DirectConversation.user_one_id == user_a)
                    & (DirectConversation.user_two_id == user_b),
                    (DirectConversation.user_one_id == user_b)
                    & (DirectConversation.user_two_id == user_a),
                )
            )
        )
        return result.scalar_one_or_none()

    async def create(self, user_one_id: UUID, user_two_id: UUID) -> DirectConversation:
        ordered = sorted([user_one_id, user_two_id], key=str)
        conv = DirectConversation(user_one_id=ordered[0], user_two_id=ordered[1])
        self.session.add(conv)
        await self.session.flush()
        await self.session.refresh(conv)
        return conv

    async def list_for_user(self, user_id: UUID) -> list[DirectConversation]:
        result = await self.session.execute(
            select(DirectConversation).where(
                or_(
                    DirectConversation.user_one_id == user_id,
                    DirectConversation.user_two_id == user_id,
                )
            )
        )
        return list(result.scalars().all())

    async def get_last_message(self, conversation_id: UUID) -> Message | None:
        result = await self.session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .options(selectinload(Message.author))
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
