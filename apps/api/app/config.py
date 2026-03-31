from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]
MAX_PRODUCTION_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="VISARA_",
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="Visara API")
    environment: str = Field(default="development")
    debug: bool = Field(default=False)
    api_prefix: str = Field(default="/api/v1")
    cors_allowed_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"],
        validation_alias=AliasChoices("VISARA_CORS_ALLOWED_ORIGINS", "CORS_ALLOWED_ORIGINS"),
    )
    database_url: str = Field(validation_alias=AliasChoices("VISARA_DATABASE_URL", "DATABASE_URL"))
    secret_key: str = Field(validation_alias=AliasChoices("VISARA_SECRET_KEY", "VISARA_JWT_SECRET", "SECRET_KEY"))
    jwt_algorithm: str = Field(default="HS256", validation_alias=AliasChoices("VISARA_JWT_ALGORITHM", "JWT_ALGORITHM"))
    access_token_expire_minutes: int = Field(
        default=480,
        validation_alias=AliasChoices("VISARA_ACCESS_TOKEN_EXPIRE_MINUTES", "ACCESS_TOKEN_EXPIRE_MINUTES"),
    )
    storage_type: Literal["local", "s3"] = Field(
        default="local",
        validation_alias=AliasChoices("VISARA_STORAGE_TYPE", "STORAGE_TYPE"),
    )
    storage_root: Path | None = Field(
        default=None,
        validation_alias=AliasChoices("VISARA_STORAGE_ROOT", "VISARA_STORAGE_PATH", "STORAGE_PATH"),
    )
    storage_bucket: str | None = Field(
        default=None,
        validation_alias=AliasChoices("VISARA_STORAGE_BUCKET", "STORAGE_BUCKET"),
    )
    storage_endpoint_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("VISARA_STORAGE_ENDPOINT_URL", "STORAGE_ENDPOINT_URL"),
    )
    storage_access_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("VISARA_STORAGE_ACCESS_KEY", "STORAGE_ACCESS_KEY"),
    )
    storage_secret_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("VISARA_STORAGE_SECRET_KEY", "STORAGE_SECRET_KEY"),
    )
    storage_region: str = Field(
        default="us-east-1",
        validation_alias=AliasChoices("VISARA_STORAGE_REGION", "STORAGE_REGION"),
    )
    storage_secure: bool = Field(
        default=False,
        validation_alias=AliasChoices("VISARA_STORAGE_SECURE", "STORAGE_SECURE"),
    )
    model_version: str = Field(default="visara-v3")
    model_status: str = Field(default="operational")
    model_checkpoint_path: Path | None = Field(
        default=None,
        validation_alias=AliasChoices("VISARA_MODEL_CHECKPOINT_PATH", "MODEL_CHECKPOINT_PATH"),
    )
    model_factory_path: str = Field(default="app.services.inference.reference_model:ReferenceDualDRModel")
    gpu_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices("VISARA_GPU_ENABLED", "GPU_ENABLED"),
    )
    max_upload_size_bytes: int = Field(default=MAX_PRODUCTION_UPLOAD_SIZE_BYTES)
    case_submission_rate_limit: int = Field(
        default=10,
        validation_alias=AliasChoices("VISARA_CASE_SUBMISSION_RATE_LIMIT", "CASE_SUBMISSION_RATE_LIMIT"),
    )
    case_submission_rate_window_seconds: int = Field(
        default=600,
        validation_alias=AliasChoices("VISARA_CASE_SUBMISSION_RATE_WINDOW_SECONDS", "CASE_SUBMISSION_RATE_WINDOW_SECONDS"),
    )
    demo_doctor_email: str
    demo_doctor_password: str
    demo_doctor_name: str
    demo_technician_email: str
    demo_technician_password: str
    demo_technician_name: str
    demo_admin_email: str
    demo_admin_password: str
    demo_admin_name: str

    @property
    def jwt_secret(self) -> str:
        return self.secret_key

    @field_validator("model_checkpoint_path", mode="before")
    @classmethod
    def normalize_empty_checkpoint_path(cls, value: object) -> object:
        if value in {None, ""}:
            return None
        return value

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def normalize_cors_allowed_origins(cls, value: object) -> object:
        if value is None:
            return ["http://localhost:3000", "http://127.0.0.1:3000"]
        if isinstance(value, str) and value == "":
            return ["http://localhost:3000", "http://127.0.0.1:3000"]
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @model_validator(mode="after")
    def validate_runtime_requirements(self) -> "Settings":
        if self.max_upload_size_bytes > MAX_PRODUCTION_UPLOAD_SIZE_BYTES:
            raise ValueError("VISARA_MAX_UPLOAD_SIZE_BYTES cannot exceed 20MB.")

        if self.storage_type == "local" and self.storage_root is None:
            raise ValueError("STORAGE_PATH is required when STORAGE_TYPE=local.")

        if self.storage_type == "s3":
            missing = [
                name
                for name, value in {
                    "STORAGE_BUCKET": self.storage_bucket,
                    "STORAGE_ENDPOINT_URL": self.storage_endpoint_url,
                    "STORAGE_ACCESS_KEY": self.storage_access_key,
                    "STORAGE_SECRET_KEY": self.storage_secret_key,
                }.items()
                if not value
            ]
            if missing:
                raise ValueError(f"Missing required S3/MinIO settings: {', '.join(missing)}")

        uses_reference_model = "reference_model" in self.model_factory_path
        if not uses_reference_model and self.model_checkpoint_path is None:
            raise ValueError("MODEL_CHECKPOINT_PATH is required when using the production DualDRModel factory.")

        if self.environment == "production" and self.secret_key == "change-me-for-local-development":
            raise ValueError("SECRET_KEY must be changed before running in production.")

        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
