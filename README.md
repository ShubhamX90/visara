# Visara

Visara is a clinical decision-support platform for diabetic retinopathy screening. It helps screening technicians and ophthalmology teams upload fundus images, run AI-assisted analysis, review lesion overlays, and export a professional PDF report. It is designed to support clinical workflows, not replace clinical judgment.

This tool is a clinical decision-support system. All clinical decisions remain the responsibility of the treating physician.

## Quick Start

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Update `.env` for your environment:

- For local development, keep `VISARA_STORAGE_TYPE=local` and a local SQLite or PostgreSQL URL.
- For Docker Compose, the bundled stack uses PostgreSQL and MinIO automatically.
- If you are not using the reference model, point `VISARA_MODEL_CHECKPOINT_PATH` to the real checkpoint.

3. Start the full stack:

```bash
docker-compose up --build
```

4. Open the apps:

- Web UI: `http://localhost:3000`
- API: `http://localhost:8000`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Model Checkpoint Setup

The production inference path expects the DualDRModel checkpoint and factory path to be configured through environment variables.

- `VISARA_MODEL_FACTORY_PATH=app.services.inference.model.model:DualDRModel`
- `VISARA_MODEL_CHECKPOINT_PATH=/nfs_home/users/vsshekhawat/projects/dr-mvp-v3/checkpoints/phase2/best_qwk.pt`

For local development and tests, you can keep the reference model factory and leave the checkpoint empty:

- `VISARA_MODEL_FACTORY_PATH=app.services.inference.reference_model:ReferenceDualDRModel`
- `VISARA_MODEL_CHECKPOINT_PATH=`

## Environment Variables

Core runtime:

- `VISARA_DATABASE_URL`: database connection string
- `VISARA_SECRET_KEY`: JWT signing key
- `VISARA_STORAGE_TYPE`: `local` or `s3`
- `VISARA_STORAGE_PATH`: filesystem storage root for local storage
- `VISARA_STORAGE_BUCKET`: bucket name for S3 / MinIO storage
- `VISARA_GPU_ENABLED`: `true` when the deployment should expect GPU inference
- `VISARA_MODEL_CHECKPOINT_PATH`: checkpoint path for the production model

Storage:

- `VISARA_STORAGE_ENDPOINT_URL`: S3 / MinIO endpoint
- `VISARA_STORAGE_ACCESS_KEY`: S3 / MinIO access key
- `VISARA_STORAGE_SECRET_KEY`: S3 / MinIO secret key
- `VISARA_STORAGE_REGION`: storage region
- `VISARA_STORAGE_SECURE`: `true` for HTTPS-backed object storage

Security and limits:

- `VISARA_ACCESS_TOKEN_EXPIRE_MINUTES`: JWT session lifetime, default `480`
- `VISARA_CASE_SUBMISSION_RATE_LIMIT`: allowed case submissions per window
- `VISARA_CASE_SUBMISSION_RATE_WINDOW_SECONDS`: rate-limit window length

Clinical metadata:

- `VISARA_MODEL_VERSION`
- `VISARA_MODEL_STATUS`
- `VISARA_DEMO_DOCTOR_*`
- `VISARA_DEMO_TECHNICIAN_*`
- `VISARA_DEMO_ADMIN_*`

## Architecture

```text
                +----------------------+
                |   Next.js Web App    |
                |  upload / review UI  |
                +----------+-----------+
                           |
                           v
                +----------------------+
                |    FastAPI Backend   |
                | auth, cases, report  |
                +----+-----------+-----+
                     |           |
          +----------+           +-------------------+
          v                                          v
+----------------------+                 +----------------------+
| PostgreSQL           |                 | Storage Backend      |
| users, sessions,     |                 | local FS or MinIO    |
| cases, results,      |                 | images + overlays    |
| audit logs           |                 +----------------------+
+----------------------+
                     |
                     v
           +----------------------+
           | Inference Service    |
           | preprocess -> model  |
           | -> postprocess       |
           +----------------------+
```

## Performance Benchmarks

- Validation performance: `QWK 0.853`
- Referral AUC: `0.926`
- Benchmark framing: `FGADR`
- Typical UI processing window: roughly `10-15 seconds` in the current product flow

These values are presented to support research evaluation and deployment planning. They are not a guarantee of performance on every clinical dataset or capture device.

## Limitations

- The model should be used only with clinically interpretable color fundus images.
- Low-quality or unusual images can reduce confidence and lesion visibility.
- Local macOS development uses a ReportLab fallback for PDF rendering when native WeasyPrint libraries are unavailable.
- MinIO is included for local production-like testing, but managed object storage should be used for real deployment.
- This software is a clinical decision-support tool for research and screening support, not a standalone diagnostic device.

## Testing

Backend:

```bash
cd apps/api
python3 -m pytest
```

Frontend build checks:

```bash
npm run build
npm run lint
```

Playwright E2E:

```bash
npm run test:e2e
```

## Research Team and Contact

- Shubham Mishra, BITS Pilani
- Saumya Agarwal, BITS Pilani
- Supervision: Prof. Raj Kumar Gupta and Prof. Pabitra Biswas

For research coordination or deployment questions, contact the BITS Pilani project team through the repository maintainers.
