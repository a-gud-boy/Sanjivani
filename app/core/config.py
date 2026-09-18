from typing import Optional, List, Any, Union
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or .env file.
    Provides first-class configuration for Google Gemini, separated
    Text LLM / Vision VLM, and local/cloud database options.
    """
    PROJECT_NAME: str = "Sanjivani Clinical Intake Assistant"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False
    ENVIRONMENT: str = Field(
        default="development",
        description="Application environment: 'development', 'staging', or 'production'."
    )

    # --- CORS Configuration (SEC-05) ---
    ALLOWED_CORS_ORIGINS: List[str] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
            "https://sanjivani-health.pages.dev",
            "https://a-gud-boy.github.io",
            "https://sanjivani-9ne0.onrender.com",
        ],
        description="Explicit list of allowed CORS origins for API requests."
    )
    CORS_ORIGIN_REGEX: Optional[str] = Field(
        default=r"^https:\/\/([a-zA-Z0-9_-]+\.)?(github\.io|pages\.dev|vercel\.app|onrender\.com)$|^http:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$",
        description="Regex pattern for dynamically matching allowed origins (e.g. Cloudflare Pages, GitHub Pages, Render subdomains, and local dev ports)."
    )
    CORS_ALLOW_CREDENTIALS: bool = Field(
        default=True,
        description="Whether to allow credentials with CORS requests."
    )

    @model_validator(mode="before")
    @classmethod
    def parse_cors_origins(cls, data: Any) -> Any:
        if isinstance(data, dict) and "ALLOWED_CORS_ORIGINS" in data:
            origins = data["ALLOWED_CORS_ORIGINS"]
            if isinstance(origins, str):
                data["ALLOWED_CORS_ORIGINS"] = [o.strip() for o in origins.split(",") if o.strip()]
        return data

    # --- JWT Authentication & Cryptography (SEC-02 / SEC-03) ---
    SECRET_KEY: str = Field(
        default="sanjivani-jwt-secret-key-development-2026-ayush-abdm",
        description="Cryptographic secret key for signing JWT authentication tokens."
    )
    JWT_ALGORITHM: str = Field(
        default="HS256",
        description="Cryptographic signing algorithm for JWT tokens."
    )
    JWT_EXPIRY_MINUTES: int = Field(
        default=60 * 24 * 7,  # 7 days
        description="Access token expiration period in minutes."
    )

    # --- Database Configuration (Local Zero-Cost SQLite or Cloud PostgreSQL) ---
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./sanjivani.db",
        description="Database connection URL for async SQLAlchemy (sqlite+aiosqlite:///... locally, or postgresql+asyncpg://... for cloud)."
    )

    # --- 0. Google Gemini Configuration ---
    GEMINI_API_KEY: Optional[str] = Field(
        default=None,
        description="Google Gemini API key."
    )
    GOOGLE_API_KEY: Optional[str] = Field(
        default=None,
        description="Alias for Google Gemini API key."
    )
    GEMINI_MODEL_NAME: str = Field(
        default="gemma-4-26b-a4b-it",
        description="Default Google Gemini / Gemma model name."
    )
    GEMINI_BASE_URL: str = Field(
        default="https://generativelanguage.googleapis.com/v1beta/openai/",
        description="Official OpenAI-compatible Base URL for Google Gemini API."
    )

    # --- 1. Text / Conversational Chat Intake Configuration ---
    TEXT_LLM_API_KEY: Optional[str] = Field(
        default=None,
        description="API key for text LLM conversational intake."
    )
    TEXT_LLM_MODEL_NAME: Optional[str] = Field(
        default=None,
        description="Model name for text LLM conversational intake."
    )
    TEXT_LLM_BASE_URL: Optional[str] = Field(
        default=None,
        description="Base URL for text LLM API (e.g., https://api.groq.com/openai/v1)."
    )

    # --- 2. Vision / Document Digitization (VLM) Configuration ---
    VISION_LLM_API_KEY: Optional[str] = Field(
        default=None,
        description="API key for multimodal VLM document scanner."
    )
    VISION_LLM_MODEL_NAME: Optional[str] = Field(
        default=None,
        description="Model name for multimodal VLM document scanner."
    )
    VISION_LLM_BASE_URL: Optional[str] = Field(
        default=None,
        description="Base URL for vision VLM API (e.g., https://api.groq.com/openai/v1)."
    )

    # --- 3. Global / Legacy Fallbacks ---
    OPENAI_API_KEY: Optional[str] = Field(
        default=None,
        description="Fallback API key if TEXT_LLM_API_KEY or VISION_LLM_API_KEY is not set."
    )
    OPENAI_MODEL_NAME: Optional[str] = Field(
        default="google/medgemma-1.5-4b-it",
        description="Legacy fallback model name."
    )
    OPENAI_BASE_URL: Optional[str] = Field(
        default=None,
        description="Legacy fallback base URL."
    )
    OPENAI_VISION_MODEL_NAME: Optional[str] = Field(
        default=None,
        description="Legacy fallback vision model name."
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @model_validator(mode="after")
    def validate_api_keys(self) -> "Settings":
        if not (
            self.GEMINI_API_KEY
            or self.GOOGLE_API_KEY
            or self.TEXT_LLM_API_KEY
            or self.OPENAI_API_KEY
        ):
            raise ValueError(
                "A valid API key must be provided via GEMINI_API_KEY, GOOGLE_API_KEY, TEXT_LLM_API_KEY, or OPENAI_API_KEY."
            )
        return self

    @property
    def is_production(self) -> bool:
        return (self.ENVIRONMENT or "").strip().lower() in ("production", "prod")

    @property
    def is_development(self) -> bool:
        return not self.is_production

    @property
    def has_gemini(self) -> bool:
        return bool(
            self.GEMINI_API_KEY
            or self.GOOGLE_API_KEY
            or (self.TEXT_LLM_MODEL_NAME and any(k in self.TEXT_LLM_MODEL_NAME.lower() for k in ("gemini", "gemma")))
        )

    @property
    def effective_gemini_key(self) -> Optional[str]:
        return self.GEMINI_API_KEY or self.GOOGLE_API_KEY

    @property
    def effective_text_api_key(self) -> str:
        if self.effective_gemini_key and (
            not self.TEXT_LLM_API_KEY
            or self.TEXT_LLM_API_KEY == "EMPTY"
            or any(k in (self.TEXT_LLM_MODEL_NAME or "").lower() for k in ("gemini", "gemma"))
        ):
            return self.effective_gemini_key
        if self.TEXT_LLM_API_KEY and self.TEXT_LLM_API_KEY != "EMPTY":
            return self.TEXT_LLM_API_KEY
        if self.effective_gemini_key:
            return self.effective_gemini_key
        return self.OPENAI_API_KEY or ""

    @property
    def effective_text_model_name(self) -> str:
        if self.TEXT_LLM_MODEL_NAME:
            return self.TEXT_LLM_MODEL_NAME
        if self.effective_gemini_key:
            return self.GEMINI_MODEL_NAME
        return self.OPENAI_MODEL_NAME or "gemma-4-26b-a4b-it"

    @property
    def effective_text_base_url(self) -> Optional[str]:
        if (
            self.effective_gemini_key
            or (self.effective_text_model_name and any(k in self.effective_text_model_name.lower() for k in ("gemini", "gemma")))
        ):
            if not self.TEXT_LLM_BASE_URL or "localhost" in self.TEXT_LLM_BASE_URL or "127.0.0.1" in self.TEXT_LLM_BASE_URL:
                return self.GEMINI_BASE_URL
            return self.TEXT_LLM_BASE_URL
        if self.TEXT_LLM_BASE_URL:
            return self.TEXT_LLM_BASE_URL
        return self.OPENAI_BASE_URL

    @property
    def effective_vision_api_key(self) -> str:
        if self.effective_gemini_key and (
            not self.VISION_LLM_API_KEY
            or self.VISION_LLM_API_KEY == "EMPTY"
            or any(k in (self.VISION_LLM_MODEL_NAME or "").lower() for k in ("gemini", "gemma"))
        ):
            return self.effective_gemini_key
        if self.VISION_LLM_API_KEY and self.VISION_LLM_API_KEY != "EMPTY":
            return self.VISION_LLM_API_KEY
        if self.effective_gemini_key:
            return self.effective_gemini_key
        return (
            self.TEXT_LLM_API_KEY
            or self.OPENAI_API_KEY
            or ""
        )

    @property
    def effective_vision_model_name(self) -> str:
        if self.VISION_LLM_MODEL_NAME:
            return self.VISION_LLM_MODEL_NAME
        if self.effective_gemini_key:
            return self.GEMINI_MODEL_NAME
        return (
            self.OPENAI_VISION_MODEL_NAME
            or self.TEXT_LLM_MODEL_NAME
            or self.OPENAI_MODEL_NAME
            or "gemma-4-26b-a4b-it"
        )

    @property
    def effective_vision_base_url(self) -> Optional[str]:
        if (
            self.effective_gemini_key
            or (self.effective_vision_model_name and any(k in self.effective_vision_model_name.lower() for k in ("gemini", "gemma")))
        ):
            if not self.VISION_LLM_BASE_URL or "localhost" in self.VISION_LLM_BASE_URL or "127.0.0.1" in self.VISION_LLM_BASE_URL:
                return self.GEMINI_BASE_URL
            return self.VISION_LLM_BASE_URL
        if self.VISION_LLM_BASE_URL:
            return self.VISION_LLM_BASE_URL
        return (
            self.TEXT_LLM_BASE_URL
            or self.OPENAI_BASE_URL
        )


settings = Settings()
