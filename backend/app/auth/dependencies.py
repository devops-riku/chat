from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import decode_token
from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository

settings = get_settings()


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    access_token: str | None = Cookie(default=None, alias=settings.access_token_cookie),
) -> User:
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(access_token, expected_type="access")
        user_id = UUID(payload["sub"])
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_optional_user(
    db: AsyncSession = Depends(get_db),
    access_token: str | None = Cookie(default=None, alias=settings.access_token_cookie),
) -> User | None:
    if not access_token:
        return None
    try:
        payload = decode_token(access_token, expected_type="access")
        user_id = UUID(payload["sub"])
    except (ValueError, KeyError):
        return None
    repo = UserRepository(db)
    return await repo.get_by_id(user_id)
