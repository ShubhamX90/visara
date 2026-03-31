from __future__ import annotations


def _build_segmentation_template():
    import torch

    grid = torch.linspace(-1.0, 1.0, 320)
    yy, xx = torch.meshgrid(grid, grid, indexing="ij")
    templates = []
    centers = [
        (-0.30, -0.10),
        (-0.05, 0.18),
        (0.24, -0.22),
        (0.18, 0.26),
        (-0.32, 0.28),
        (0.38, -0.02),
    ]
    for center_x, center_y in centers:
        distance = ((xx - center_x) ** 2 + (yy - center_y) ** 2) / 0.045
        templates.append(torch.exp(-distance))
    return torch.stack(templates, dim=0)


class ReferenceDualDRModel:
    def __new__(cls):
        import torch
        from torch import nn

        class _ReferenceDualDRModel(nn.Module):
            def __init__(self) -> None:
                super().__init__()
                self.retfound_projection = nn.Linear(3, 4)
                self.ordinal_head = nn.Linear(4, 4)
                self.ce_head = nn.Linear(4, 5)
                self.presence_head = nn.Linear(4, 6)
                self.seg_head = nn.Linear(4, 6)
                self.sam_encoder = nn.Conv2d(3, 3, kernel_size=1, bias=False)
                self.register_buffer("segmentation_template", _build_segmentation_template())

            def forward(self, inputs):
                pooled = inputs.mean(dim=(2, 3))
                features = torch.tanh(self.retfound_projection(pooled))
                logits_ord = self.ordinal_head(features)
                logits_ce = self.ce_head(features)
                logits_pres = self.presence_head(features)
                seg_bias = self.seg_head(features).view(-1, 6, 1, 1)
                seg_template = self.segmentation_template.to(device=inputs.device, dtype=inputs.dtype)
                seg_logits = seg_bias + seg_template.unsqueeze(0)
                return {
                    "logits_ord": logits_ord,
                    "logits_ce": logits_ce,
                    "logits_pres": logits_pres,
                    "seg_logits": seg_logits,
                }

        return _ReferenceDualDRModel()
