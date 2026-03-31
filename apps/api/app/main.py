from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401
from app.config import get_settings
from app.core.exceptions import install_exception_handlers
from app.core.logging import install_logging
from app.database import build_engine, build_session_maker, dispose_engine, init_database
from app.routes import auth, cases, health, reports
from app.services.bootstrap import seed_default_users
from app.services.inference.loader import load_model_handle
from app.services.inference.service import InferenceService
from app.services.rate_limit import InMemoryRateLimiter
from app.services.reporting.pdf_generator import PDFReportGenerator
from app.services.storage.factory import build_storage_backend


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        engine = build_engine(settings.database_url)
        session_maker = build_session_maker(engine)
        storage = build_storage_backend(settings)
        case_submission_rate_limiter = InMemoryRateLimiter(
            limit=settings.case_submission_rate_limit,
            window_seconds=settings.case_submission_rate_window_seconds,
        )

        await init_database(engine)
        await storage.ensure_directories()
        await seed_default_users(session_maker, settings)

        model_handle = await load_model_handle(settings)
        inference_service = InferenceService(
            settings=settings,
            session_maker=session_maker,
            storage=storage,
            model_handle=model_handle,
        )
        report_generator = PDFReportGenerator(settings=settings, storage=storage)

        app.state.settings = settings
        app.state.engine = engine
        app.state.session_maker = session_maker
        app.state.storage = storage
        app.state.model_handle = model_handle
        app.state.inference_service = inference_service
        app.state.report_generator = report_generator
        app.state.case_submission_rate_limiter = case_submission_rate_limiter

        yield

        await inference_service.wait_for_pending_tasks()
        await dispose_engine(engine)

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        debug=settings.debug,
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_logging(app)
    install_exception_handlers(app)

    api_router = APIRouter(prefix=settings.api_prefix)
    api_router.include_router(auth.router)
    api_router.include_router(cases.router)
    api_router.include_router(reports.router)
    api_router.include_router(health.router)
    app.include_router(api_router)

    @app.get("/")
    async def root() -> JSONResponse:
        return JSONResponse({"name": settings.app_name, "docs": "/docs"})

    return app


app = create_app()
