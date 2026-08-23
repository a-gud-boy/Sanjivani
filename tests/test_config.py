import os
import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_config_requires_openai_api_key(monkeypatch):
    """Verify that Settings raises a ValidationError if OPENAI_API_KEY is missing or empty."""
    # Ensure OPENAI_API_KEY is unset in the environment
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    # Creating Settings without env_file or API key must fail loudly
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_config_loads_valid_api_key(monkeypatch):
    """Verify that Settings initializes cleanly with a provided OPENAI_API_KEY."""
    monkeypatch.setenv("OPENAI_API_KEY", "test_key_12345")
    s = Settings(_env_file=None)
    assert s.OPENAI_API_KEY == "test_key_12345"
