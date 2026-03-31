"""
model.py  (DR-MVP v2 — Dual-Encoder)
=====================================
Full dual-encoder DR grading + segmentation model.

Architecture:
  RETFound ViT-L/16  (trainable grading encoder)
    → cls_token      → OrdinalHead, SoftmaxHead
    → cls_token      → PresenceHead (combined with SAM pool)

  SAM ViT-H          (always frozen segmentation encoder)
    → patch_tokens   → SegDecoder → seg_logits, feat_dec
    → block16_feat   → skip_proj → U-Net skip fusion in SegDecoder
    → patch_tokens   → global avg pool → PresenceHead

  SegDecoder         → [B, 6, 320, 320]
  MARefineHead       → [B, 1, 640, 640]

Key differences from v1:
  - SAMImageEncoder added alongside VisionTransformerEncoder (RETFound)
  - SegDecoder: encoder_dim 1024→1280, U-Net skip fusion added
  - PresenceHead: in_dim 1024→2048 (CLS + SAM global pool)
  - DualDRModel.forward() runs SAM under torch.no_grad() always
  - RETFound patch tokens are unused (only CLS used) — DDP find_unused=True

Backward-compatible:
  - model.encoder  = RETFound ViT-L (so freeze/unfreeze utils work unchanged)
  - Output dict keys identical to v1
  - losses.py, evaluate.py, dataset.py, utils.py: NO CHANGES
"""

import math
from functools import partial
from typing import Dict, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.checkpoint import checkpoint

from .sam_encoder import SAMImageEncoder, load_sam_weights, apply_sam_lora


# =============================================================================
#  RETFound ViT-L/16 building blocks  (unchanged from v1)
# =============================================================================

class PatchEmbed(nn.Module):
    def __init__(self, img_size=1280, patch_size=16, in_chans=3, embed_dim=1024):
        super().__init__()
        self.img_size    = img_size
        self.patch_size  = patch_size
        self.grid_size   = img_size // patch_size   # 80 at 1280px
        self.num_patches = self.grid_size ** 2       # 6400

        self.proj = nn.Conv2d(in_chans, embed_dim, kernel_size=patch_size, stride=patch_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.proj(x)                          # [B, D, grid, grid]
        x = x.flatten(2).transpose(1, 2)          # [B, N, D]
        return x


class Attention(nn.Module):
    """MHSA using F.scaled_dot_product_attention (Flash-Attention 2 dispatch)."""

    def __init__(self, dim, num_heads=16, qkv_bias=True, attn_drop=0., proj_drop=0.):
        super().__init__()
        assert dim % num_heads == 0
        self.num_heads = num_heads
        self.head_dim  = dim // num_heads
        self.scale     = self.head_dim ** -0.5

        self.qkv       = nn.Linear(dim, dim * 3, bias=qkv_bias)
        self.proj      = nn.Linear(dim, dim)
        self.attn_drop = attn_drop
        self.proj_drop = nn.Dropout(proj_drop)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B, N, D = x.shape
        qkv = self.qkv(x).reshape(B, N, 3, self.num_heads, self.head_dim)
        qkv = qkv.permute(2, 0, 3, 1, 4)           # [3, B, H, N, d]
        q, k, v = qkv.unbind(0)

        dropout_p = self.attn_drop if self.training else 0.0
        x = F.scaled_dot_product_attention(q, k, v, dropout_p=dropout_p)
        x = x.transpose(1, 2).reshape(B, N, D)
        x = self.proj_drop(self.proj(x))
        return x


class MLP(nn.Module):
    def __init__(self, in_features, hidden_ratio=4.0, drop=0.):
        super().__init__()
        hidden = int(in_features * hidden_ratio)
        self.fc1  = nn.Linear(in_features, hidden)
        self.act  = nn.GELU()
        self.fc2  = nn.Linear(hidden, in_features)
        self.drop = nn.Dropout(drop)

    def forward(self, x):
        return self.drop(self.fc2(self.act(self.fc1(x))))


class DropPath(nn.Module):
    def __init__(self, drop_prob=0.):
        super().__init__()
        self.drop_prob = drop_prob

    def forward(self, x):
        if not self.training or self.drop_prob == 0.:
            return x
        keep = 1 - self.drop_prob
        shape = (x.shape[0],) + (1,) * (x.ndim - 1)
        rand  = torch.rand(shape, dtype=x.dtype, device=x.device).add_(keep).floor_()
        return x * rand / keep


class TransformerBlock(nn.Module):
    """Standard ViT block — weight names match MAE/RETFound checkpoint."""

    def __init__(self, dim, num_heads, mlp_ratio=4., qkv_bias=True,
                 drop=0., attn_drop=0., drop_path=0.):
        super().__init__()
        self.norm1     = nn.LayerNorm(dim)
        self.attn      = Attention(dim, num_heads, qkv_bias, attn_drop, drop)
        self.drop_path = DropPath(drop_path) if drop_path > 0. else nn.Identity()
        self.norm2     = nn.LayerNorm(dim)
        self.mlp       = MLP(dim, mlp_ratio, drop)

    def forward(self, x):
        x = x + self.drop_path(self.attn(self.norm1(x)))
        x = x + self.drop_path(self.mlp(self.norm2(x)))
        return x


class VisionTransformerEncoder(nn.Module):
    """
    RETFound ViT-L/16 encoder (trainable grading backbone).
    At 1280px: grid_size=80, num_patches=6400.
    """

    def __init__(self, img_size=1280, patch_size=16, in_chans=3, embed_dim=1024,
                 depth=24, num_heads=16, mlp_ratio=4., qkv_bias=True,
                 drop_rate=0., attn_drop_rate=0., drop_path_rate=0.1,
                 grad_checkpointing=True):
        super().__init__()
        self.embed_dim          = embed_dim
        self.grad_checkpointing = grad_checkpointing

        self.patch_embed = PatchEmbed(img_size, patch_size, in_chans, embed_dim)
        num_patches = self.patch_embed.num_patches   # 6400

        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        self.pos_embed = nn.Parameter(torch.zeros(1, num_patches + 1, embed_dim))
        self.pos_drop  = nn.Dropout(drop_rate)

        dpr = [drop_path_rate * i / (depth - 1) for i in range(depth)]
        self.blocks = nn.ModuleList([
            TransformerBlock(embed_dim, num_heads, mlp_ratio, qkv_bias,
                             drop_rate, attn_drop_rate, dpr[i])
            for i in range(depth)
        ])
        self.norm = nn.LayerNorm(embed_dim)
        self._init_weights()

    def _init_weights(self):
        nn.init.trunc_normal_(self.pos_embed, std=0.02)
        nn.init.trunc_normal_(self.cls_token, std=0.02)
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.trunc_normal_(m.weight, std=0.02)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
            elif isinstance(m, nn.LayerNorm):
                nn.init.ones_(m.weight)
                nn.init.zeros_(m.bias)

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """Returns (cls_token [B, D], patch_tokens [B, N, D])."""
        B = x.shape[0]
        x   = self.patch_embed(x)                          # [B, N, D]
        cls = self.cls_token.expand(B, -1, -1)             # [B, 1, D]
        x   = torch.cat([cls, x], dim=1)                   # [B, N+1, D]
        x   = self.pos_drop(x + self.pos_embed)

        for block in self.blocks:
            if self.grad_checkpointing and self.training:
                x = checkpoint(block, x, use_reentrant=False)
            else:
                x = block(x)

        x = self.norm(x)
        return x[:, 0], x[:, 1:]   # cls_token, patch_tokens


# =============================================================================
#  Segmentation decoder helper
# =============================================================================

def _make_conv_block(in_c: int, out_c: int, groups: int = 32) -> nn.Sequential:
    """Conv3×3 → GroupNorm → GELU. Auto-adjusts groups to divide out_c."""
    g = groups
    while out_c % g != 0:
        g //= 2
    return nn.Sequential(
        nn.Conv2d(in_c, out_c, 3, padding=1, bias=False),
        nn.GroupNorm(g, out_c),
        nn.GELU(),
    )


# =============================================================================
#  Segmentation decoder  (v2 — updated from v1)
# =============================================================================

class SegDecoder(nn.Module):
    """
    Lightweight CNN decoder for 6-channel lesion segmentation.

    v2 Changes vs v1:
      - encoder_dim: 1024 → 1280  (SAM ViT-H dim)
      - Added skip fusion after Stage 1 (U-Net style)
      - feat_128 renamed to feat_dec (spatial size is 160×160 at 1280px)

    Input:
        patch_2d   : [B, 1280, 80, 80]    SAM final tokens (reshaped)
        feat_skip  : [B, 128, 160, 160]   SAM block-16 skip (projected + ×2 upsampled)

    Output:
        seg_logits : [B, 6, 320, 320]
        feat_dec   : [B, 256, 160, 160]   → input to MARefineHead
    """

    def __init__(self, encoder_dim: int = 1280, num_classes: int = 6):
        super().__init__()

        # 1×1 projection: 1280 → 512
        self.proj = nn.Sequential(
            nn.Conv2d(encoder_dim, 512, 1, bias=False),
            nn.GroupNorm(32, 512),
            nn.GELU(),
        )

        # Stage 1: 80×80 → 160×160, 512 → 256
        self.up1   = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False)
        self.conv1 = nn.Sequential(
            _make_conv_block(512, 256, groups=16),
            _make_conv_block(256, 256, groups=16),
        )

        # Skip fusion: concat [256, 160] + [128, 160] → fusion conv → [256, 160]
        self.fusion_conv = nn.Sequential(
            nn.Conv2d(256 + 128, 256, 1, bias=False),
            nn.GroupNorm(16, 256),
            nn.GELU(),
        )

        # Early skip fusion: concat [128, 320] + [64, 320] → [128, 320]
        self.fusion_conv2 = nn.Sequential(
            nn.Conv2d(128 + 64, 128, 1, bias=False),
            nn.GroupNorm(8, 128),
            nn.GELU(),
        )

        # Stage 2: 160×160 → 320×320, 256 → 128
        self.up2   = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False)
        self.conv2 = nn.Sequential(
            _make_conv_block(256, 128, groups=16),
            _make_conv_block(128, 128, groups=16),
        )

        # Final segmentation head
        self.seg_head = nn.Conv2d(128, num_classes, 1)

        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(
        self,
        patch_2d: torch.Tensor,            # [B, 1280, 80, 80]
        feat_skip: torch.Tensor,           # [B, 128, 160, 160]
        feat_skip_early: torch.Tensor = None,  # [B, 64, 320, 320] (block 8)
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        x = self.proj(patch_2d)          # [B, 512, 80, 80]

        x = self.up1(x)                  # [B, 512, 160, 160]
        x = self.conv1(x)                # [B, 256, 160, 160]

        # U-Net skip fusion (block 16 — mid-level features)
        x = torch.cat([x, feat_skip], dim=1)   # [B, 384, 160, 160]
        x = self.fusion_conv(x)                 # [B, 256, 160, 160]
        feat_dec = x                            # → MARefineHead input

        x = self.up2(x)                  # [B, 256, 320, 320]
        x = self.conv2(x)                # [B, 128, 320, 320]

        # Early skip fusion (block 8 — low-level spatial detail for MA/IRMA)
        if feat_skip_early is not None:
            x = torch.cat([x, feat_skip_early], dim=1)  # [B, 192, 320, 320]
            x = self.fusion_conv2(x)                      # [B, 128, 320, 320]

        seg_logits = self.seg_head(x)    # [B, 6,  320, 320]

        return seg_logits, feat_dec


# =============================================================================
#  MA Refinement Head  (unchanged from v1 — only input name changed)
# =============================================================================

class MARefineHead(nn.Module):
    """
    High-resolution MA segmentation branch.

    Input:  feat_dec [B, 256, 160, 160]   (renamed from feat_128 in v1)
    Output: ma_logits [B, 1, 640, 640]

    Rationale: MAs are 30–125 µm → 2–8 px at 1280px.
    This branch refines at 640px to preserve micro-aneurysm detail.
    """

    def __init__(self):
        super().__init__()
        # 160 → 320
        self.up1   = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False)
        self.conv1 = nn.Sequential(
            _make_conv_block(256, 128),
            _make_conv_block(128, 128),
        )
        # 320 → 640
        self.up2   = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False)
        self.conv2 = nn.Sequential(
            _make_conv_block(128, 64),
            _make_conv_block(64,  64),
        )
        self.ma_head = nn.Conv2d(64, 1, 1)
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, feat_dec: torch.Tensor) -> torch.Tensor:
        x = self.conv1(self.up1(feat_dec))   # [B, 128, 320, 320]
        x = self.conv2(self.up2(x))           # [B, 64,  640, 640]
        return self.ma_head(x)                # [B, 1,   640, 640]



# =============================================================================
#  Auxiliary Segmentation Decoder — RETFound patch token spatial signal
# =============================================================================

class AuxSegDecoder(nn.Module):
    """
    Lightweight auxiliary decoder on RETFound patch_tokens.
    Routes seg gradient back through RETFound so the CLS token develops
    spatial lesion context helpful for G2-G3 boundary discrimination.
    Gated by use_aux_seg=False (safe default; enable in Phase 1.5 or Phase 2).
    In:  [B, 6400, 1024]  Out: [B, 6, 320, 320]
    """
    def __init__(self, encoder_dim: int = 1024, num_classes: int = 6):
        super().__init__()
        self.proj  = nn.Sequential(nn.Conv2d(encoder_dim, 256, 1, bias=False),
                                   nn.GroupNorm(16, 256), nn.GELU())
        self.up1   = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False)
        self.conv1 = _make_conv_block(256, 128, groups=8)
        self.up2   = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False)
        self.conv2 = _make_conv_block(128, 64,  groups=8)
        self.head  = nn.Conv2d(64, num_classes, 1)
        for m in self.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")
                if m.bias is not None: nn.init.zeros_(m.bias)

    def forward(self, patch_tokens: torch.Tensor) -> torch.Tensor:
        B, N, D = patch_tokens.shape
        gs = int(round(N ** 0.5))
        x  = patch_tokens.reshape(B, gs, gs, D).permute(0, 3, 1, 2)
        x  = self.proj(x)
        x  = self.conv1(self.up1(x))
        x  = self.up2(x)
        x  = self.conv2(x)
        return self.head(x)


# =============================================================================
#  Grading heads  (unchanged from v1)
# =============================================================================

class OrdinalHead(nn.Module):
    """
    Cumulative ordinal grading head.
    Output: 4 logits → P(y≥1), P(y≥2), P(y≥3), P(y≥4).
    Bias init ensures naturally decreasing priors.
    """

    def __init__(self, in_dim: int = 1024):
        super().__init__()
        self.fc = nn.Linear(in_dim, 4)
        nn.init.trunc_normal_(self.fc.weight, std=0.02)
        with torch.no_grad():
            self.fc.bias.copy_(torch.tensor([2.0, 1.0, 0.0, -1.0]))

    def forward(self, cls_token: torch.Tensor) -> torch.Tensor:
        return self.fc(cls_token)   # [B, 4]

    @staticmethod
    def decode(logits: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """Isotonic decoding: monotone cumulative probs + grade distribution."""
        cum_probs = torch.sigmoid(logits)                       # [B, 4]
        # Enforce P(y≥1) ≥ P(y≥2) ≥ P(y≥3) ≥ P(y≥4) via running max right-to-left
        cum_rev   = cum_probs.flip(-1)
        cum_probs = torch.cummax(cum_rev, dim=-1)[0].flip(-1)

        ones  = torch.ones_like(cum_probs[:, :1])
        zeros = torch.zeros_like(cum_probs[:, :1])
        bnd   = torch.cat([ones, cum_probs, zeros], dim=1)      # [B, 6]
        grade_probs = (bnd[:, :-1] - bnd[:, 1:]).clamp(min=0.)  # [B, 5]
        return cum_probs, grade_probs


class SoftmaxHead(nn.Module):
    """5-class softmax grading head."""

    def __init__(self, in_dim: int = 1024, n_classes: int = 5):
        super().__init__()
        self.fc = nn.Linear(in_dim, n_classes)
        nn.init.trunc_normal_(self.fc.weight, std=0.02)
        nn.init.zeros_(self.fc.bias)

    def forward(self, cls_token: torch.Tensor) -> torch.Tensor:
        return self.fc(cls_token)   # [B, 5]


# =============================================================================
#  Presence head  (v2 — updated from v1)
# =============================================================================

class PresenceHead(nn.Module):
    """
    8-way binary lesion presence classifier.

    v2: receives concatenated RETFound CLS token + SAM global pool → [B, 2048]
    v1: received CLS token only → [B, 1024]

    Channels 0-5: MA, HE, HEM, SE, IRMA, NV (supervised)
    Channels 6-7: LM, PM (no labels in FGADR — not supervised)
    """

    def __init__(self, in_dim: int = 2048, n_classes: int = 8, dropout: float = 0.2):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 512),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(512, n_classes),
        )
        for m in self.net.modules():
            if isinstance(m, nn.Linear):
                nn.init.trunc_normal_(m.weight, std=0.02)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)   # [B, 8]


# =============================================================================
#  Top-level DualDRModel
# =============================================================================

class DualDRModel(nn.Module):
    """
    DR-MVP v2: dual-encoder architecture.

    Gradient routing:
      ✅ Grading losses → OrdinalHead / SoftmaxHead → RETFound encoder (trainable)
      ✅ Seg losses     → SegDecoder / skip_proj / MARefineHead → decoder params
      ✅ Pres losses    → PresenceHead / presence_sam_proj → trainable params
      ❌ Seg losses     → SAM encoder  (blocked by torch.no_grad())
      ❌ Any loss       → RETFound patch tokens (unused, DDP find_unused=True)

    Attributes (backward-compatible with v1 utils):
      self.encoder   = VisionTransformerEncoder  (← freeze/unfreeze utils key on this)

    Forward output dict (identical keys to v1):
      logits_ord         [B, 4]
      logits_ce          [B, 5]
      logits_pres        [B, 8]
      seg_logits         [B, 6, 320, 320]
      ma_refine_logits   [B, 1, 640, 640]  or None
    """

    def __init__(
        self,
        # RETFound hyperparameters
        img_size:           int   = 1280,
        patch_size:         int   = 16,
        embed_dim:          int   = 1024,
        depth:              int   = 24,
        num_heads:          int   = 16,
        mlp_ratio:          float = 4.0,
        drop_path_rate:     float = 0.1,
        grad_checkpointing: bool  = True,
        # Architecture flags
        use_ma_refine:      bool  = True,
        use_aux_seg:        bool  = False,
        n_seg_classes:      int   = 6,
        n_pres_channels:    int   = 8,
    ):
        super().__init__()
        self.use_ma_refine = use_ma_refine
        self.grid_size     = img_size // patch_size    # 80

        # SAM ViT-H fixed hyperparameters
        self.sam_embed_dim = SAMImageEncoder.SAM_EMBED_DIM   # 1280

        # ── Grading encoder: RETFound ViT-L/16 ───────────────────────────────
        # Named 'encoder' for backward compatibility with all utils functions:
        # freeze_encoder(model), unfreeze_last_n_blocks(model, n), etc.
        self.encoder = VisionTransformerEncoder(
            img_size           = img_size,
            patch_size         = patch_size,
            embed_dim          = embed_dim,
            depth              = depth,
            num_heads          = num_heads,
            mlp_ratio          = mlp_ratio,
            drop_path_rate     = drop_path_rate,
            grad_checkpointing = grad_checkpointing,
        )

        # ── Segmentation encoder: SAM ViT-H (always frozen) ──────────────────
        # Weights loaded via load_sam_weights() in build_model().
        # All params: requires_grad = False after weight loading.
        self.sam_encoder = SAMImageEncoder(img_size=img_size)

        # ── Skip connection projection (trainable) ────────────────────────────
        # SAM block-16 tokens → [B, 1280, 80, 80] → [B, 128, 80, 80]
        self.skip_proj = nn.Sequential(
            nn.Conv2d(self.sam_embed_dim, 128, 1, bias=False),
            nn.GroupNorm(8, 128),
            nn.GELU(),
        )
        for m in self.skip_proj.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")

        # ── Early skip projection (block 8 → low-level spatial detail) ───
        # [B, 1280, 80, 80] → [B, 64, 80, 80], then ×4 upsample → [B, 64, 320, 320]
        self.skip_proj_early = nn.Sequential(
            nn.Conv2d(self.sam_embed_dim, 64, 1, bias=False),
            nn.GroupNorm(8, 64),
            nn.GELU(),
        )
        for m in self.skip_proj_early.modules():
            if isinstance(m, nn.Conv2d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")

        # ── Segmentation decoder (takes SAM features + skip) ─────────────────
        self.seg_decoder = SegDecoder(
            encoder_dim = self.sam_embed_dim,   # 1280
            num_classes = n_seg_classes,
        )

        # ── MA refinement head ────────────────────────────────────────────────
        self.ma_refine = MARefineHead() if use_ma_refine else None

        # ── Grading heads (RETFound CLS token only) ───────────────────────────
        self.ordinal_head = OrdinalHead(in_dim=embed_dim)
        self.softmax_head = SoftmaxHead(in_dim=embed_dim)

        # ── Presence: SAM global pool projection (trainable) ─────────────────
        # SAM patch_tokens.mean(dim=1) [B, 1280] → [B, 1024]
        self.presence_sam_proj = nn.Linear(self.sam_embed_dim, embed_dim)
        nn.init.trunc_normal_(self.presence_sam_proj.weight, std=0.02)
        nn.init.zeros_(self.presence_sam_proj.bias)

        # ── Presence head (CLS + SAM pool → [B, 2048]) ───────────────────────
        self.presence_head = PresenceHead(
            in_dim    = embed_dim * 2,   # 2048
            n_classes = n_pres_channels,
        )

        # ── Aux seg decoder (gated, default False — enable in Phase 1.5/2) ──
        self.use_aux_seg     = use_aux_seg
        self.aux_seg_decoder = (
            AuxSegDecoder(encoder_dim=embed_dim, num_classes=n_seg_classes)
            if use_aux_seg else None
        )

    # ------------------------------------------------------------------
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        x : FloatTensor [B, 3, 1280, 1280]

        Returns dict with keys:
          logits_ord, logits_ce, logits_pres, seg_logits, ma_refine_logits
        """
        B = x.shape[0]
        gs = self.grid_size   # 80

        # ── SAM encoder ──────────────────────────────────────────────────────
        # Blocks 0-27: frozen, run under no_grad inside SAMImageEncoder.
        # Blocks 28-31: LoRA-adapted, run with grad enabled (if LoRA applied).
        # No outer no_grad — SAMImageEncoder handles the split internally.
        patch_tokens_final, patch_tokens_block16, patch_tokens_block8 = self.sam_encoder(x)

        # ── Reshape SAM tokens to spatial format ─────────────────────────────
        def _to_spatial(tokens):
            return (tokens.reshape(B, gs, gs, self.sam_embed_dim)
                    .permute(0, 3, 1, 2).contiguous())

        patch_2d = _to_spatial(patch_tokens_final)     # [B, 1280, 80, 80]
        skip_2d  = _to_spatial(patch_tokens_block16)   # [B, 1280, 80, 80]
        skip_2d_early = _to_spatial(patch_tokens_block8)  # [B, 1280, 80, 80]

        # ── Skip projections (trainable) ──────────────────────────────────────
        feat_skip = self.skip_proj(skip_2d)                               # [B, 128, 80, 80]
        feat_skip = F.interpolate(feat_skip, scale_factor=2,
                                  mode="bilinear", align_corners=False)   # [B, 128, 160, 160]

        feat_skip_early = self.skip_proj_early(skip_2d_early)             # [B, 64, 80, 80]
        feat_skip_early = F.interpolate(feat_skip_early, scale_factor=4,
                                        mode="bilinear", align_corners=False)  # [B, 64, 320, 320]

        # ── SAM global pool for presence (trainable projection) ───────────────
        sam_pool  = patch_tokens_final.mean(dim=1)          # [B, 1280]
        sam_feat  = self.presence_sam_proj(sam_pool)        # [B, 1024]

        # ── RETFound encoder (grading, trainable) ────────────────────────────
        cls_token, patch_tokens = self.encoder(x)          # cls_token: [B, 1024]

        # ── Grading heads ─────────────────────────────────────────────────────
        logits_ord = self.ordinal_head(cls_token)           # [B, 4]
        logits_ce  = self.softmax_head(cls_token)           # [B, 5]

        # ── Presence head ─────────────────────────────────────────────────────
        pres_feat   = torch.cat([cls_token, sam_feat], dim=1)   # [B, 2048]
        logits_pres = self.presence_head(pres_feat)              # [B, 8]

        # ── Segmentation decoder (with both skips) ────────────────────────────
        seg_logits, feat_dec = self.seg_decoder(patch_2d, feat_skip, feat_skip_early)
        # seg_logits: [B, 6, 320, 320]
        # feat_dec:   [B, 256, 160, 160]

        # ── MA refinement head ────────────────────────────────────────────────
        ma_refine_logits = None
        if self.use_ma_refine and self.ma_refine is not None:
            ma_refine_logits = self.ma_refine(feat_dec)    # [B, 1, 640, 640]

        # ── Aux seg (RETFound patch tokens, gated) ────────────────────────
        aux_seg_logits = None
        if self.use_aux_seg and self.aux_seg_decoder is not None:
            aux_seg_logits = self.aux_seg_decoder(patch_tokens)

        return {
            "logits_ord":       logits_ord,
            "logits_ce":        logits_ce,
            "logits_pres":      logits_pres,
            "seg_logits":       seg_logits,
            "ma_refine_logits": ma_refine_logits,
            "aux_seg_logits":   aux_seg_logits,
        }


# =============================================================================
#  RETFound weight loading (unchanged from v1)
# =============================================================================

def _interpolate_pos_embed(
    model: VisionTransformerEncoder,
    state_dict: dict,
) -> dict:
    """Bicubic interpolation of pos_embed from 224px (14×14) to 1280px (80×80)."""
    if "pos_embed" not in state_dict:
        return state_dict

    pos_ckpt = state_dict["pos_embed"]      # [1, N_old+1, D]
    D        = pos_ckpt.shape[-1]
    N_model  = model.patch_embed.num_patches
    N_extra  = 1   # CLS token

    N_ckpt   = pos_ckpt.shape[1] - N_extra
    grid_old = int(round(N_ckpt ** 0.5))    # 14 for 224px
    grid_new = int(round(N_model ** 0.5))   # 80 for 1280px

    if grid_old == grid_new:
        return state_dict

    print(f"  [RETFound] Interpolating pos_embed: {grid_old}×{grid_old} → {grid_new}×{grid_new}")

    extra_tokens  = pos_ckpt[:, :N_extra]                    # [1, 1, D]
    patch_tokens  = pos_ckpt[:, N_extra:]                    # [1, N_old, D]
    patch_tokens  = patch_tokens.reshape(1, grid_old, grid_old, D).permute(0, 3, 1, 2)
    patch_tokens  = F.interpolate(
        patch_tokens.float(),
        size=(grid_new, grid_new),
        mode="bicubic",
        align_corners=False,
    ).to(pos_ckpt.dtype)
    patch_tokens  = patch_tokens.permute(0, 2, 3, 1).flatten(1, 2)   # [1, N_new, D]

    state_dict["pos_embed"] = torch.cat([extra_tokens, patch_tokens], dim=1)
    return state_dict


def load_retfound_weights(
    model: DualDRModel,
    checkpoint_path: str,
) -> DualDRModel:
    """
    Load RETFound MAE pretrained weights into model.encoder (RETFound ViT-L/16).

    Handles:
      - Various checkpoint formats (raw / {'model': ...} / {'state_dict': ...})
      - 'module.' prefix from DDP-saved checkpoints
      - MAE decoder keys (discarded)
      - Positional embedding interpolation from 224px → 1280px
    """
    print(f"  [RETFound] Loading weights from: {checkpoint_path}")
    ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=False)

    if isinstance(ckpt, dict):
        if "model" in ckpt:
            sd = ckpt["model"]
        elif "state_dict" in ckpt:
            sd = ckpt["state_dict"]
        else:
            sd = ckpt
    else:
        raise ValueError(f"Unexpected checkpoint type: {type(ckpt)}")

    def strip_prefix(d, prefix):
        return {k[len(prefix):] if k.startswith(prefix) else k: v for k, v in d.items()}

    for prefix in ("module.", "encoder.", "backbone."):
        if any(k.startswith(prefix) for k in sd):
            sd = strip_prefix(sd, prefix)

    # Discard MAE decoder keys
    decoder_pfx = ("decoder_", "mask_token", "decoder.")
    sd = {k: v for k, v in sd.items() if not any(k.startswith(p) for p in decoder_pfx)}

    # Positional embedding interpolation
    sd = _interpolate_pos_embed(model.encoder, sd)

    # Prefix keys with 'encoder.' to target model.encoder
    encoder_sd = {f"encoder.{k}": v for k, v in sd.items()}
    missing, unexpected = model.load_state_dict(encoder_sd, strict=False)

    encoder_missing = [k for k in missing if k.startswith("encoder.")]
    non_encoder_missing = [k for k in missing if not k.startswith("encoder.")]
    print(f"  [RETFound] Loaded {len(sd) - len(unexpected)} encoder tensors")
    if encoder_missing:
        print(f"  [RETFound] ⚠ Missing encoder keys: {encoder_missing[:5]}")
    if non_encoder_missing:
        print(f"  [RETFound] Non-encoder keys (random init): {len(non_encoder_missing)}")
    return model


# =============================================================================
#  Model factory
# =============================================================================

def build_model(config) -> DualDRModel:
    """
    Instantiate DualDRModel from config, load RETFound and SAM weights.

    Required config fields (new in v2):
      config.model.sam_checkpoint : path to sam_vit_h_4b8939.pth

    Returns the model on CPU (caller moves to device).
    """
    model = DualDRModel(
        img_size           = config.data.img_size,
        patch_size         = config.model.patch_size,
        embed_dim          = config.model.embed_dim,
        depth              = config.model.depth,
        num_heads          = config.model.num_heads,
        mlp_ratio          = config.model.mlp_ratio,
        drop_path_rate     = config.model.drop_path_rate,
        grad_checkpointing = config.model.grad_checkpointing,
        use_ma_refine      = config.model.use_ma_refine,
        use_aux_seg        = getattr(config.model, "use_aux_seg", False),
        n_seg_classes      = len(config.data.lesion_channels),
        n_pres_channels    = config.model.presence_dim,
    )

    # Load RETFound weights into model.encoder
    model = load_retfound_weights(model, config.paths.pretrained_path)

    # Load SAM ViT-H weights into model.sam_encoder + freeze
    sam_ckpt = getattr(config.model, "sam_checkpoint", None)
    if sam_ckpt:
        load_sam_weights(model.sam_encoder, sam_ckpt)
    else:
        import warnings
        warnings.warn(
            "config.model.sam_checkpoint not set — SAM encoder uses random "
            "initialization. Segmentation quality will be very poor."
        )

    # Apply LoRA to SAM's last blocks (after loading and freezing base weights)
    lora_rank = getattr(config.model, "sam_lora_rank", 0)
    if lora_rank > 0:
        lora_blocks = getattr(config.model, "sam_lora_blocks", [28, 29, 30, 31])
        apply_sam_lora(model.sam_encoder, rank=lora_rank,
                       block_indices=tuple(lora_blocks))

    return model
