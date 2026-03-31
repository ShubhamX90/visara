from __future__ import annotations

import asyncio
from io import BytesIO
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient
from PIL import Image


def make_png_bytes(color: tuple[int, int, int]) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (64, 64), color=color).save(buffer, format="PNG")
    return buffer.getvalue()


def create_reference_checkpoint(path) -> None:
    import torch

    from app.services.inference.loader import reset_model_handle_cache
    from app.services.inference.reference_model import ReferenceDualDRModel

    model = ReferenceDualDRModel()
    with torch.no_grad():
        for parameter in model.parameters():
            parameter.zero_()

        model.retfound_projection.weight.zero_()
        model.retfound_projection.bias.zero_()
        model.retfound_projection.weight[0, 0] = 1.0
        model.retfound_projection.weight[1, 1] = 1.0
        model.retfound_projection.weight[2, 2] = 1.0
        model.retfound_projection.weight[3, 0] = 1 / 3
        model.retfound_projection.weight[3, 1] = 1 / 3
        model.retfound_projection.weight[3, 2] = 1 / 3

        model.ce_head.weight.zero_()
        model.ce_head.bias.zero_()
        model.ce_head.bias[0] = -0.5
        model.ce_head.weight[1, 1] = 4.0
        model.ce_head.bias[1] = 0.5
        model.ce_head.weight[2, 2] = 0.8
        model.ce_head.bias[2] = 0.35
        model.ce_head.weight[3, 0] = 4.0
        model.ce_head.bias[3] = 0.3
        model.ce_head.weight[4, 0] = 2.0
        model.ce_head.weight[4, 2] = 2.0
        model.ce_head.bias[4] = -0.4

        model.ordinal_head.weight.zero_()
        model.ordinal_head.bias.copy_(torch.tensor([1.0, 0.2, -0.2, -1.0]))
        model.ordinal_head.weight[0, 1] = 1.3
        model.ordinal_head.weight[1, 2] = 1.4
        model.ordinal_head.weight[2, 0] = 1.6
        model.ordinal_head.weight[3, 0] = 1.2
        model.ordinal_head.weight[3, 2] = 1.2

        model.presence_head.weight.zero_()
        model.presence_head.bias.fill_(-1.4)
        model.presence_head.weight[0, 1] = 2.4
        model.presence_head.weight[1, 2] = 2.6
        model.presence_head.weight[2, 0] = 2.8
        model.presence_head.weight[3, 2] = 1.8
        model.presence_head.weight[4, 0] = 2.0
        model.presence_head.weight[5, 0] = 1.3
        model.presence_head.weight[5, 2] = 1.6

        model.seg_head.weight.copy_(model.presence_head.weight)
        model.seg_head.bias.copy_(model.presence_head.bias)

        model.sam_encoder.weight.fill_(0.1)

    state_dict = model.state_dict()
    ema_shadow = {
        key: value
        for key, value in state_dict.items()
        if "sam_encoder" not in key
    }
    torch.save({"epoch": 12, "ema": {"shadow": ema_shadow}, "model": state_dict}, path)
    reset_model_handle_cache()


@pytest.fixture
def app_environment(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    database_path = tmp_path / "visara-test.db"
    storage_root = tmp_path / "storage"
    checkpoint_path = tmp_path / "reference-model.ckpt"

    create_reference_checkpoint(checkpoint_path)

    monkeypatch.setenv("VISARA_DATABASE_URL", f"sqlite+aiosqlite:///{database_path}")
    monkeypatch.setenv("VISARA_SECRET_KEY", "test-secret")
    monkeypatch.setenv("VISARA_STORAGE_TYPE", "local")
    monkeypatch.setenv("VISARA_STORAGE_PATH", str(storage_root))
    monkeypatch.setenv("VISARA_MODEL_VERSION", "visara-v3")
    monkeypatch.setenv("VISARA_MODEL_CHECKPOINT_PATH", str(checkpoint_path))
    monkeypatch.setenv("VISARA_MODEL_FACTORY_PATH", "app.services.inference.reference_model:ReferenceDualDRModel")
    monkeypatch.setenv("VISARA_GPU_ENABLED", "false")
    monkeypatch.setenv("VISARA_DEMO_DOCTOR_EMAIL", "saumya.agarwal@bits-pilani.ac.in")
    monkeypatch.setenv("VISARA_DEMO_DOCTOR_PASSWORD", "VisaraDemo123!")
    monkeypatch.setenv("VISARA_DEMO_DOCTOR_NAME", "Dr. Saumya Agarwal")
    monkeypatch.setenv("VISARA_DEMO_TECHNICIAN_EMAIL", "screening.tech@bits-pilani.ac.in")
    monkeypatch.setenv("VISARA_DEMO_TECHNICIAN_PASSWORD", "VisaraTech123!")
    monkeypatch.setenv("VISARA_DEMO_TECHNICIAN_NAME", "Screening Technician")
    monkeypatch.setenv("VISARA_DEMO_ADMIN_EMAIL", "admin@bits-pilani.ac.in")
    monkeypatch.setenv("VISARA_DEMO_ADMIN_PASSWORD", "VisaraAdmin123!")
    monkeypatch.setenv("VISARA_DEMO_ADMIN_NAME", "Research Administrator")
    from app.config import get_settings
    from app.services.inference.loader import reset_model_handle_cache

    get_settings.cache_clear()
    reset_model_handle_cache()
    yield
    reset_model_handle_cache()
    get_settings.cache_clear()


@pytest_asyncio.fixture
async def app(app_environment) -> AsyncIterator:
    from app.main import create_app

    application = create_app()
    async with LifespanManager(application):
        yield application


@pytest_asyncio.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/login",
        json={
            "email": "saumya.agarwal@bits-pilani.ac.in",
            "password": "VisaraDemo123!",
        },
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def create_case(
    client: AsyncClient,
    auth_headers: dict[str, str],
    *,
    patient_ref: str = "PT-1001",
    image_bytes: bytes | None = None,
):
    response = await client.post(
        "/api/v1/cases",
        headers=auth_headers,
        data={
            "patient_ref": patient_ref,
            "eye_side": "left",
            "notes": "Testing upload flow",
        },
        files={"image": ("fundus.png", image_bytes or make_png_bytes((40, 180, 60)), "image/png")},
    )
    assert response.status_code == 201
    return response.json()


async def wait_for_case_completion(
    client: AsyncClient,
    auth_headers: dict[str, str],
    case_id: str,
    *,
    attempts: int = 30,
) -> dict:
    for _ in range(attempts):
        response = await client.get(f"/api/v1/cases/{case_id}", headers=auth_headers)
        assert response.status_code == 200
        payload = response.json()
        if payload["status"] == "complete":
            return payload
        await asyncio.sleep(0.05)

    raise AssertionError(f"Case {case_id} did not complete within the expected time window.")
