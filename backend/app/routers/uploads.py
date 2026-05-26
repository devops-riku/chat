from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models.attachment import Attachment
from app.models.user import User
from app.repositories.attachment_repository import AttachmentRepository
from app.services.storage_service import get_file, upload_file

router = APIRouter(prefix="/uploads", tags=["uploads"])

settings = get_settings()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

ALLOWED_TYPES = {
    # images
    "image/jpeg", "image/png", "image/gif", "image/webp",
    # audio
    "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/webm",
    # video
    "video/mp4", "video/webm",
    # docs
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="File type not allowed")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 50 MB)")

    storage_key = upload_file(data, file.content_type or "application/octet-stream", file.filename or "upload")

    repo = AttachmentRepository(db)
    attachment = Attachment(
        uploader_id=current_user.id,
        filename=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        size=len(data),
        storage_key=storage_key,
    )
    attachment = await repo.create(attachment)
    await db.commit()

    url = f"{settings.backend_public_url}/api/uploads/{attachment.id}"
    return {
        "id": str(attachment.id),
        "filename": attachment.filename,
        "content_type": attachment.content_type,
        "size": attachment.size,
        "url": url,
    }


@router.get("/{attachment_id}")
async def serve(
    attachment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    repo = AttachmentRepository(db)
    attachment = await repo.get_by_id(attachment_id)
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    obj = get_file(attachment.storage_key)
    return StreamingResponse(obj, media_type=attachment.content_type)
