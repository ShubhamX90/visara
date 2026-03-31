from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime
from importlib import import_module
from pathlib import Path
from threading import Lock

import structlog

from app.config import Settings

_MODEL_HANDLE: ModelHandle | None = None
_MODEL_LOCK = Lock()


@dataclass(slots=True)
class ModelHandle:
    version: str
    status: str
    model_loaded: bool
    gpu_available: bool
    loaded_at: datetime
    model: object | None = None
    device: str = "cpu"
    dtype: str = "float32"
    checkpoint_epoch: int | None = None
    parameter_count: int = 0
    checkpoint_path: str | None = None


def reset_model_handle_cache() -> None:
    global _MODEL_HANDLE
    with _MODEL_LOCK:
        _MODEL_HANDLE = None


def _is_sam_key(key: str) -> bool:
    lowered = key.lower()
    return "sam" in lowered


def _resolve_model_factory(factory_path: str):
    module_name, _, attr_name = factory_path.partition(":")
    if not module_name or not attr_name:
        raise ValueError(f"Invalid model factory path: {factory_path}")

    module = import_module(module_name)
    factory = getattr(module, attr_name)
    return factory


def _build_unloaded_handle(settings: Settings, *, gpu_available: bool, status: str) -> ModelHandle:
    return ModelHandle(
        version=settings.model_version,
        status=status,
        model_loaded=False,
        gpu_available=gpu_available,
        loaded_at=datetime.now(UTC),
    )


def _build_loaded_handle(
    *,
    settings: Settings,
    model,
    gpu_available: bool,
    torch,
    status: str,
    checkpoint_path: str | None = None,
    checkpoint_epoch: int | None = None,
) -> ModelHandle:
    device = torch.device("cuda" if gpu_available else "cpu")
    dtype = torch.bfloat16 if device.type == "cuda" else torch.float32

    model.to(device=device)
    model.to(dtype=dtype)
    model.eval()

    parameter_count = sum(parameter.numel() for parameter in model.parameters())
    return ModelHandle(
        version=settings.model_version,
        status=status,
        model_loaded=True,
        gpu_available=gpu_available,
        loaded_at=datetime.now(UTC),
        model=model,
        device=str(device),
        dtype=str(dtype).replace("torch.", ""),
        checkpoint_epoch=checkpoint_epoch,
        parameter_count=parameter_count,
        checkpoint_path=checkpoint_path,
    )


def _load_model_handle_sync(settings: Settings) -> ModelHandle:
    global _MODEL_HANDLE

    if _MODEL_HANDLE is not None:
        return _MODEL_HANDLE

    with _MODEL_LOCK:
        if _MODEL_HANDLE is not None:
            return _MODEL_HANDLE

        logger = structlog.get_logger("visara.model_loader")

        try:
            import torch
        except Exception:
            logger.warning("torch_unavailable_during_model_load")
            _MODEL_HANDLE = _build_unloaded_handle(settings, gpu_available=False, status="degraded")
            return _MODEL_HANDLE

        gpu_available = bool(torch.cuda.is_available())
        checkpoint_path = settings.model_checkpoint_path
        if checkpoint_path is None:
            if "reference_model" in settings.model_factory_path:
                factory = _resolve_model_factory(settings.model_factory_path)
                model = factory() if callable(factory) else factory
                _MODEL_HANDLE = _build_loaded_handle(
                    settings=settings,
                    model=model,
                    gpu_available=gpu_available,
                    torch=torch,
                    status="operational",
                )
                logger.info(
                    "reference_model_loaded",
                    device=_MODEL_HANDLE.device,
                    dtype=_MODEL_HANDLE.dtype,
                    gpu_available=gpu_available,
                    parameter_count=_MODEL_HANDLE.parameter_count,
                )
                return _MODEL_HANDLE

            logger.warning("model_checkpoint_path_not_configured")
            _MODEL_HANDLE = _build_unloaded_handle(settings, gpu_available=gpu_available, status="degraded")
            return _MODEL_HANDLE

        resolved_checkpoint = Path(checkpoint_path)
        if not resolved_checkpoint.exists():
            raise FileNotFoundError(f"Checkpoint file does not exist: {resolved_checkpoint}")

        factory = _resolve_model_factory(settings.model_factory_path)
        model = factory() if callable(factory) else factory

        checkpoint = torch.load(resolved_checkpoint, map_location="cpu")
        ema_shadow = checkpoint.get("ema", {}).get("shadow")
        if not isinstance(ema_shadow, dict):
            raise KeyError("Checkpoint is missing state['ema']['shadow']")

        incompatible = model.load_state_dict(ema_shadow, strict=False)
        missing_non_sam = sorted(key for key in incompatible.missing_keys if not _is_sam_key(key))
        if missing_non_sam:
            raise RuntimeError(f"EMA checkpoint is missing non-SAM keys: {', '.join(missing_non_sam)}")

        epoch = checkpoint.get("epoch")
        _MODEL_HANDLE = _build_loaded_handle(
            settings=settings,
            model=model,
            gpu_available=gpu_available,
            torch=torch,
            status=settings.model_status,
            checkpoint_path=str(resolved_checkpoint),
            checkpoint_epoch=int(epoch) if isinstance(epoch, int) else None,
        )
        logger.info(
            "model_loaded",
            checkpoint_path=str(resolved_checkpoint),
            checkpoint_epoch=_MODEL_HANDLE.checkpoint_epoch,
            device=_MODEL_HANDLE.device,
            dtype=_MODEL_HANDLE.dtype,
            gpu_available=gpu_available,
            parameter_count=_MODEL_HANDLE.parameter_count,
        )
        return _MODEL_HANDLE


async def load_model_handle(settings: Settings) -> ModelHandle:
    return await asyncio.to_thread(_load_model_handle_sync, settings)
