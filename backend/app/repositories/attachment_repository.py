from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attachment import Attachment


class AttachmentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, attachment: Attachment) -> Attachment:
        self.session.add(attachment)
        await self.session.flush()
        await self.session.refresh(attachment)
        return attachment

    async def get_by_id(self, attachment_id: UUID) -> Attachment | None:
        result = await self.session.execute(
            select(Attachment).where(Attachment.id == attachment_id)
        )
        return result.scalar_one_or_none()

    async def get_by_ids(self, ids: list[UUID]) -> list[Attachment]:
        if not ids:
            return []
        result = await self.session.execute(
            select(Attachment).where(Attachment.id.in_(ids))
        )
        return list(result.scalars().all())

    async def link_to_message(self, attachment_ids: list[UUID], message_id: UUID) -> None:
        attachments = await self.get_by_ids(attachment_ids)
        for att in attachments:
            att.message_id = message_id
