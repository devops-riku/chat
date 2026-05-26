from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.auth import UserPublic
from app.schemas.conversation import DirectConversationResponse
from app.repositories.user_repository import UserRepository
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("", response_model=list[DirectConversationResponse])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DirectConversationResponse]:
    service = ConversationService(db)
    return await service.list_for_user(current_user)


@router.post("/with/{user_id}", response_model=DirectConversationResponse)
async def get_or_create_dm(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DirectConversationResponse:
    service = ConversationService(db)
    return await service.get_or_create(current_user, user_id)


@router.get("/users", response_model=list[UserPublic])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserPublic]:
    repo = UserRepository(db)
    users = await repo.list_all()
    return [UserPublic.model_validate(u) for u in users if u.id != current_user.id]
