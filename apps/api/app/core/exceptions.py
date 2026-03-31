from http import HTTPStatus

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class VisaraAPIError(Exception):
    def __init__(
        self,
        *,
        code: str,
        message: str,
        detail: str | None = None,
        status_code: int = HTTPStatus.BAD_REQUEST,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail
        self.status_code = status_code


def build_error_payload(code: str, message: str, detail: str | None = None) -> dict[str, str | None]:
    return {"code": code, "message": message, "detail": detail}


def install_exception_handlers(app: FastAPI) -> None:
    logger = structlog.get_logger("visara.errors")

    @app.exception_handler(VisaraAPIError)
    async def handle_visara_error(_: Request, exc: VisaraAPIError) -> JSONResponse:
        logger.warning("visara_api_error", code=exc.code, detail=exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content=build_error_payload(exc.code, exc.message, exc.detail),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        detail = "; ".join(
            f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        )
        logger.warning("request_validation_error", detail=detail)
        return JSONResponse(
            status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
            content=build_error_payload(
                "VALIDATION_ERROR",
                "The request could not be validated.",
                detail,
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else None
        message = detail or HTTPStatus(exc.status_code).phrase
        logger.warning("http_exception", status_code=exc.status_code, detail=detail)
        return JSONResponse(
            status_code=exc.status_code,
            content=build_error_payload("HTTP_ERROR", message, detail),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unexpected_error", error=str(exc))
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=build_error_payload(
                "INTERNAL_SERVER_ERROR",
                "An unexpected error occurred.",
                str(exc),
            ),
        )
