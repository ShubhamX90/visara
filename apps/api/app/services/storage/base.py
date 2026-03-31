from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(slots=True)
class StoredFile:
    relative_path: str
    original_filename: str
    content_type: str
    size_bytes: int


class StorageBackend(Protocol):
    async def ensure_directories(self) -> None: ...

    def validate_upload(
        self,
        *,
        filename: str,
        content_type: str,
        payload: bytes,
        max_upload_size_bytes: int,
    ) -> str: ...

    async def save_case_upload(
        self,
        *,
        case_id: str,
        filename: str,
        content_type: str,
        payload: bytes,
    ) -> StoredFile: ...

    async def save_overlay(self, *, case_id: str, channel: str, payload: bytes) -> str: ...

    async def read_bytes(self, relative_path: str) -> bytes: ...
