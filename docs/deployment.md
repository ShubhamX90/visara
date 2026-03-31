# Deployment Notes

## GPU Server Requirements

Recommended production inference hardware:

- NVIDIA A100 or equivalent
- 40 GB VRAM recommended for the full DualDRModel checkpoint path
- CUDA-compatible PyTorch runtime
- Fast local NVMe storage for checkpoint access
- 8+ vCPU and at least 32 GB system RAM for the API and preprocessing pipeline

The reference model can run on CPU for development and test environments, but the full production checkpoint should be planned around GPU inference.

## ONNX Export for CPU-Only Deployment

If GPU infrastructure is not available, an ONNX export path should be considered for a reduced-throughput deployment strategy.

Suggested approach:

1. Export the inference-only graph with the clinical output heads required by the API.
2. Validate numerical drift for grade, referral, confidence, and lesion outputs.
3. Benchmark CPU latency against the current 10-15 second workflow target.
4. Keep the same postprocessing and overlay generation contracts so the frontend remains unchanged.

CPU-only deployments should be treated as a separate operational profile and re-benchmarked before release.

## Reverse Proxy with Nginx

Example upstream layout:

```nginx
upstream visara_web {
    server web:3000;
}

upstream visara_api {
    server api:8000;
}

server {
    listen 80;
    server_name visara.example.org;

    location /api/ {
        proxy_pass http://visara_api;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
    }

    location / {
        proxy_pass http://visara_web;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
    }
}
```

## SSL Notes

- Terminate TLS at Nginx or a managed load balancer.
- Redirect HTTP traffic to HTTPS.
- Use short certificate renewal windows with automated renewal where possible.
- If object storage is remote, prefer HTTPS-backed endpoints and set `VISARA_STORAGE_SECURE=true`.

## Database Backup Strategy

Use a layered backup approach:

- Daily logical PostgreSQL backups with `pg_dump`
- Frequent WAL archiving or managed point-in-time recovery for production
- Restore drills on a staging database at scheduled intervals
- Separate retention windows for short-term rollback and long-term archival

At minimum, retain:

- 7 daily backups
- 4 weekly backups
- 3 monthly backups

## Operational Notes

- Keep the model checkpoint outside the container image and mount it at deploy time.
- Use MinIO only for local or staging-like environments; production should use managed S3-compatible storage where possible.
- Confirm `VISARA_SECRET_KEY` is rotated away from development defaults before release.
- Monitor API request logs, inference failures, and audit log growth as part of routine maintenance.
