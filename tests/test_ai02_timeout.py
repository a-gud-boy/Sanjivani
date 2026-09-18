"""
Unit tests for AI-02: Explicit timeouts on AsyncOpenAI and ChatOpenAI clients
in ClinicalLLMService.
"""
import pytest
from app.services.llm_service import ClinicalLLMService


def test_initial_client_timeouts():
    """Verify that newly initialized ClinicalLLMService sets explicit timeouts."""
    service = ClinicalLLMService()
    assert service._direct_chat_client.timeout == 30.0
    assert service._direct_vision_client.timeout == 45.0
    assert service._direct_client.timeout == 30.0


def test_switched_client_timeouts():
    """Verify that switched models also preserve explicit timeouts."""
    service = ClinicalLLMService()
    service.switch_model(model_name="gemini-2.5-flash", target="both")
    assert service._direct_chat_client.timeout == 30.0
    assert service._direct_vision_client.timeout == 45.0
    assert service._direct_client.timeout == 30.0
