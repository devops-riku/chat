from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.room import RoomType


class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    room_type: RoomType = RoomType.CHANNEL


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = None
    member_ids: list[UUID] = Field(min_length=1, max_length=50)


class RoomResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: str | None
    room_type: RoomType
    created_at: datetime

    model_config = {"from_attributes": True}
