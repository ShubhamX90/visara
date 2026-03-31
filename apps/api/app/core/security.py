from __future__ import annotations

import hashlib
import hmac
import os
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt


def hash_password(password: str, *, salt: bytes | None = None) -> str:
    password_salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), password_salt, 120_000)
    return f"{password_salt.hex()}:{digest.hex()}"


def verify_password(password: str, password_hash: str) -> bool:
    salt_hex, digest_hex = password_hash.split(":", maxsplit=1)
    expected_hash = hash_password(password, salt=bytes.fromhex(salt_hex))
    return hmac.compare_digest(expected_hash, f"{salt_hex}:{digest_hex}")


def create_access_token(
    *,
    secret: str,
    algorithm: str,
    user_id: str,
    session_id: str,
    expires_delta: timedelta,
) -> tuple[str, datetime]:
    expires_at = datetime.now(UTC) + expires_delta
    payload: dict[str, Any] = {
        "sub": user_id,
        "sid": session_id,
        "type": "access",
        "exp": expires_at,
    }
    token = jwt.encode(payload, secret, algorithm=algorithm)
    return token, expires_at


def decode_token(*, token: str, secret: str, algorithm: str) -> dict[str, Any]:
    return jwt.decode(token, secret, algorithms=[algorithm])
