import { expect, test } from "@playwright/test";

const accessToken = "playwright-token";
const caseId = "11111111-2222-3333-4444-555555555555";
const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pSiiYsAAAAASUVORK5CYII=";

function buildCasePayload() {
  return {
    case_id: caseId,
    patient_ref: "PT-E2E-001",
    eye_side: "left",
    notes: "Image captured during screening clinic.",
    status: "complete",
    created_at: "2026-03-31T09:00:00Z",
    image_url: `/api/v1/cases/${caseId}/image`,
    result: {
      grade: 2,
      grade_label: "Moderate NPDR",
      referral_required: true,
      referral_urgency: "routine",
      referral_label: "Ophthalmologist referral recommended",
      confidence_tier: "moderate",
      confidence_score: 0.61,
      confidence_explanation:
        "Moderate confidence — the model suggests Moderate DR findings, though confirmatory clinical review remains appropriate.",
      clinical_summary:
        "The current image features are consistent with Moderate NPDR and highlighted signal in microaneurysms and hard exudates. Moderate confidence — the model suggests Moderate DR findings, though confirmatory clinical review remains appropriate. Clinical interpretation should remain anchored to the original fundus image.",
      grade_probabilities: [0.05, 0.12, 0.56, 0.19, 0.08],
      lesion_presence: { ma: true, he: true, hem: false, se: false, irma: false, nv: false },
      lesion_confidence: { ma: 0.83, he: 0.71, hem: 0.12, se: 0.11, irma: 0.08, nv: 0.05 },
      overlay_urls: {
        ma: `/api/v1/cases/${caseId}/overlays/ma`,
        he: `/api/v1/cases/${caseId}/overlays/he`,
        hem: `/api/v1/cases/${caseId}/overlays/hem`,
        se: `/api/v1/cases/${caseId}/overlays/se`,
        irma: `/api/v1/cases/${caseId}/overlays/irma`,
        nv: `/api/v1/cases/${caseId}/overlays/nv`
      },
      model_version: "visara-v3",
      inference_time_ms: 8420,
      processed_at: "2026-03-31T09:00:08Z"
    }
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((token) => {
    window.localStorage.setItem("visara.access_token", token);
  }, accessToken);

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const { pathname } = url;
    const method = route.request().method();
    const pngBuffer = Buffer.from(pngBase64, "base64");

    if (pathname === "/api/v1/auth/me") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          user_id: "user-1",
          email: "saumya.agarwal@bits-pilani.ac.in",
          full_name: "Dr. Saumya Agarwal",
          role: "doctor",
          institution: "BITS Pilani Research Project"
        })
      });
      return;
    }

    if (pathname === "/api/v1/health") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          status: "operational",
          model_loaded: true,
          model_version: "visara-v3",
          gpu_available: false,
          timestamp: "2026-03-31T09:00:00Z"
        })
      });
      return;
    }

    if (pathname === "/api/v1/cases" && method === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          case_id: caseId,
          patient_ref: "PT-E2E-001",
          eye_side: "left",
          notes: "Image captured during screening clinic.",
          status: "processing",
          created_at: "2026-03-31T09:00:00Z",
          image_url: `/api/v1/cases/${caseId}/image`,
          result: null
        })
      });
      return;
    }

    if (pathname === `/api/v1/cases/${caseId}` && method === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(buildCasePayload())
      });
      return;
    }

    if (pathname === `/api/v1/cases/${caseId}/image` || pathname.includes(`/api/v1/cases/${caseId}/overlays/`)) {
      await route.fulfill({
        contentType: "image/png",
        body: pngBuffer
      });
      return;
    }

    await route.abort();
  });
});

test("upload to results flow renders the referral-first hierarchy", async ({ page }) => {
  await page.goto("/upload");

  await expect(page.getByRole("heading", { name: /Upload a full-quality retinal image/i })).toBeVisible();
  await page.getByLabel("Patient reference number").fill("PT-E2E-001");
  await page.locator('input[type="file"]').setInputFiles({
    name: "fundus.png",
    mimeType: "image/png",
    buffer: Buffer.from(pngBase64, "base64")
  });

  await expect(page.getByRole("button", { name: "Run Analysis" })).toBeEnabled();
  await page.getByRole("button", { name: "Run Analysis" }).click();

  await page.waitForURL(`**/cases/${caseId}`);
  await expect(page.getByRole("heading", { name: "Ophthalmologist referral recommended" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Moderate NPDR" })).toBeVisible();
  await expect(page.getByText("Confidence explanation")).toBeVisible();
  await expect(page.getByText("Per-lesion findings")).toBeVisible();
  await expect(page.getByRole("button", { name: /Download Report/i })).toBeVisible();
});
