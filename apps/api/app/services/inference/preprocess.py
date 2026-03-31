from __future__ import annotations

from io import BytesIO
from pathlib import Path

from PIL import Image


def _load_dicom_image(image_source: Path | bytes) -> Image.Image:
    import numpy as np
    import pydicom

    source = BytesIO(image_source) if isinstance(image_source, bytes) else image_source
    dataset = pydicom.dcmread(source)
    pixel_array = dataset.pixel_array
    if pixel_array.ndim == 2:
        pixel_array = np.stack([pixel_array] * 3, axis=-1)
    elif pixel_array.ndim == 3 and pixel_array.shape[0] in {1, 3}:
        pixel_array = np.moveaxis(pixel_array, 0, -1)

    pixel_array = pixel_array.astype("float32")
    pixel_array -= pixel_array.min()
    max_value = float(pixel_array.max())
    if max_value > 0:
        pixel_array /= max_value
    pixel_array = (pixel_array * 255).clip(0, 255).astype("uint8")
    return Image.fromarray(pixel_array).convert("RGB")


def load_source_image(*, image_path: Path, content_type: str) -> Image.Image:
    suffix = image_path.suffix.lower()
    if suffix in {".dcm", ".dicom"} or content_type == "application/dicom":
        return _load_dicom_image(image_path)

    with Image.open(image_path) as image:
        return image.convert("RGB")


def load_source_image_bytes(*, payload: bytes, content_type: str, filename: str) -> Image.Image:
    suffix = Path(filename).suffix.lower()
    if suffix in {".dcm", ".dicom"} or content_type == "application/dicom":
        return _load_dicom_image(payload)

    with Image.open(BytesIO(payload)) as image:
        return image.convert("RGB")


def preprocess_image(image: Image.Image, *, device: str):
    import numpy as np
    import torch

    resized = image.convert("RGB").resize((1280, 1280), resample=Image.BICUBIC)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    tensor = torch.from_numpy(array).permute(2, 0, 1).unsqueeze(0)

    mean = torch.tensor([0.485, 0.456, 0.406], dtype=torch.float32).view(1, 3, 1, 1)
    std = torch.tensor([0.229, 0.224, 0.225], dtype=torch.float32).view(1, 3, 1, 1)
    tensor = (tensor - mean) / std

    target_device = torch.device(device)
    target_dtype = torch.bfloat16 if target_device.type == "cuda" else torch.float32
    return tensor.to(device=target_device, dtype=target_dtype)
