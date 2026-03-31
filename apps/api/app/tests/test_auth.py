from __future__ import annotations

from httpx import AsyncClient
from sqlalchemy import select

from app.models.audit_log import AuditLogRecord


async def test_login_me_logout_flow(client: AsyncClient, app) -> None:
    login_response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "saumya.agarwal@bits-pilani.ac.in",
            "password": "VisaraDemo123!",
        },
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me_response = await client.get("/api/v1/auth/me", headers=headers)
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "saumya.agarwal@bits-pilani.ac.in"

    logout_response = await client.post("/api/v1/auth/logout", headers=headers)
    assert logout_response.status_code == 200
    assert logout_response.json()["message"] == "Logout successful."

    revoked_response = await client.get("/api/v1/auth/me", headers=headers)
    assert revoked_response.status_code == 401
    assert revoked_response.json()["code"] == "SESSION_REVOKED"

    async with app.state.session_maker() as session:
        audit_actions = list(await session.scalars(select(AuditLogRecord.action).order_by(AuditLogRecord.created_at.asc())))

    assert "auth.login" in audit_actions
