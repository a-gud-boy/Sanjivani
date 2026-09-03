import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import ChatRequest, ClinicalHistoryRecord
from app.services.llm_service import ClinicalLLMService

client = TestClient(app)


def test_chat_request_schema_language():
    """Verify ChatRequest accepts and defaults language correctly."""
    req_default = ChatRequest(user_text="Hello")
    assert req_default.language == "en"

    req_hi = ChatRequest(user_text="नमस्ते", language="hi")
    assert req_hi.language == "hi"

    req_ta = ChatRequest(user_text="வணக்கம்", language="ta")
    assert req_ta.language == "ta"


def test_chat_init_all_supported_languages():
    """Verify /api/v1/chat/init returns valid greetings and quick replies for all 7 languages."""
    languages = ["en", "hi", "ta", "te", "bn", "mr", "gu"]
    for lang in languages:
        res = client.get(f"/api/v1/chat/init?language={lang}&patient_name=Ramesh")
        assert res.status_code == 200, f"Failed for language {lang}"
        data = res.json()
        assert data["status"] == "success"
        assert len(data["greeting"]) > 0
        assert len(data["suggested_quick_replies"]) >= 2


@pytest.mark.asyncio
async def test_llm_service_system_prompt_language_injection():
    """Verify _build_chat_system_prompt injects language directives."""
    service = ClinicalLLMService()

    # Hindi
    prompt_hi = service._build_chat_system_prompt(None, language="hi")
    assert "Hindi (हिन्दी)" in prompt_hi
    assert "CRITICAL MULTILINGUAL INSTRUCTION" in prompt_hi

    # Tamil
    prompt_ta = service._build_chat_system_prompt(None, language="ta")
    assert "Tamil (தமிழ்)" in prompt_ta

    # Gujarati
    prompt_gu = service._build_chat_system_prompt(None, language="gu")
    assert "Gujarati (ગુજરાતી)" in prompt_gu


@pytest.mark.asyncio
async def test_llm_service_fallback_greetings_all_languages():
    """Verify fallback greetings pool returns valid data for all 7 languages."""
    service = ClinicalLLMService()
    for lang in ["en", "hi", "ta", "te", "bn", "mr", "gu"]:
        # When calling generate_initial_greeting without active LLM, it uses fallback
        greeting, replies = await service.generate_initial_greeting(language=lang)
        assert len(greeting) > 5
        assert len(replies) >= 3


def test_chat_endpoint_with_language_parameter():
    """Verify chat endpoint successfully accepts and processes language in payload."""
    payload = {
        "user_text": "मुझे पिछले 3 दिनों से सिरदर्द और तेज बुखार है",
        "language": "hi",
        "current_json_state": None,
        "chat_history": [],
    }
    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    data = body["data"]
    assert data["patient_demographics"]["language_preference"] == "hi"
    assert len(data["next_question_to_ask_patient"]) > 0
