from __future__ import annotations

from contextlib import nullcontext

LESION_CHANNELS = ("ma", "he", "hem", "se", "irma", "nv")


def _coerce_outputs(model_outputs):
    if isinstance(model_outputs, dict):
        required = {"logits_ord", "logits_ce", "logits_pres", "seg_logits"}
        missing = required.difference(model_outputs)
        if missing:
            raise KeyError(f"Model output is missing required keys: {', '.join(sorted(missing))}")
        return {
            "logits_ord": model_outputs["logits_ord"],
            "logits_ce": model_outputs["logits_ce"],
            "logits_pres": model_outputs["logits_pres"],
            "seg_logits": model_outputs["seg_logits"],
        }

    if isinstance(model_outputs, (list, tuple)) and len(model_outputs) >= 4:
        return {
            "logits_ord": model_outputs[0],
            "logits_ce": model_outputs[1],
            "logits_pres": model_outputs[2],
            "seg_logits": model_outputs[3],
        }

    raise TypeError("Model forward pass must return a mapping or tuple with logits_ord, logits_ce, logits_pres, seg_logits.")


def run_inference(tensor, model) -> dict[str, object]:
    import torch

    autocast_context = (
        torch.cuda.amp.autocast(dtype=torch.bfloat16)
        if tensor.device.type == "cuda"
        else nullcontext()
    )

    with torch.no_grad():
        with autocast_context:
            raw_outputs = model(tensor)

    outputs = _coerce_outputs(raw_outputs)

    logits_pres = outputs["logits_pres"]
    if logits_pres.shape[-1] < len(LESION_CHANNELS):
        raise ValueError("logits_pres must contain at least 6 lesion channels.")

    seg_logits = outputs["seg_logits"]
    if seg_logits.shape[1] < len(LESION_CHANNELS):
        raise ValueError("seg_logits must contain at least 6 lesion channels.")

    return {
        "logits_ord": outputs["logits_ord"].detach().float().cpu(),
        "logits_ce": outputs["logits_ce"].detach().float().cpu(),
        "logits_pres": logits_pres[..., : len(LESION_CHANNELS)].detach().float().cpu(),
        "seg_logits": seg_logits[:, : len(LESION_CHANNELS)].detach().float().cpu(),
    }
