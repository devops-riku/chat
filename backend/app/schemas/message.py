from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.auth import UserPublic


class AttachmentResponse(BaseModel):
    id: UUID
    filename: str
    content_type: str
    size: int
    url: str  # presigned URL, generated at serialization time

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    content: str = Field(default="", max_length=4000)
    room_id: UUID | None = None
    conversation_id: UUID | None = None
    parent_id: UUID | None = None
    attachment_ids: list[UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def require_content_or_attachment(self) -> "MessageCreate":
        if not self.content.strip() and not self.attachment_ids:
            raise ValueError("Message must have content or at least one attachment")
        return self


class MessageReplyPreview(BaseModel):
    id: UUID
    content: str
    author_id: UUID
    author: UserPublic | None = None

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: UUID
    content: str
    author_id: UUID
    room_id: UUID | None
    conversation_id: UUID | None
    parent_id: UUID | None = None
    created_at: datetime
    author: UserPublic | None = None
    read_count: int = 0
    reply_to: MessageReplyPreview | None = None
    attachments: list[AttachmentResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class MessageReadResponse(BaseModel):
    message_id: UUID
    user_id: UUID
    read_at: datetime

    model_config = {"from_attributes": True}
