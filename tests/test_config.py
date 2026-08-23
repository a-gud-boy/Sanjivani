import os
import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_config_requires_api_key(monkeypatch):
    """Verify that Settings raises a ValidationError if no API key is provided."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("TEXT_LLM_API_KEY", raising=False)
    monkeypatch.delenv("VISION_LLM_API_KEY", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_config_loads_global_fallback_key(monkeypatch):
    """Verify that Settings initializes and resolves effective keys from OPENAI_API_KEY."""
    monkeypatch.delenv("TEXT_LLM_API_KEY", raising=False)
    monkeypatch.delenv("VISION_LLM_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "test_global_key")
    monkeypatch.setenv("OPENAI_MODEL_NAME", "test-model-text")
    monkeypatch.setenv("OPENAI_VISION_MODEL_NAME", "test-model-vision")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.test.com/v1")

    s = Settings(_env_file=None)
    assert s.effective_text_api_key == "test_global_key"
    assert s.effective_vision_api_key == "test_global_key"
    assert s.effective_text_model_name == "test-model-text"
    assert s.effective_vision_model_name == "test-model-vision"
    assert s.effective_text_base_url == "https://api.test.com/v1"
    assert s.effective_vision_base_url == "https://api.test.com/v1"


def test_config_loads_separated_text_and_vision_keys(monkeypatch):
    """Verify that Settings initializes with distinct Text and Vision configurations."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("TEXT_LLM_API_KEY", "text_key_abc")
    monkeypatch.setenv("TEXT_LLM_MODEL_NAME", "text-specialized-model")
    monkeypatch.setenv("TEXT_LLM_BASE_URL", "https://api.groq.com/openai/v1")

    monkeypatch.setenv("VISION_LLM_API_KEY", "vision_key_xyz")
    monkeypatch.setenv("VISION_LLM_MODEL_NAME", "qwen/qwen3.6-27b")
    monkeypatch.setenv("VISION_LLM_BASE_URL", "https://api.vision.com/v1")

    s = Settings(_env_file=None)
    assert s.effective_text_api_key == "text_key_abc"
    assert s.effective_text_model_name == "text-specialized-model"
    assert s.effective_text_base_url == "https://api.groq.com/openai/v1"

    assert s.effective_vision_api_key == "vision_key_xyz"
    assert s.effective_vision_model_name == "qwen/qwen3.6-27b"
    assert s.effective_vision_base_url == "https://api.vision.com/v1"
