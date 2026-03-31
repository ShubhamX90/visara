"""
sam_encoder.py
==============
SAM ViT-H image encoder wrapper for DR-MVP v2.

Responsibilities:
  1. Implement SAM ViT-H architecture (32 blocks, 1280-dim, 16 heads)
     - 28 blocks use windowed attention (14×14 windows)
     - 4 blocks use global attention (blocks 7, 15, 23, 31)
     - 2D absolute positional embeddings
     - Decomposed relative position biases inside attention
  2. Load SAM ViT-H weights from sam_vit_h_4b8939.pth
     - Key prefix: 'image_encoder.'
     - Interpolate abs pos_embed: [1, 64, 64, 1280] → [1, 80, 80, 1280]
     - Interpolate global-attn rel_pos: [127, 80] → [159, 80]
  3. Capture block 16 intermediate features for U-Net skip connection
  4. Return (patch_tokens_final, patch_tokens_block16) always under torch.no_grad()
  5. Guarantee requires_grad=False for ALL parameters after weight loading

Architecture summary (SAM ViT-H @ 1280px input):
  PatchEmbed:  Conv2d(3, 1280, k=16, s=16) → permute → [B, 80, 80, 1280]
  pos_embed:   [1, 80, 80, 1280] (interpolated from pretrained 64×64)
  blocks 0-31: SAMBlock (windowed or global) → [B, 80, 80, 1280]
  Output:      (final_tokens [B, 6400, 1280], block16_tokens [B, 6400, 1280])

NOTE: The SAM 'neck' (post-transformer convolutions) is bypassed entirely.
      We extract raw transformer tokens before the neck.
"""

from typing import List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
import math


# =============================================================================
#  Global attention block indices (0-indexed, SAM ViT-H)
# =============================================================================

GLOBAL_ATTN_INDICES: Tuple[int, ...] = (7, 15, 23, 31)


# =============================================================================
#  Window partition / unpartition utilities
# =============================================================================

def window_partition(
    x: torch.Tensor,
    window_size: int,
) -> Tuple[torch.Tensor, Tuple[int, int]]:
    """
    Partition feature map into non-overlapping windows.
    Pads H and W to the nearest multiple of window_size if needed.

    Parameters
    ----------
    x           : FloatTensor [B, H, W, D]
    window_size : int

    Returns
    -------
    windows : FloatTensor [B * num_windows, window_size, window_size, D]
    pad_hw  : (pad_h, pad_w) — padding added so caller can remove it
    """
    B, H, W, D = x.shape
    pad_h = (window_size - H % window_size) % window_size
    pad_w = (window_size - W % window_size) % window_size

    if pad_h > 0 or pad_w > 0:
        # F.pad pads last dims first: (D_left, D_right, W_left, W_right, H_top, H_bottom)
        x = F.pad(x, (0, 0, 0, pad_w, 0, pad_h))

    Hp, Wp = H + pad_h, W + pad_w
    x = x.reshape(B, Hp // window_size, window_size, Wp // window_size, window_size, D)
    windows = (
        x.permute(0, 1, 3, 2, 4, 5)
         .contiguous()
         .reshape(-1, window_size, window_size, D)
    )
    return windows, (pad_h, pad_w)


def window_unpartition(
    windows: torch.Tensor,
    window_size: int,
    pad_hw: Tuple[int, int],
    hw: Tuple[int, int],
) -> torch.Tensor:
    """
    Reverse of window_partition.

    Parameters
    ----------
    windows     : FloatTensor [B * num_windows, window_size, window_size, D]
    window_size : int
    pad_hw      : (pad_h, pad_w) from window_partition
    hw          : (H, W) original (pre-padding) spatial dimensions

    Returns
    -------
    x : FloatTensor [B, H, W, D]
    """
    pad_h, pad_w = pad_hw
    H, W = hw
    Hp, Wp = H + pad_h, W + pad_w
    B = windows.shape[0] // (Hp * Wp // window_size ** 2)

    x = windows.reshape(B, Hp // window_size, Wp // window_size, window_size, window_size, -1)
    x = x.permute(0, 1, 3, 2, 4, 5).contiguous().reshape(B, Hp, Wp, -1)

    if pad_h > 0 or pad_w > 0:
        x = x[:, :H, :W, :].contiguous()
    return x


# =============================================================================
#  Relative position bias utilities
# =============================================================================

def get_rel_pos(
    q_size: int,
    k_size: int,
    rel_pos: torch.Tensor,
) -> torch.Tensor:
    """
    Retrieve relative positional embeddings, interpolating if sizes don't match.

    Parameters
    ----------
    q_size  : int              query spatial size
    k_size  : int              key spatial size
    rel_pos : FloatTensor [2*max(q,k)_orig - 1, head_dim]
              relative position embedding table (from checkpoint)

    Returns
    -------
    FloatTensor [q_size, k_size, head_dim]
    """
    max_rel_dist = 2 * max(q_size, k_size) - 1
    # Interpolate if the stored table size doesn't match the required size
    if rel_pos.shape[0] != max_rel_dist:
        # rel_pos: [orig_size, head_dim]
        # Treat as [1, head_dim, orig_size] and interpolate to [1, head_dim, max_rel_dist]
        rel_pos_interp = F.interpolate(
            rel_pos.T.unsqueeze(0).float(),        # [1, head_dim, orig_size]
            size=max_rel_dist,
            mode="linear",
            align_corners=False,
        ).squeeze(0).T.to(rel_pos.dtype)           # [max_rel_dist, head_dim]
        rel_pos = rel_pos_interp

    q_coords = torch.arange(q_size, device=rel_pos.device).unsqueeze(1)   # [q, 1]
    k_coords = torch.arange(k_size, device=rel_pos.device).unsqueeze(0)   # [1, k]
    # Relative offsets mapped to [0, max_rel_dist - 1]
    relative_coords = (q_coords - k_coords) + (k_size - 1)                # [q, k]
    return rel_pos[relative_coords.clamp(0, rel_pos.shape[0] - 1).long()]  # [q, k, head_dim]


def add_decomposed_rel_pos(
    attn: torch.Tensor,
    q: torch.Tensor,
    rel_pos_h: torch.Tensor,
    rel_pos_w: torch.Tensor,
    q_size: Tuple[int, int],
    k_size: Tuple[int, int],
) -> torch.Tensor:
    """
    Add decomposed (H + W independent) relative position biases to attention scores.

    Parameters
    ----------
    attn      : [B, num_heads, q_h*q_w, k_h*k_w]  attention logits
    q         : [B, num_heads, q_h*q_w, head_dim]  query tensor
    rel_pos_h : [table_h, head_dim]
    rel_pos_w : [table_w, head_dim]
    q_size    : (q_h, q_w)
    k_size    : (k_h, k_w)

    Returns
    -------
    attn : [B, num_heads, q_h*q_w, k_h*k_w]  with rel-pos biases added
    """
    q_h, q_w = q_size
    k_h, k_w = k_size

    Rh = get_rel_pos(q_h, k_h, rel_pos_h)   # [q_h, k_h, head_dim]
    Rw = get_rel_pos(q_w, k_w, rel_pos_w)   # [q_w, k_w, head_dim]

    B, num_heads, _, dim = q.shape
    r_q = q.reshape(B, num_heads, q_h, q_w, dim)

    # Height-relative bias: [B, num_heads, q_h, q_w, k_h]
    rel_h = torch.einsum("bnhwd,hkd->bnhwk", r_q, Rh)
    # Width-relative bias: [B, num_heads, q_h, q_w, k_w]
    rel_w = torch.einsum("bnhwd,wkd->bnhwk", r_q, Rw)

    attn = attn.reshape(B, num_heads, q_h, q_w, k_h, k_w)
    attn = attn + rel_h[:, :, :, :, :, None] + rel_w[:, :, :, :, None, :]
    return attn.reshape(B, num_heads, q_h * q_w, k_h * k_w)


# =============================================================================
#  SAM building blocks
# =============================================================================

class SAMAttention(nn.Module):
    """
    Multi-head self-attention for SAM ViT-H.
    Supports both windowed (local) and global attention.
    Adds decomposed relative position biases to attention scores.

    Weight keys (checkpoint prefix stripped):
      blocks.{i}.attn.qkv.weight / .bias
      blocks.{i}.attn.proj.weight / .bias
      blocks.{i}.attn.rel_pos_h    [2*input_size[0]-1, head_dim]
      blocks.{i}.attn.rel_pos_w    [2*input_size[1]-1, head_dim]
    """

    def __init__(
        self,
        dim: int,
        num_heads: int = 16,
        qkv_bias: bool = True,
        use_rel_pos: bool = True,
        input_size: Optional[Tuple[int, int]] = None,
    ):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim  = dim // num_heads
        self.scale     = self.head_dim ** -0.5

        self.qkv  = nn.Linear(dim, dim * 3, bias=qkv_bias)
        self.proj = nn.Linear(dim, dim)

        self.use_rel_pos = use_rel_pos
        if use_rel_pos:
            assert input_size is not None, "input_size required when use_rel_pos=True"
            # Relative position tables — sizes set for our target resolution
            self.rel_pos_h = nn.Parameter(
                torch.zeros(2 * input_size[0] - 1, self.head_dim)
            )
            self.rel_pos_w = nn.Parameter(
                torch.zeros(2 * input_size[1] - 1, self.head_dim)
            )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x : [B, H, W, D]"""
        B, H, W, _ = x.shape

        # QKV projection
        qkv = (
            self.qkv(x)
            .reshape(B, H * W, 3, self.num_heads, self.head_dim)
            .permute(2, 0, 3, 1, 4)   # [3, B, num_heads, H*W, head_dim]
        )
        q, k, v = qkv.unbind(0)       # each [B, num_heads, H*W, head_dim]

        # Scaled dot-product attention logits
        attn = (q * self.scale) @ k.transpose(-2, -1)   # [B, num_heads, H*W, H*W]

        # Add decomposed relative position biases
        if self.use_rel_pos:
            attn = add_decomposed_rel_pos(
                attn, q, self.rel_pos_h, self.rel_pos_w, (H, W), (H, W)
            )

        attn = attn.softmax(dim=-1)
        x = (attn @ v).reshape(B, self.num_heads, H, W, self.head_dim)
        x = x.permute(0, 2, 3, 1, 4).reshape(B, H, W, -1)
        x = self.proj(x)
        return x


class SAMMLP(nn.Module):
    """
    Feed-forward network in SAM transformer blocks.
    Weight keys: blocks.{i}.mlp.lin1.* / blocks.{i}.mlp.lin2.*
    """

    def __init__(self, in_features: int, hidden_features: int):
        super().__init__()
        self.lin1 = nn.Linear(in_features, hidden_features)
        self.act  = nn.GELU()
        self.lin2 = nn.Linear(hidden_features, in_features)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.lin2(self.act(self.lin1(x)))


class SAMBlock(nn.Module):
    """
    SAM transformer block.

    If window_size > 0: partition tokens into local windows before attention,
                        unpartition afterward (windowed self-attention).
    If window_size == 0: standard global self-attention over all tokens.

    Weight keys:
      blocks.{i}.norm1.weight / .bias
      blocks.{i}.attn.*
      blocks.{i}.norm2.weight / .bias
      blocks.{i}.mlp.*
    """

    def __init__(
        self,
        dim: int,
        num_heads: int,
        mlp_ratio: float = 4.0,
        use_rel_pos: bool = True,
        window_size: int = 0,
        input_size: Optional[Tuple[int, int]] = None,
    ):
        super().__init__()
        self.norm1 = nn.LayerNorm(dim)
        self.attn  = SAMAttention(
            dim         = dim,
            num_heads   = num_heads,
            use_rel_pos = use_rel_pos,
            # For windowed attn: rel_pos is over (window_size, window_size)
            # For global attn:   rel_pos is over (img_h, img_w)
            input_size  = (window_size, window_size) if window_size > 0 else input_size,
        )
        self.norm2  = nn.LayerNorm(dim)
        self.mlp    = SAMMLP(dim, int(dim * mlp_ratio))
        self.window_size = window_size

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x : [B, H, W, D]"""
        shortcut = x
        x = self.norm1(x)

        H, W = x.shape[1], x.shape[2]

        # Windowed attention: partition → attend → unpartition
        if self.window_size > 0:
            x, pad_hw = window_partition(x, self.window_size)  # [B*nW, ws, ws, D]

        x = self.attn(x)

        if self.window_size > 0:
            x = window_unpartition(x, self.window_size, pad_hw, (H, W))

        x = shortcut + x
        x = x + self.mlp(self.norm2(x))
        return x


class SAMPatchEmbed(nn.Module):
    """
    Patch embedding: Conv2d, output permuted to [B, H', W', D].
    Weight key: patch_embed.proj.weight / .bias
    """

    def __init__(
        self,
        in_chans:   int = 3,
        embed_dim:  int = 1280,
        kernel_size: int = 16,
        stride:     int = 16,
    ):
        super().__init__()
        self.proj = nn.Conv2d(in_chans, embed_dim, kernel_size=kernel_size, stride=stride)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.proj(x)             # [B, D, H//16, W//16]
        x = x.permute(0, 2, 3, 1)   # [B, H//16, W//16, D]
        return x


# =============================================================================
#  SAM Image Encoder (ViT-H)
# =============================================================================

class SAMImageEncoder(nn.Module):
    """
    SAM ViT-H image encoder, adapted for DR-MVP v2.

    Fixed configuration for SAM ViT-H (sam_vit_h_4b8939.pth):
      - 32 transformer blocks
      - 1280-dimensional embeddings
      - 16 attention heads
      - Window attention (14×14) in 28 blocks
      - Global attention in blocks 7, 15, 23, 31
      - 2D absolute positional embedding

    Always runs under torch.no_grad().
    After load_sam_weights(), all parameters have requires_grad = False.

    forward() returns:
      patch_tokens_final  : [B, N, D]  N=6400, D=1280  (final block output)
      patch_tokens_block16: [B, N, D]  N=6400, D=1280  (block 16 output, for skip)

    The SAM 'neck' (post-transformer conv layers) is bypassed entirely.
    """

    # SAM ViT-H fixed hyperparameters
    SAM_DEPTH         : int   = 32
    SAM_EMBED_DIM     : int   = 1280
    SAM_NUM_HEADS     : int   = 16
    SAM_MLP_RATIO     : float = 4.0
    SAM_WINDOW_SIZE   : int   = 14
    SAM_PATCH_SIZE    : int   = 16

    def __init__(self, img_size: int = 1280):
        super().__init__()
        self.img_size   = img_size
        self.patch_size = self.SAM_PATCH_SIZE
        self.embed_dim  = self.SAM_EMBED_DIM
        self.img_h = self.img_w = img_size // self.patch_size   # 80 at 1280px

        # ── Patch embedding ─────────────────────────────────────────────────
        self.patch_embed = SAMPatchEmbed(
            in_chans   = 3,
            embed_dim  = self.embed_dim,
            kernel_size = self.patch_size,
            stride      = self.patch_size,
        )

        # ── 2D absolute positional embedding ────────────────────────────────
        # Shape [1, img_h, img_w, D] — will be interpolated from [1,64,64,1280]
        # during weight loading
        self.pos_embed = nn.Parameter(
            torch.zeros(1, self.img_h, self.img_w, self.embed_dim)
        )

        # ── Transformer blocks ───────────────────────────────────────────────
        self.blocks = nn.ModuleList()
        for i in range(self.SAM_DEPTH):
            is_global   = (i in GLOBAL_ATTN_INDICES)
            window_size = 0 if is_global else self.SAM_WINDOW_SIZE
            # For global attention, rel_pos is sized over the full image grid
            input_size  = (self.img_h, self.img_w) if is_global else None

            block = SAMBlock(
                dim         = self.embed_dim,
                num_heads   = self.SAM_NUM_HEADS,
                mlp_ratio   = self.SAM_MLP_RATIO,
                use_rel_pos = True,
                window_size = window_size,
                input_size  = input_size,
            )
            self.blocks.append(block)

        # ── Neck (declared for structural completeness but not used in forward)
        # Weights present in checkpoint — declared as a dummy so load_state_dict
        # with strict=False doesn't complain about missing keys on our side.
        # We simply DON'T call neck in forward().

        # Internal capture slots for skip connections
        self._block8_feat: Optional[torch.Tensor] = None
        self._block16_feat: Optional[torch.Tensor] = None

        # LoRA state — set by apply_sam_lora() after weight loading
        self._has_lora = False
        self._lora_start_block = 32  # no split by default

    # ------------------------------------------------------------------
    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Parameters
        ----------
        x : FloatTensor [B, 3, H, W]  (H = W = 1280)

        Returns
        -------
        patch_tokens_final   : FloatTensor [B, 6400, 1280]  (final block output)
        patch_tokens_block16 : FloatTensor [B, 6400, 1280]  (block 16 skip)
        patch_tokens_block8  : FloatTensor [B, 6400, 1280]  (block 8 skip)

        Blocks 0 to lora_start_block-1: under torch.no_grad() (frozen).
        Blocks lora_start_block to 31: with grad enabled (LoRA trainable).
        If no LoRA applied, all blocks run under no_grad (original behavior).
        """
        lsb = self._lora_start_block  # 28 with LoRA, 32 without

        # ── Frozen blocks (0 to lsb-1) under no_grad ─────────────────────
        with torch.no_grad():
            x = self.patch_embed(x)    # [B, 80, 80, 1280]
            x = x + self.pos_embed     # [B, 80, 80, 1280]

            self._block8_feat = None
            self._block16_feat = None

            end = min(lsb, len(self.blocks))
            for i in range(end):
                x = self.blocks[i](x)
                if i == 8:
                    self._block8_feat = x
                elif i == 16:
                    self._block16_feat = x

        # ── LoRA blocks (lsb to 31) — gradient enabled for LoRA params ───
        if lsb < len(self.blocks):
            for i in range(lsb, len(self.blocks)):
                x = self.blocks[i](x)

        # ── Reshape outputs ───────────────────────────────────────────────
        B = x.shape[0]
        N = self.img_h * self.img_w   # 6400

        patch_tokens_final = x.reshape(B, N, self.embed_dim)

        assert self._block16_feat is not None, "Block 16 feature not captured"
        patch_tokens_block16 = self._block16_feat.reshape(B, N, self.embed_dim)

        assert self._block8_feat is not None, "Block 8 feature not captured"
        patch_tokens_block8 = self._block8_feat.reshape(B, N, self.embed_dim)

        return patch_tokens_final, patch_tokens_block16, patch_tokens_block8


# =============================================================================
#  Weight loading
# =============================================================================

def load_sam_weights(sam_encoder: SAMImageEncoder, checkpoint_path: str) -> None:
    """
    Load SAM ViT-H weights from the official checkpoint into SAMImageEncoder.

    Steps performed:
      1. Load checkpoint, filter keys with 'image_encoder.' prefix
      2. Interpolate abs pos_embed: [1, 64, 64, 1280] → [1, 80, 80, 1280]
      3. Interpolate global-attn rel_pos_h/w: [127, 80] → [159, 80]
      4. Load with strict=False (neck keys will appear as unexpected — that's OK)
      5. Freeze ALL parameters: requires_grad = False

    Parameters
    ----------
    sam_encoder     : SAMImageEncoder instance (on CPU or any device)
    checkpoint_path : path to sam_vit_h_4b8939.pth
    """
    print(f"  [SAM] Loading weights from: {checkpoint_path}")
    ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=False)

    # ── Extract image_encoder keys ──────────────────────────────────────────
    prefix = "image_encoder."
    sd: dict = {
        k[len(prefix):]: v
        for k, v in ckpt.items()
        if k.startswith(prefix)
    }
    if not sd:
        raise ValueError(
            f"No 'image_encoder.*' keys found in checkpoint '{checkpoint_path}'. "
            "Verify this is the SAM ViT-H checkpoint (sam_vit_h_4b8939.pth)."
        )

    # ── Interpolate absolute pos_embed: [1, 64, 64, 1280] → [1, 80, 80, 1280] ─
    if "pos_embed" in sd:
        pe = sd["pos_embed"]                   # [1, H_src, W_src, D]
        H_src, W_src = pe.shape[1], pe.shape[2]
        H_dst = W_dst = sam_encoder.img_size // sam_encoder.patch_size  # 80

        if H_src != H_dst or W_src != W_dst:
            print(f"  [SAM] Interpolating pos_embed: {H_src}×{W_src} → {H_dst}×{W_dst}")
            pe = (
                pe.permute(0, 3, 1, 2).float()   # [1, D, H_src, W_src]
            )
            pe = F.interpolate(pe, size=(H_dst, W_dst), mode="bicubic", align_corners=False)
            pe = pe.permute(0, 2, 3, 1)           # [1, H_dst, W_dst, D]
            sd["pos_embed"] = pe

    # ── Interpolate global-attn rel_pos embeddings: [127, 80] → [159, 80] ────
    # At 64×64 grid (training): global rel_pos size = 2*64-1 = 127
    # At 80×80 grid (ours):     global rel_pos size = 2*80-1 = 159
    target_rel_size = 2 * (sam_encoder.img_size // sam_encoder.patch_size) - 1  # 159

    for i in GLOBAL_ATTN_INDICES:
        for dim_name in ("h", "w"):
            key = f"blocks.{i}.attn.rel_pos_{dim_name}"
            if key in sd:
                rp = sd[key]                   # [src_len, head_dim]
                if rp.shape[0] != target_rel_size:
                    rp_interp = F.interpolate(
                        rp.T.unsqueeze(0).float(),   # [1, head_dim, src_len]
                        size=target_rel_size,
                        mode="linear",
                        align_corners=False,
                    ).squeeze(0).T                   # [target_rel_size, head_dim]
                    sd[key] = rp_interp
                    print(
                        f"  [SAM] Interpolated block {i} rel_pos_{dim_name}: "
                        f"{rp.shape[0]} → {target_rel_size}"
                    )

    # ── Load into model ──────────────────────────────────────────────────────
    # strict=False: neck keys (e.g. 'neck.0.weight') are in sd but not in model
    # — they appear as unexpected, which is expected and harmless.
    missing, unexpected = sam_encoder.load_state_dict(sd, strict=False)

    # Report any surprising missing keys (neck keys expected to be missing)
    real_missing = [k for k in missing if not k.startswith("neck")]
    if real_missing:
        print(
            f"  [SAM] ⚠ Unexpected missing keys ({len(real_missing)}): "
            f"{real_missing[:5]}"
            f"{'...' if len(real_missing) > 5 else ''}"
        )
    else:
        total_loaded = len(sd) - len(unexpected)
        print(f"  [SAM] Loaded {total_loaded} parameter tensors (OK)")
        print(f"  [SAM] Skipped {len(unexpected)} neck keys (expected)")

    # ── Freeze ALL parameters ────────────────────────────────────────────────
    n_frozen = 0
    for p in sam_encoder.parameters():
        p.requires_grad_(False)
        n_frozen += 1
    print(f"  [SAM] Froze {n_frozen} parameter tensors (requires_grad=False)")


# =============================================================================
#  LoRA (Low-Rank Adaptation) for SAM attention layers
# =============================================================================

class LoRALinear(nn.Module):
    """
    Low-Rank Adaptation wrapper for nn.Linear.

    output = base_linear(x) + (x @ lora_A) @ lora_B

    lora_B is initialized to zeros so the initial output equals the base model.
    Only lora_A and lora_B are trainable; base weights stay frozen.
    """

    def __init__(self, base_linear: nn.Linear, rank: int = 8):
        super().__init__()
        self.base = base_linear
        d_in  = base_linear.in_features
        d_out = base_linear.out_features
        self.lora_A = nn.Parameter(torch.zeros(d_in, rank))
        self.lora_B = nn.Parameter(torch.zeros(rank, d_out))
        nn.init.kaiming_uniform_(self.lora_A, a=math.sqrt(5))
        # lora_B = zeros → LoRA output starts at zero → no disruption at init

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.base(x) + (x @ self.lora_A) @ self.lora_B


def apply_sam_lora(
    sam_encoder: SAMImageEncoder,
    rank: int = 8,
    block_indices: tuple = (28, 29, 30, 31),
) -> None:
    """
    Apply LoRA to SAM attention QKV projections in specified blocks.

    Call AFTER load_sam_weights() (base weights loaded and frozen).
    LoRA params are created with requires_grad=True — the optimizer
    picks them up automatically via the 'remaining params' sweep.

    Parameters
    ----------
    sam_encoder   : SAMImageEncoder with frozen weights
    rank          : LoRA bottleneck rank (8 = ~40K params per layer)
    block_indices : which blocks to wrap (default: last 4)
    """
    for idx in block_indices:
        block = sam_encoder.blocks[idx]
        old_qkv = block.attn.qkv
        block.attn.qkv = LoRALinear(old_qkv, rank=rank)

    # Set the split point for forward() no_grad logic
    sam_encoder._has_lora = True
    sam_encoder._lora_start_block = min(block_indices)

    n_lora = sum(p.numel() for p in sam_encoder.parameters() if p.requires_grad)
    print(f"  [SAM-LoRA] Applied LoRA (rank={rank}) to blocks {list(block_indices)}")
    print(f"  [SAM-LoRA] Trainable LoRA params: {n_lora:,}")
