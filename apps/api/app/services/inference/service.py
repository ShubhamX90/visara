from __future__ import annotations

import asyncio
from time import perf_counter

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models.case import CaseRecord
from app.models.result import CaseResult
from app.services.inference.loader import ModelHandle
from app.services.inference.overlay import generate_overlays
from app.services.inference.postprocess import postprocess
from app.services.inference.predict import run_inference
from app.services.inference.preprocess import load_source_image_bytes, preprocess_image
from app.services.storage.base import StorageBackend


class InferenceService:
    def __init__(
        self,
        *,
        settings: Settings,
        session_maker: async_sessionmaker[AsyncSession],
        storage: StorageBackend,
        model_handle: ModelHandle,
    ) -> None:
        self.settings = settings
        self.session_maker = session_maker
        self.storage = storage
        self.model_handle = model_handle
        self.logger = structlog.get_logger("visara.inference")
        self._tasks: set[asyncio.Task[None]] = set()

    def schedule_case_inference(self, case_id: str) -> None:
        task = asyncio.create_task(self.run_case_inference(case_id))
        self._tasks.add(task)
        task.add_done_callback(self._finalize_task)

    def _finalize_task(self, task: asyncio.Task[None]) -> None:
        self._tasks.discard(task)
        try:
            task.result()
        except Exception as exc:
            self.logger.exception("inference_task_failed", error=str(exc))

    async def wait_for_pending_tasks(self) -> None:
        if not self._tasks:
            return
        await asyncio.gather(*list(self._tasks), return_exceptions=True)

    async def run_case_inference(self, case_id: str) -> None:
        try:
            if not self.model_handle.model_loaded or self.model_handle.model is None:
                raise RuntimeError("Model is not loaded. Configure VISARA_MODEL_CHECKPOINT_PATH and VISARA_MODEL_FACTORY_PATH.")

            async with self.session_maker() as session:
                case = await session.scalar(
                    select(CaseRecord)
                    .options(selectinload(CaseRecord.result))
                    .where(CaseRecord.id == case_id)
                )
                if case is None:
                    self.logger.warning("case_missing_for_inference", case_id=case_id)
                    return

                image_payload = await self.storage.read_bytes(case.image_storage_path)
                original_image = await asyncio.to_thread(
                    load_source_image_bytes,
                    payload=image_payload,
                    content_type=case.image_content_type,
                    filename=case.image_original_filename,
                )

                started_at = perf_counter()
                tensor = await asyncio.to_thread(
                    preprocess_image,
                    original_image,
                    device=self.model_handle.device,
                )
                outputs = await asyncio.to_thread(
                    run_inference,
                    tensor,
                    self.model_handle.model,
                )
                inference_time_ms = int((perf_counter() - started_at) * 1000)

                overlay_paths = await generate_overlays(
                    seg_logits=outputs["seg_logits"],
                    original_image=original_image,
                    case_id=case.id,
                    storage=self.storage,
                )
                payload = await asyncio.to_thread(
                    postprocess,
                    outputs,
                    model_version=self.model_handle.version,
                    inference_time_ms=inference_time_ms,
                )

                if case.result is None:
                    session.add(
                        CaseResult(
                            case_id=case.id,
                            grade=payload.grade,
                            grade_label=payload.grade_label,
                            referral_required=payload.referral_required,
                            referral_urgency=payload.referral_urgency,
                            referral_label=payload.referral_label,
                            confidence_tier=payload.confidence_tier,
                            confidence_score=payload.confidence_score,
                            confidence_explanation=payload.confidence_explanation,
                            grade_probabilities=payload.grade_probabilities,
                            lesion_presence=payload.lesion_presence,
                            lesion_confidence=payload.lesion_confidence,
                            overlay_paths=overlay_paths,
                            clinical_summary=payload.clinical_summary,
                            model_version=payload.model_version,
                            inference_time_ms=payload.inference_time_ms,
                            processed_at=payload.processed_at,
                        )
                    )
                else:
                    case.result.grade = payload.grade
                    case.result.grade_label = payload.grade_label
                    case.result.referral_required = payload.referral_required
                    case.result.referral_urgency = payload.referral_urgency
                    case.result.referral_label = payload.referral_label
                    case.result.confidence_tier = payload.confidence_tier
                    case.result.confidence_score = payload.confidence_score
                    case.result.confidence_explanation = payload.confidence_explanation
                    case.result.grade_probabilities = payload.grade_probabilities
                    case.result.lesion_presence = payload.lesion_presence
                    case.result.lesion_confidence = payload.lesion_confidence
                    case.result.overlay_paths = overlay_paths
                    case.result.clinical_summary = payload.clinical_summary
                    case.result.model_version = payload.model_version
                    case.result.inference_time_ms = payload.inference_time_ms
                    case.result.processed_at = payload.processed_at

                case.status = "complete"
                case.failure_detail = None
                await session.commit()
                self.logger.info(
                    "inference_completed",
                    case_id=case.id,
                    device=self.model_handle.device,
                    grade=payload.grade,
                    inference_time_ms=payload.inference_time_ms,
                )
        except Exception as exc:
            self.logger.exception("inference_failed", case_id=case_id, error=str(exc))
            await self._mark_case_failed(case_id=case_id, detail=str(exc))

    async def _mark_case_failed(self, *, case_id: str, detail: str) -> None:
        async with self.session_maker() as session:
            case = await session.get(CaseRecord, case_id)
            if case is None:
                return
            case.status = "failed"
            case.failure_detail = detail
            await session.commit()
