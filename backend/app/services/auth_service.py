from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import create_access_token, create_refresh_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, UserPublic


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = UserRepository(session)
        self.session = session

    async def register(self, data: RegisterRequest) -> UserPublic:
        if await self.repo.get_by_email(data.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        if await self.repo.get_by_username(data.username):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

        user = User(
            email=data.email,
            username=data.username,
            display_name=data.display_name,
            password_hash=hash_password(data.password),
        )
        user = await self.repo.create(user)

        from app.repositories.room_repository import RoomRepository

        room_repo = RoomRepository(self.session)
        general = await room_repo.get_by_slug("general")
        if general:
            await room_repo.add_member(general.id, user.id)

        return UserPublic.model_validate(user)

    async def login(self, data: LoginRequest) -> tuple[User, str, str]:
        if "@" in data.identifier:
            user = await self.repo.get_by_email(data.identifier)
        else:
            user = await self.repo.get_by_username(data.identifier)
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        access = create_access_token(user.id)
        refresh = create_refresh_token(user.id)
        return user, access, refresh

    async def refresh_tokens(self, refresh_token: str) -> tuple[str, str]:
        from app.auth.security import decode_token

        try:
            payload = decode_token(refresh_token, expected_type="refresh")
            from uuid import UUID

            user_id = UUID(payload["sub"])
        except (ValueError, KeyError) as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return create_access_token(user.id), create_refresh_token(user.id)
