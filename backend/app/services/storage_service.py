import io
import uuid

from minio import Minio
from minio.error import S3Error

from app.config import get_settings

settings = get_settings()

_client: Minio | None = None


def get_minio() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
    return _client


def ensure_bucket() -> None:
    client = get_minio()
    try:
        if not client.bucket_exists(settings.minio_bucket):
            client.make_bucket(settings.minio_bucket)
    except S3Error as e:
        raise RuntimeError(f"MinIO bucket setup failed: {e}") from e


def upload_file(data: bytes, content_type: str, filename: str) -> str:
    """Upload bytes to MinIO and return the storage key."""
    client = get_minio()
    ext = filename.rsplit(".", 1)[-1] if "." in filename else ""
    key = f"{uuid.uuid4()}.{ext}" if ext else str(uuid.uuid4())
    client.put_object(
        settings.minio_bucket,
        key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return key


def get_file(storage_key: str):
    """Return a MinIO GetObjectResponse for streaming."""
    return get_minio().get_object(settings.minio_bucket, storage_key)


def delete_file(storage_key: str) -> None:
    client = get_minio()
    try:
        client.remove_object(settings.minio_bucket, storage_key)
    except S3Error:
        pass
