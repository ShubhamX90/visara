from __future__ import annotations

from app.config import Settings
from app.services.storage.base import StorageBackend
from app.services.storage.image_store import LocalImageStore
from app.services.storage.s3_store import S3ImageStore


def build_storage_backend(settings: Settings) -> StorageBackend:
    if settings.storage_type == "s3":
        return S3ImageStore(
            bucket=settings.storage_bucket or "",
            endpoint_url=settings.storage_endpoint_url or "",
            access_key=settings.storage_access_key or "",
            secret_key=settings.storage_secret_key or "",
            region=settings.storage_region,
            secure=settings.storage_secure,
            prefix="visara",
        )

    if settings.storage_root is None:
        raise ValueError("Local storage requires VISARA_STORAGE_PATH to be configured.")
    return LocalImageStore(settings.storage_root)
