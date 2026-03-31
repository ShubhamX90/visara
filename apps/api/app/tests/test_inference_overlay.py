from __future__ import annotations

from io import BytesIO

import torch
from PIL import Image

from app.services.inference.overlay import _render_overlay_payloads


def test_overlay_payloads_apply_expected_channel_colors() -> None:
    seg_logits = torch.full((1, 6, 4, 4), fill_value=-10.0, dtype=torch.float32)
    seg_logits[:, 0, :, :] = 10.0

    payloads = _render_overlay_payloads(
        seg_logits=seg_logits,
        original_image=Image.new("RGB", (4, 4), color=(0, 0, 0)),
    )

    with Image.open(BytesIO(payloads["ma"])) as ma_overlay:
        assert ma_overlay.convert("RGBA").getpixel((0, 0)) == (255, 165, 0, 180)

    with Image.open(BytesIO(payloads["he"])) as he_overlay:
        assert he_overlay.convert("RGBA").getpixel((0, 0)) == (255, 255, 0, 0)
