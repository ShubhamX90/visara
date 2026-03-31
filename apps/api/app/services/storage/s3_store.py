from __future__ import annotations

import asyncio
from pathlib import Path

from app.core.exceptions import VisaraAPIError
from app.services.storage.base import StoredFile
from app.services.storage.image_store import ALLOWED_UPLOAD_EXTENSIONS, DETECTED_CONTENT_TYPES, detect_upload_kind


class S3ImageStore:
    def __init__(
        self,
        *,
        bucket: str,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        region: str,
        secure: bool,
        prefix: str = "",
    ) -> None:
        self.bucket = bucket
        self.endpoint_url = endpoint_url
        self.access_key = access_key
        self.secret_key = secret_key
        self.region = region
        self.secure = secure
        self.prefix = prefix.strip("/")

    def _client(self):
        import boto3

        return boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            region_name=self.region,
            use_ssl=self.secure,
        )

    def _key(self, relative_path: str) -> str:
        return f"{self.prefix}/{relative_path}" if self.prefix else relative_path

    async def ensure_directories(self) -> None:
        def _ensure_bucket() -> None:
            client = self._client()
            existing_buckets = {bucket["Name"] for bucket in client.list_buckets().get("Buckets", [])}
            if self.bucket not in existing_buckets:
                client.create_bucket(Bucket=self.bucket)

        await asyncio.to_thread(_ensure_bucket)

    def validate_upload(
        self,
        *,
        filename: str,
        content_type: str,
        payload: bytes,
        max_upload_size_bytes: int,
    ) -> str:
        suffix = Path(filename).suffix.lower()
        if suffix not in ALLOWED_UPLOAD_EXTENSIONS:
            raise VisaraAPIError(
                code="INVALID_FILE_TYPE",
                message="The uploaded file type is not supported.",
                detail="Accepted formats are JPG, PNG, and DICOM (.dcm).",
                status_code=400,
            )

        if len(payload) > max_upload_size_bytes:
            raise VisaraAPIError(
                code="FILE_TOO_LARGE",
                message="The uploaded image exceeds the size limit.",
                detail="Maximum supported size is 20MB.",
                status_code=400,
            )

        detected_kind = detect_upload_kind(filename=filename, payload=payload)
        return DETECTED_CONTENT_TYPES[detected_kind]

    async def save_case_upload(
        self,
        *,
        case_id: str,
        filename: str,
        content_type: str,
        payload: bytes,
    ) -> StoredFile:
        suffix = Path(filename).suffix.lower() or ".bin"
        relative_path = str(Path("cases") / case_id / "original" / f"image{suffix}")
        key = self._key(relative_path)

        await asyncio.to_thread(
            self._client().put_object,
            Bucket=self.bucket,
            Key=key,
            Body=payload,
            ContentType=content_type,
        )

        return StoredFile(
            relative_path=relative_path,
            original_filename=filename,
            content_type=content_type,
            size_bytes=len(payload),
        )

    async def save_overlay(self, *, case_id: str, channel: str, payload: bytes) -> str:
        relative_path = str(Path("cases") / case_id / "overlays" / f"{channel}.png")
        key = self._key(relative_path)
        await asyncio.to_thread(
            self._client().put_object,
            Bucket=self.bucket,
            Key=key,
            Body=payload,
            ContentType="image/png",
        )
        return relative_path

    async def read_bytes(self, relative_path: str) -> bytes:
        key = self._key(relative_path)

        def _read() -> bytes:
            try:
                response = self._client().get_object(Bucket=self.bucket, Key=key)
            except Exception as exc:
                raise VisaraAPIError(
                    code="FILE_NOT_FOUND",
                    message="The requested file could not be found.",
                    detail=relative_path,
                    status_code=404,
                ) from exc

            return response["Body"].read()

        return await asyncio.to_thread(_read)
