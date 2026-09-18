import os
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import (
    ChatRequest,
    ChiefComplaint,
    ClinicalHistoryRecord,
    PatientDemographics,
)
from app.services.llm_service import ClinicalLLMService

client = TestClient(app)

MOCK_GREETINGS = {
    "en": ("I am Sanjivani AI. Tell me what symptoms or health problems you are experiencing.", ["Headache / Body Ache", "Fever, Cold or Cough", "Stomach or Digestion issue"]),
    "hi": ("मैं संजीवनी एआई हूँ। कृपया मुझे बताएं कि आपको क्या स्वास्थ्य समस्या है।", ["सिरदर्द / बदन दर्द", "बुखार, सर्दी या खांसी", "पेट या पाचन की समस्या"]),
    "ta": ("நான் சஞ்சீவனி AI. உங்களுக்கு என்ன அறிகுறிகள் உள்ளன என்று கூறுங்கள்.", ["தலைவலி / உடல் வலி", "காய்ச்சல், சளி", "வயிற்று பிரச்சனை"]),
    "te": ("నేను సంజీవని AI. మీకు ఏ లక్షణాలు లేదా ఆరోగ్య సమస్యలు ఉన్నాయో చెప్పండి.", ["తలనొప్పి / ఒంటి నొప్పులు", "జ్వరం, జలుబు", "కడుపు సమస్య"]),
    "bn": ("আমি সঞ্জিবনী এআই। আপনার কি উপসর্গ বা স্বাস্থ্য समस्या হচ্ছে জানান।", ["মাথাব্যথা / শরীরে ব্যথা", "জ্বর, সর্দি বা কাশি", "পেটের समस्या"]),
    "mr": ("मी संजीवनी AI आहे. तुम्हाला कोणती लक्षणे किंवा समस्या जाणवत आहेत ते सांगा.", ["डोकेदुखी / अंगदुखी", "ताप, सर्दी किंवा खोकला", "पोटाच्या समस्या"]),
    "gu": ("હું સંજીવની AI છું. તમને શું લક્ષણો કે સમસ્યા છે તે જણાવો.", ["માથાનો દુખાવો / શરીરનો દુખાવો", "તાવ, શરદી કે ઉધરસ", "પેટની સમસ્યા"]),
}


def test_chat_request_schema_language():
    """Verify ChatRequest accepts and defaults language correctly."""
    req_default = ChatRequest(user_text="Hello")
    assert req_default.language == "en"

    req_hi = ChatRequest(user_text="नमस्ते", language="hi")
    assert req_hi.language == "hi"

    req_ta = ChatRequest(user_text="வணக்கம்", language="ta")
    assert req_ta.language == "ta"


def test_chat_init_all_supported_languages():
    """Verify /api/v1/chat/init returns valid greetings and quick replies for all 7 languages using mocked LLM."""
    languages = ["en", "hi", "ta", "te", "bn", "mr", "gu"]
    with patch.object(ClinicalLLMService, "generate_initial_greeting", new_callable=AsyncMock) as mock_greeting:
        async def _mock_greeting(language="en", patient_name=None):
            return MOCK_GREETINGS.get(language, MOCK_GREETINGS["en"])
        mock_greeting.side_effect = _mock_greeting

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
    """Verify fallback greetings pool returns valid data for all 7 languages without live LLM calls."""
    service = ClinicalLLMService()
    # Mock the LLM client call so it exercises the internal FALLBACK_GREETINGS pool deterministically
    with patch.object(service._direct_chat_client.chat.completions, "create", side_effect=RuntimeError("LLM simulated offline")):
        for lang in ["en", "hi", "ta", "te", "bn", "mr", "gu"]:
            greeting, replies = await service.generate_initial_greeting(language=lang)
            assert len(greeting) > 5
            assert len(replies) >= 3


def test_chat_endpoint_with_language_parameter():
    """Verify chat endpoint successfully accepts and processes language in payload with mocked LLM."""
    payload = {
        "user_text": "मुझे पिछले 3 दिनों से सिरदर्द और तेज बुखार है",
        "language": "hi",
        "current_json_state": None,
        "chat_history": [],
    }
    mock_record = ClinicalHistoryRecord(
        patient_demographics=PatientDemographics(language_preference="hi"),
        chief_complaint=ChiefComplaint(symptom="सिरदर्द और तेज बुखार", duration="3 दिन"),
        next_question_to_ask_patient="क्या आपको उल्टी या चक्कर भी आ रहे हैं?",
    )
    with patch.object(ClinicalLLMService, "process_chat", new_callable=AsyncMock) as mock_process:
        mock_process.return_value = mock_record
        response = client.post("/api/v1/chat", json=payload)
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "success"
        data = body["data"]
        assert data["patient_demographics"]["language_preference"] == "hi"
        assert len(data["next_question_to_ask_patient"]) > 0


@pytest.mark.integration
@pytest.mark.skipif(
    os.getenv("RUN_LIVE_LLM_TESTS") != "1",
    reason="Skipping live LLM integration tests to prevent quota burn and CI timeouts. Set RUN_LIVE_LLM_TESTS=1 to run.",
)
def test_live_gemini_api_call():
    """Optional live integration test to verify real Gemini API connectivity."""
    payload = {
        "user_text": "I have mild cough and fever since yesterday",
        "language": "en",
        "current_json_state": None,
        "chat_history": [],
    }
    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
