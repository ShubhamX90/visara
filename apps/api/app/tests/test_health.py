from __future__ import annotations

from httpx import AsyncClient


async def test_health_endpoint(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "operational"
    assert payload["model_loaded"] is True
    assert payload["model_version"] == "visara-v3"
    assert isinstance(payload["gpu_available"], bool)
    assert payload["timestamp"]
