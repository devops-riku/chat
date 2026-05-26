from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.auth import UserPublic


class DirectConversationResponse(BaseModel):
    id: UUID
    user_one_id: UUID
    user_two_id: UUID
    created_at: datetime
    other_user: UserPublic | None = None
    last_message: str | None = None

    model_config = {"from_attributes": True}
