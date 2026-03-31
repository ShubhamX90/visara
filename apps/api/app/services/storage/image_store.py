from __future__ import annotations

import asyncio
from io import BytesIO
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.core.exceptions import VisaraAPIError
from app.services.storage.base import StoredFile

ALLOWED_UPLOAD_EXTENSIONS = {".jpg", ".jpeg", ".png", ".dcm", ".dicom"}
DETECTED_CONTENT_TYPES = {
    "jpeg": "image/jpeg",
    "png": "image/png",
    "dicom": "application/dicom",
}


def detect_upload_kind(*, filename: str, payload: bytes) -> str:
    suffix = Path(filename).suffix.lower()

    try:
        with Image.open(BytesIO(payload)) as image:
            detected_format = (image.format or "").upper()
            if detected_format == "JPEG":
                return "jpeg"
            if detected_format == "PNG":
                return "png"
    except (UnidentifiedImageError, OSError):
        pass

    if suffix in {".dcm", ".dicom"}:
        import pydicom

        try:
            pydicom.dcmread(BytesIO(payload), stop_before_pixels=True)
            return "dicom"
        except Exception as exc:
            raise VisaraAPIError(
                code="INVALID_DICOM_FILE",
                message="The uploaded DICOM file could not be validated.",
                detail=str(exc),
                status_code=400,
            ) from exc

    raise VisaraAPIError(
        code="INVALID_FILE_TYPE",
        message="The uploaded file type is not supported.",
        detail="Accepted formats are JPG, PNG, and DICOM (.dcm).",
        status_code=400,
    )


class LocalImageStore:
    def __init__(self, root: Path) -> None:
        self.root = root

    async def ensure_directories(self) -> None:
        await asyncio.to_thread(self.root.mkdir, parents=True, exist_ok=True)

    def resolve_path(self, relative_path: str) -> Path:
        return self.root / relative_path

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
        target_path = self.resolve_path(relative_path)
        await asyncio.to_thread(target_path.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(target_path.write_bytes, payload)

        return StoredFile(
            relative_path=relative_path,
            original_filename=filename,
            content_type=content_type,
            size_bytes=len(payload),
        )

    async def save_overlay(self, *, case_id: str, channel: str, payload: bytes) -> str:
        relative_path = str(Path("cases") / case_id / "overlays" / f"{channel}.png")
        target_path = self.resolve_path(relative_path)
        await asyncio.to_thread(target_path.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(target_path.write_bytes, payload)
        return relative_path

    async def read_bytes(self, relative_path: str) -> bytes:
        target_path = self.resolve_path(relative_path)
        if not target_path.exists():
            raise VisaraAPIError(
                code="FILE_NOT_FOUND",
                message="The requested file could not be found.",
                detail=relative_path,
                status_code=404,
            )
        return await asyncio.to_thread(target_path.read_bytes)
