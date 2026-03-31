from __future__ import annotations

from datetime import UTC, datetime

from httpx import AsyncClient
from sqlalchemy import select

from app.models.audit_log import AuditLogRecord
from app.tests.conftest import create_case, make_png_bytes, wait_for_case_completion


async def test_create_case_and_fetch_result(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    created_case = await create_case(client, auth_headers, patient_ref="PT-2001")
    assert created_case["status"] == "processing"
    assert created_case["result"] is None

    completed_case = await wait_for_case_completion(client, auth_headers, created_case["case_id"])
    assert completed_case["status"] == "complete"
    assert completed_case["image_url"].endswith(f"/api/v1/cases/{created_case['case_id']}/image")
    assert completed_case["result"]["model_version"] == "visara-v3"
    assert len(completed_case["result"]["grade_probabilities"]) == 5
    assert set(completed_case["result"]["overlay_urls"]) == {"ma", "he", "hem", "se", "irma", "nv"}
    assert completed_case["result"]["confidence_explanation"]
    assert completed_case["result"]["clinical_summary"]
    assert set(completed_case["result"]["lesion_presence"]) == {"ma", "he", "hem", "se", "irma", "nv"}
    assert set(completed_case["result"]["lesion_confidence"]) == {"ma", "he", "hem", "se", "irma", "nv"}


async def test_clinical_mock_profiles_cover_required_grade_bands(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    nonreferable_case = await create_case(
        client,
        auth_headers,
        patient_ref="PT-NONREF-001",
        image_bytes=make_png_bytes((40, 180, 60)),
    )
    moderate_case = await create_case(
        client,
        auth_headers,
        patient_ref="PT-MOD-001",
        image_bytes=make_png_bytes((60, 80, 220)),
    )
    urgent_case = await create_case(
        client,
        auth_headers,
        patient_ref="PT-URG-001",
        image_bytes=make_png_bytes((220, 70, 70)),
    )

    nonreferable_complete = await wait_for_case_completion(client, auth_headers, nonreferable_case["case_id"])
    moderate_complete = await wait_for_case_completion(client, auth_headers, moderate_case["case_id"])
    urgent_complete = await wait_for_case_completion(client, auth_headers, urgent_case["case_id"])

    assert nonreferable_complete["result"]["grade"] == 1
    assert nonreferable_complete["result"]["confidence_tier"] == "high"
    assert nonreferable_complete["result"]["referral_required"] is False
    assert nonreferable_complete["result"]["referral_urgency"] == "none"

    assert moderate_complete["result"]["grade"] == 2
    assert moderate_complete["result"]["confidence_tier"] == "moderate"
    assert moderate_complete["result"]["referral_required"] is True
    assert moderate_complete["result"]["referral_urgency"] == "routine"

    assert urgent_complete["result"]["grade"] == 3
    assert urgent_complete["result"]["confidence_tier"] == "high"
    assert urgent_complete["result"]["referral_required"] is True
    assert urgent_complete["result"]["referral_urgency"] == "urgent"


async def test_list_cases_with_filters(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    first_case = await create_case(client, auth_headers, patient_ref="PT-3001")
    second_case = await create_case(client, auth_headers, patient_ref="PT-3002")

    first_complete = await wait_for_case_completion(client, auth_headers, first_case["case_id"])
    await wait_for_case_completion(client, auth_headers, second_case["case_id"])

    grade = first_complete["result"]["grade"]
    referral = first_complete["result"]["referral_urgency"]
    today = datetime.now(UTC).date().isoformat()

    response = await client.get(
        "/api/v1/cases",
        headers=auth_headers,
        params={
            "page": 1,
            "limit": 10,
            "grade_filter": grade,
            "referral_filter": referral,
            "date_from": today,
            "date_to": today,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["pagination"]["total"] >= 1
    assert all(item["result"]["grade"] == grade for item in payload["items"] if item["result"] is not None)
    created_at_values = [item["created_at"] for item in payload["items"]]
    assert created_at_values == sorted(created_at_values, reverse=True)


async def test_overlay_and_report_download(client: AsyncClient, auth_headers: dict[str, str], app) -> None:
    created_case = await create_case(client, auth_headers, patient_ref="PT-4001")
    completed_case = await wait_for_case_completion(client, auth_headers, created_case["case_id"])

    image_response = await client.get(completed_case["image_url"], headers=auth_headers)
    assert image_response.status_code == 200
    assert image_response.headers["content-type"] == "image/png"

    overlay_url = completed_case["result"]["overlay_urls"]["ma"]
    overlay_response = await client.get(overlay_url, headers=auth_headers)
    assert overlay_response.status_code == 200
    assert overlay_response.headers["content-type"] == "image/png"

    report_response = await client.get(f"/api/v1/cases/{created_case['case_id']}/report", headers=auth_headers)
    assert report_response.status_code == 200
    assert report_response.headers["content-type"] == "application/pdf"
    assert report_response.content.startswith(b"%PDF")

    async with app.state.session_maker() as session:
        audit_actions = list(
            await session.scalars(
                select(AuditLogRecord.action)
                .where(AuditLogRecord.case_id == created_case["case_id"])
                .order_by(AuditLogRecord.created_at.asc())
            )
        )

    assert "case.created" in audit_actions
    assert "report.downloaded" in audit_actions


async def test_case_submission_rate_limit_returns_429(client: AsyncClient, auth_headers: dict[str, str], app) -> None:
    limiter = app.state.case_submission_rate_limiter
    original_limit = limiter.limit
    limiter.limit = 1
    try:
        first_response = await client.post(
            "/api/v1/cases",
            headers=auth_headers,
            data={"patient_ref": "PT-RATE-001", "eye_side": "left"},
            files={"image": ("fundus.png", make_png_bytes((10, 40, 80)), "image/png")},
        )
        assert first_response.status_code == 201

        second_response = await client.post(
            "/api/v1/cases",
            headers=auth_headers,
            data={"patient_ref": "PT-RATE-002", "eye_side": "left"},
            files={"image": ("fundus.png", make_png_bytes((10, 40, 80)), "image/png")},
        )
        assert second_response.status_code == 429
        assert second_response.json()["code"] == "RATE_LIMITED"
    finally:
        limiter.limit = original_limit


async def test_structured_404_and_422_errors(client: AsyncClient, auth_headers: dict[str, str]) -> None:
    missing_case_response = await client.get("/api/v1/cases/not-a-real-case", headers=auth_headers)
    assert missing_case_response.status_code == 404
    assert set(missing_case_response.json()) == {"code", "message", "detail"}

    invalid_request_response = await client.post(
        "/api/v1/cases",
        headers=auth_headers,
        data={"patient_ref": "", "eye_side": "left"},
        files={"image": ("bad.txt", b"not-an-image", "text/plain")},
    )
    assert invalid_request_response.status_code in {400, 422}
    assert set(invalid_request_response.json()) == {"code", "message", "detail"}
