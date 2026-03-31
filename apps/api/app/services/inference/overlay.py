from __future__ import annotations

from io import BytesIO

from PIL import Image

from app.services.inference.predict import LESION_CHANNELS
from app.services.storage.base import StorageBackend

OVERLAY_COLORS: dict[str, tuple[int, int, int, int]] = {
    "ma": (255, 165, 0, 180),
    "he": (255, 255, 0, 180),
    "hem": (220, 20, 60, 180),
    "se": (144, 238, 144, 180),
    "irma": (147, 112, 219, 180),
    "nv": (255, 20, 147, 180),
}


def _render_overlay_payloads(*, seg_logits, original_image: Image.Image) -> dict[str, bytes]:
    import numpy as np
    import torch

    logits = seg_logits[0] if seg_logits.ndim == 4 else seg_logits
    probabilities = torch.sigmoid(logits).detach().float().cpu().numpy()

    overlay_payloads: dict[str, bytes] = {}
    for channel_index, channel in enumerate(LESION_CHANNELS):
        binary_mask = (probabilities[channel_index] >= 0.5).astype("uint8") * 255
        resized_mask = Image.fromarray(binary_mask, mode="L").resize(original_image.size, resample=Image.BICUBIC)
        alpha = np.asarray(resized_mask, dtype="float32") / 255.0

        rgba = np.zeros((original_image.height, original_image.width, 4), dtype="uint8")
        rgba[..., 0] = OVERLAY_COLORS[channel][0]
        rgba[..., 1] = OVERLAY_COLORS[channel][1]
        rgba[..., 2] = OVERLAY_COLORS[channel][2]
        rgba[..., 3] = (alpha * OVERLAY_COLORS[channel][3]).astype("uint8")

        overlay = Image.fromarray(rgba, mode="RGBA")
        buffer = BytesIO()
        overlay.save(buffer, format="PNG")
        overlay_payloads[channel] = buffer.getvalue()

    return overlay_payloads


async def generate_overlays(
    *,
    seg_logits,
    original_image: Image.Image,
    case_id: str,
    storage: StorageBackend,
) -> dict[str, str]:
    overlay_payloads = _render_overlay_payloads(seg_logits=seg_logits, original_image=original_image)
    overlay_paths: dict[str, str] = {}

    for channel, payload in overlay_payloads.items():
        overlay_paths[channel] = await storage.save_overlay(
            case_id=case_id,
            channel=channel,
            payload=payload,
        )

    return overlay_paths
