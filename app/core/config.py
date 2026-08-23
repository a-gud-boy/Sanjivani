from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Sanjivani Clinical Intake Assistant"
    API_V1_PREFIX: str = "/api/v1"
    OPENAI_API_KEY: str = Field(
        ...,
        description="Required OpenAI/Groq API key for clinical LLM & VLM inference."
    )
    OPENAI_MODEL_NAME: str = "openai/gpt-oss-120b"
    OPENAI_VISION_MODEL_NAME: Optional[str] = None
    OPENAI_BASE_URL: Optional[str] = None
    DEBUG: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
