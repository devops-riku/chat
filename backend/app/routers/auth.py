from datetime import timedelta

from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, UserPublic
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    response.set_cookie(
        key=settings.access_token_cookie,
        value=access,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.jwt_access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key=settings.refresh_token_cookie,
        value=refresh,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.jwt_refresh_token_expire_days * 24 * 3600,
        path="/",
    )


@router.post("/register", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserPublic:
    service = AuthService(db)
    return await service.register(data)


@router.post("/login", response_model=UserPublic)
async def login(
    data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserPublic:
    service = AuthService(db)
    user, access, refresh = await service.login(data)
    _set_auth_cookies(response, access, refresh)
    return UserPublic.model_validate(user)


@router.post("/refresh")
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=settings.refresh_token_cookie),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    if not refresh_token:
        from fastapi import HTTPException

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    service = AuthService(db)
    access, new_refresh = await service.refresh_tokens(refresh_token)
    _set_auth_cookies(response, access, new_refresh)
    return {"status": "ok"}


@router.post("/logout")
async def logout(response: Response) -> dict[str, str]:
    response.delete_cookie(settings.access_token_cookie, path="/")
    response.delete_cookie(settings.refresh_token_cookie, path="/")
    return {"status": "ok"}


@router.get("/me", response_model=UserPublic)
async def me(current_user: User = Depends(get_current_user)) -> UserPublic:
    return UserPublic.model_validate(current_user)
