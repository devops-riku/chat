from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.auth import UserPublic


class FriendshipResponse(BaseModel):
    id: UUID
    requester_id: UUID
    addressee_id: UUID
    status: str
    created_at: datetime
    friend: UserPublic | None = None

    model_config = {"from_attributes": True}


class FriendRequestCreate(BaseModel):
    user_id: UUID
