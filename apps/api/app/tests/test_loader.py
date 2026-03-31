from __future__ import annotations

from app.config import get_settings
from app.services.inference.loader import load_model_handle, reset_model_handle_cache


async def test_reference_model_loads_without_checkpoint(monkeypatch) -> None:
    monkeypatch.setenv("VISARA_MODEL_FACTORY_PATH", "app.services.inference.reference_model:ReferenceDualDRModel")
    monkeypatch.setenv("VISARA_MODEL_CHECKPOINT_PATH", "")

    get_settings.cache_clear()
    reset_model_handle_cache()

    settings = get_settings()
    model_handle = await load_model_handle(settings)

    assert model_handle.status == "operational"
    assert model_handle.model_loaded is True
    assert model_handle.model is not None
    assert model_handle.checkpoint_path is None

    reset_model_handle_cache()
    get_settings.cache_clear()
