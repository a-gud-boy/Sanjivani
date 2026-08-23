from typing import Optional
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables or .env file.
    Provides separated configuration sections for Text LLM and Vision VLM.
    """
    PROJECT_NAME: str = "Sanjivani Clinical Intake Assistant"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

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
        default="openai/gpt-oss-120b",
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
        if not (self.TEXT_LLM_API_KEY or self.OPENAI_API_KEY):
            raise ValueError(
                "A valid API key must be provided via TEXT_LLM_API_KEY or OPENAI_API_KEY."
            )
        return self

    @property
    def effective_text_api_key(self) -> str:
        return self.TEXT_LLM_API_KEY or self.OPENAI_API_KEY or ""

    @property
    def effective_text_model_name(self) -> str:
        return self.TEXT_LLM_MODEL_NAME or self.OPENAI_MODEL_NAME or "openai/gpt-oss-120b"

    @property
    def effective_text_base_url(self) -> Optional[str]:
        return self.TEXT_LLM_BASE_URL or self.OPENAI_BASE_URL

    @property
    def effective_vision_api_key(self) -> str:
        return (
            self.VISION_LLM_API_KEY
            or self.TEXT_LLM_API_KEY
            or self.OPENAI_API_KEY
            or ""
        )

    @property
    def effective_vision_model_name(self) -> str:
        return (
            self.VISION_LLM_MODEL_NAME
            or self.OPENAI_VISION_MODEL_NAME
            or "qwen/qwen3.6-27b"
        )

    @property
    def effective_vision_base_url(self) -> Optional[str]:
        return (
            self.VISION_LLM_BASE_URL
            or self.TEXT_LLM_BASE_URL
            or self.OPENAI_BASE_URL
        )


settings = Settings()
