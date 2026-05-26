from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.user import User
from app.repositories.attachment_repository import AttachmentRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.message_repository import MessageRepository
from app.repositories.room_repository import RoomRepository
from app.schemas.auth import UserPublic
from app.schemas.message import AttachmentResponse, MessageCreate, MessageReplyPreview, MessageResponse
from app.config import get_settings
from app.services.storage_service import delete_file

_settings = get_settings()


class MessageService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = MessageRepository(session)
        self.room_repo = RoomRepository(session)
        self.conv_repo = ConversationRepository(session)
        self.att_repo = AttachmentRepository(session)
        self.session = session

    async def create(self, user: User, data: MessageCreate) -> MessageResponse:
        if not data.room_id and not data.conversation_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target required")

        if data.room_id:
            if not await self.room_repo.is_member(data.room_id, user.id):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a room member")
        elif data.conversation_id:
            conv = await self.conv_repo.get_by_id(data.conversation_id)
            if not conv or user.id not in (conv.user_one_id, conv.user_two_id):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not in conversation")

        if data.parent_id:
            parent = await self.repo.get_by_id(data.parent_id)
            if not parent:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent message not found")
            if data.room_id and parent.room_id != data.room_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reply target mismatch")
            if data.conversation_id and parent.conversation_id != data.conversation_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reply target mismatch")

        message = Message(
            content=data.content,
            author_id=user.id,
            room_id=data.room_id,
            conversation_id=data.conversation_id,
            parent_id=data.parent_id,
        )
        message = await self.repo.create(message)

        if data.attachment_ids:
            await self.att_repo.link_to_message(data.attachment_ids, message.id)

        loaded = await self.repo.get_by_id(message.id)
        return self._to_response(loaded)  # type: ignore[arg-type]

    async def list_room_messages(
        self, user: User, room_id: UUID, limit: int = 50, before_id: UUID | None = None
    ) -> list[MessageResponse]:
        if not await self.room_repo.is_member(room_id, user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a room member")
        messages = await self.repo.list_by_room(room_id, limit=limit, before_id=before_id)
        return [self._to_response(m) for m in messages]

    async def list_dm_messages(
        self, user: User, conversation_id: UUID, limit: int = 50, before_id: UUID | None = None
    ) -> list[MessageResponse]:
        conv = await self.conv_repo.get_by_id(conversation_id)
        if not conv or user.id not in (conv.user_one_id, conv.user_two_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not in conversation")
        messages = await self.repo.list_by_conversation(conversation_id, limit=limit, before_id=before_id)
        return [self._to_response(m) for m in messages]

    async def delete(self, user: User, message_id: UUID) -> dict:
        """Delete a message. Returns routing info so the caller can broadcast."""
        msg = await self.repo.get_by_id(message_id)
        if not msg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        if msg.author_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete another user's message")
        room_id = str(msg.room_id) if msg.room_id else None
        conversation_id = str(msg.conversation_id) if msg.conversation_id else None
        storage_keys = [att.storage_key for att in (msg.attachments or [])]
        await self.repo.delete(msg)
        for key in storage_keys:
            delete_file(key)
        return {"message_id": str(message_id), "room_id": room_id, "conversation_id": conversation_id}

    async def mark_read(self, user: User, message_id: UUID) -> MessageResponse | None:
        msg = await self.repo.get_by_id(message_id)
        if not msg:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
        await self.repo.mark_read(message_id, user.id)
        loaded = await self.repo.get_by_id(message_id)
        return self._to_response(loaded) if loaded else None

    def _to_response(self, message: Message) -> MessageResponse:
        reply_to = None
        if message.parent:
            reply_to = MessageReplyPreview(
                id=message.parent.id,
                content=message.parent.content[:200],
                author_id=message.parent.author_id,
                author=UserPublic.model_validate(message.parent.author)
                if message.parent.author
                else None,
            )

        attachments = []
        for att in (message.attachments or []):
            url = f"{_settings.backend_public_url}/api/uploads/{att.id}"
            attachments.append(AttachmentResponse(
                id=att.id,
                filename=att.filename,
                content_type=att.content_type,
                size=att.size,
                url=url,
            ))

        return MessageResponse(
            id=message.id,
            content=message.content,
            author_id=message.author_id,
            room_id=message.room_id,
            conversation_id=message.conversation_id,
            parent_id=message.parent_id,
            created_at=message.created_at,
            author=UserPublic.model_validate(message.author) if message.author else None,
            read_count=len(message.reads) if message.reads else 0,
            reply_to=reply_to,
            attachments=attachments,
        )
