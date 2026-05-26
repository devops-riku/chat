from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.attachment import Attachment  # noqa: F401 — ensure mapper sees attachment relationship
from app.models.message import Message
from app.models.message_read import MessageRead


class MessageRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, message: Message) -> Message:
        self.session.add(message)
        await self.session.flush()
        await self.session.refresh(message)
        return message

    async def get_by_id(self, message_id: UUID) -> Message | None:
        result = await self.session.execute(
            select(Message)
            .where(Message.id == message_id)
            .options(*self._message_load_options())
        )
        return result.scalar_one_or_none()

    def _message_load_options(self):
        return (
            selectinload(Message.author),
            selectinload(Message.reads),
            selectinload(Message.attachments),
            selectinload(Message.parent).selectinload(Message.author),
        )

    async def list_by_room(self, room_id: UUID, limit: int = 50, before_id: UUID | None = None) -> list[Message]:
        query = (
            select(Message)
            .where(Message.room_id == room_id)
            .options(*self._message_load_options())
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        if before_id:
            before_msg = await self.get_by_id(before_id)
            if before_msg:
                query = query.where(Message.created_at < before_msg.created_at)
        result = await self.session.execute(query)
        messages = list(result.scalars().all())
        messages.reverse()
        return messages

    async def list_by_conversation(
        self, conversation_id: UUID, limit: int = 50, before_id: UUID | None = None
    ) -> list[Message]:
        query = (
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .options(*self._message_load_options())
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        if before_id:
            before_msg = await self.get_by_id(before_id)
            if before_msg:
                query = query.where(Message.created_at < before_msg.created_at)
        result = await self.session.execute(query)
        messages = list(result.scalars().all())
        messages.reverse()
        return messages

    async def delete(self, message: Message) -> None:
        await self.session.delete(message)

    async def mark_read(self, message_id: UUID, user_id: UUID) -> MessageRead | None:
        existing = await self.session.execute(
            select(MessageRead).where(
                MessageRead.message_id == message_id, MessageRead.user_id == user_id
            )
        )
        if existing.scalar_one_or_none():
            return None
        read = MessageRead(message_id=message_id, user_id=user_id)
        self.session.add(read)
        await self.session.flush()
        return read

    async def read_count(self, message_id: UUID) -> int:
        result = await self.session.execute(
            select(func.count()).select_from(MessageRead).where(MessageRead.message_id == message_id)
        )
        return result.scalar_one()
