# AGENTS.md

## Product Overview
This repository is **[visara]** — a premium, clinical decision-support web application for AI-assisted Diabetic Retinopathy (DR) screening. It is built on top of a trained dual-encoder deep learning model (RETFound ViT-L + SAM ViT-H) that produces DR grade, referral recommendations, lesion segmentation maps, and calibrated confidence scores from colour fundus photographs.

This tool is NOT an autonomous diagnostic system. It is decision support for ophthalmologists, retina specialists, and screening technicians. Every design and copy decision must reflect this.

## Researchers
- Shubham Mishra, BITS Pilani (ML/backend lead)
- Saumya Agarwal, BITS Pilani (co-developer)
- Supervised by: Prof. Raj Kumar Gupta & Prof. Pabitra Biswas, BITS Pilani

---

## Model Outputs — Know These Before Writing Any Integration Code

The inference model produces the following outputs per image:

| Output | Shape | Description |
|---|---|---|
| `logits_ord` | [B, 4] | Ordinal head logits → cumulative grade probabilities |
| `logits_ce` | [B, 5] | CE head logits → per-grade softmax probabilities |
| `logits_pres` | [B, 8] | Lesion presence flags (binary per channel) |
| `seg_logits` | [B, 6, 320, 320] | 6-channel pixel-level lesion segmentation |
| `aux_seg_logits` | [B, 6, 320, 320] | Auxiliary segmentation (RETFound path) |
| `ma_refine_logits` | [B, 1, 640, 640] | High-resolution MA refinement map |

**Lesion channel order (seg_logits):**
- Channel 0: Microaneurysms (MA)
- Channel 1: Hard Exudates (HE)
- Channel 2: Haemorrhages (HEM)
- Channel 3: Soft Exudates (SE)
- Channel 4: IRMA
- Channel 5: Neovascularisation (NV)

**Post-processing required:**
- Temperature scaling: divide `logits_ord` by T=0.686 before sigmoid
- Isotonic decoding on ordinal head for grade probabilities
- Sigmoid on presence flags
- Sigmoid on seg_logits, threshold at 0.5 for binary masks

**DR Grades:**
- 0: No DR (Non-referable)
- 1: Mild NPDR (Non-referable)
- 2: Moderate NPDR (REFER)
- 3: Severe NPDR (REFER — Urgent)
- 4: PDR (REFER — Emergency)

**IMPORTANT:** Grades 0 and 1 must be presented as a single merged "Non-referable — Routine Monitoring" category in the UI. Never show G0 vs G1 split to the clinician.

**Checkpoint key structure:**
- Model weights: `state["model"]`
- EMA weights (use these for inference): `state["ema"]["shadow"]`
- SAM encoder keys are absent from EMA shadow (frozen params) — always use `strict=False`
- Checkpoint size: ~7.62GB (Phase 2 with EMA state). For inference-only deployment, load only EMA shadow.

**Input preprocessing:**
- Resize to 1280×1280
- Normalise: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
- Convert to tensor [B, 3, 1280, 1280]
- Run in BF16 (model.to(torch.bfloat16)) on GPU if available

---

## Product Principles
1. **Medical-grade, calm, premium interface** — not clinical sterility, but the trustworthiness of a premium health tool
2. **Explainability first** — every output must be accompanied by a human-readable reason
3. **Honest confidence** — use plain-language tiers (High / Moderate / Low), never raw percentages alone
4. **Decision support only** — disclaimers are not optional decoration. They are clinically required.
5. **Referral clarity** — the referral recommendation is the single most important output. It must be the first thing a user sees on the results page.
6. **Never a black box** — lesion overlays are a core feature, not optional

---

## Technical Standards

**Frontend:**
- Next.js 14+ (App Router)
- TypeScript (strict mode — no `any`)
- Tailwind CSS
- shadcn/ui component library
- Framer Motion for transitions (tasteful, not flashy)
- React Query / TanStack Query for async state
- No placeholder/stub components left in production builds

**Backend:**
- FastAPI + Python 3.11+
- Pydantic v2 for all schemas
- Async endpoints where applicable
- Structured logging (structlog or loguru)
- Environment managed via pydantic-settings
- No secrets in code

**Inference Service:**
- Modular — separate preprocess.py, predict.py, postprocess.py, overlay.py, confidence.py
- Model loaded ONCE at application startup, not per request
- GPU inference with BF16; CPU fallback with FP32
- Thread-safe model serving

**Database:**
- PostgreSQL (via SQLAlchemy async + asyncpg)
- Alembic for migrations
- Sessions table, Cases table, Results table

**PDF Generation:**
- Server-side only (WeasyPrint or ReportLab)
- Professional layout: logo, patient ref, image, findings, lesion overlay, referral, confidence, model version, timestamp, disclaimer

**Storage:**
- Images stored by case UUID, not patient name (privacy)
- Never log or persist raw image data beyond the session unless explicitly consented
- S3-compatible interface (local MinIO for dev, real S3/GCS for prod)

**Auth:**
- JWT-based session auth
- Role: Technician (upload + view own cases), Doctor (view all cases + override grade), Admin (user management + audit)

---

## Folder Structure
```
[visara]/
  AGENTS.md
  README.md
  docker-compose.yml
  .env.example
  
  apps/
    web/                         # Next.js frontend
      app/
        (auth)/
          login/
        (dashboard)/
          layout.tsx
          page.tsx               # Home / recent cases
          upload/
            page.tsx             # New case upload
          cases/
            [caseId]/
              page.tsx           # Results dashboard
              report/
                page.tsx         # PDF report view
          history/
            page.tsx             # All cases
          model/
            page.tsx             # About model / disclaimer
          settings/
            page.tsx
      components/
        ui/                      # shadcn/ui base
        clinical/                # Domain-specific: grade badge, referral card, overlay viewer
        layout/                  # Sidebar, header, breadcrumbs
        upload/                  # Dropzone, progress, preview
        results/                 # Grade display, confidence, lesion explorer
        report/                  # Report preview layout
      lib/
        api.ts                   # Typed API client
        types.ts                 # Shared types
        constants.ts             # Grade labels, lesion names, colour maps
        utils.ts
      hooks/
        use-case.ts
        use-inference.ts
        use-report.ts
    
    api/                         # FastAPI backend
      app/
        main.py
        config.py
        database.py
        routes/
          auth.py
          cases.py
          inference.py
          reports.py
          health.py
        schemas/
          case.py
          inference.py
          report.py
          user.py
        services/
          inference/
            loader.py            # Loads checkpoint once at startup
            preprocess.py        # Image → tensor
            predict.py           # Model forward pass
            postprocess.py       # Logits → grade, confidence, referral
            overlay.py           # seg_logits → coloured PNG overlays per channel
            confidence.py        # Probability → confidence tier
          reporting/
            pdf_generator.py
            templates/
          storage/
            image_store.py
        models/                  # SQLAlchemy models
        core/
          security.py
          logging.py
          exceptions.py
        tests/
  
  model_assets/
    README.md
    checkpoints/                 # Mount externally — never commit
  
  docs/
    product-spec.md
    api-contracts.md
    clinical-notes.md
    deployment.md
```

---

## UX Standards
- All loading states must be meaningful and reassuring — never a blank screen
- Empty states must be warm and instructional, not cold
- Error states must be clear and actionable, never technical
- All text visible on results page must be readable without medical ML training
- Lesion overlays must have a toggle per channel with a clear legend
- Confidence tier language: "High confidence", "Moderate confidence", "Low confidence — consider specialist review"
- Grade language for UI: "No DR detected", "Mild DR", "Moderate DR — Refer", "Severe DR — Refer Urgently", "PDR — Emergency Referral"
- Grade 0 and Grade 1 combined display: "No DR / Mild DR — Routine Monitoring (Non-referable)"

---

## Engineering Style
- Small, focused files. No 500-line God components.
- Strong typing throughout — Pydantic on backend, TypeScript strict on frontend
- API responses always typed — never `any` or untyped JSON
- Comments only where they explain non-obvious clinical logic
- Write maintainable code, not demo code
- Every endpoint must have a corresponding Pydantic response schema
- Use React Query for all async — no useEffect data fetching
- All API errors must return structured error bodies with `code`, `message`, `detail`

---

## Safety and Compliance Language
- Always include: "This tool is a clinical decision-support system. All clinical decisions remain the responsibility of the treating physician."
- This disclaimer must appear on: results page, PDF report, model info page, login page footer
- Never use language like "diagnosed", "confirmed", "detected with certainty"
- Use: "suggests", "indicates", "consistent with", "further evaluation recommended"

---

## Build Order (do not skip phases)
1. Architecture, contracts, and design system
2. Frontend shell — all pages with realistic mock data
3. Backend scaffolding — all endpoints with typed mock responses
4. Real inference integration — modular service abstraction
5. PDF report generation
6. Auth, history, audit trail
7. Tests, Docker, README, deployment config
```