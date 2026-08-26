from unittest.mock import AsyncMock, patch
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import (
    AharaViharaLifestyle,
    ChiefComplaint,
    ClinicalHistoryRecord,
    HpiSocrates,
    KoshthaType,
    PatientDemographics,
)
from app.services.llm_service import ClinicalLLMService

client = TestClient(app)


def test_health_endpoints():
    """Test root and health check endpoints."""
    res_root = client.get("/")
    assert res_root.status_code == 200
    data_root = res_root.json()
    assert data_root["status"] == "online"

    res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"


def test_chat_endpoint_initial_turn():
    """Test first conversational intake turn with mocked LLM processing."""
    mock_result = ClinicalHistoryRecord(
        patient_demographics=PatientDemographics(language_preference="en"),
        chief_complaint=ChiefComplaint(
            symptom="Severe lower back ache",
            duration="2 weeks",
        ),
        hpi_socrates=HpiSocrates(site="Lower back"),
        red_flag_alert=False,
        next_question_to_ask_patient="Can you describe if the pain is sharp, dull, or throbbing?",
    )

    payload = {
        "user_text": "I have severe lower back ache that started 2 weeks ago.",
        "current_json_state": None,
        "chat_history": [],
    }

    with patch.object(ClinicalLLMService, "process_chat", new_callable=AsyncMock) as mock_process:
        mock_process.return_value = mock_result
        response = client.post("/api/v1/chat", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    data = body["data"]

    assert data["chief_complaint"]["symptom"] == "Severe lower back ache"
    assert data["chief_complaint"]["duration"] == "2 weeks"
    assert data["red_flag_alert"] is False
    assert len(data["next_question_to_ask_patient"]) > 0


def test_chat_endpoint_conversational_continuation():
    """Test continuation turn with state injection and chat history."""
    initial_state = ClinicalHistoryRecord(
        patient_demographics=PatientDemographics(language_preference="en"),
        chief_complaint=ChiefComplaint(symptom="Lower back stiffness", duration="2 weeks"),
        hpi_socrates=HpiSocrates(site="Lower back"),
        ahara_vihara_lifestyle=AharaViharaLifestyle(),
    )

    mock_updated_state = ClinicalHistoryRecord(
        patient_demographics=PatientDemographics(language_preference="en"),
        chief_complaint=ChiefComplaint(symptom="Lower back stiffness", duration="2 weeks"),
        hpi_socrates=HpiSocrates(site="Lower back"),
        ahara_vihara_lifestyle=AharaViharaLifestyle(koshtha_bowel=KoshthaType.KRURA),
        red_flag_alert=False,
        next_question_to_ask_patient="How is your sleep quality?",
    )

    payload = {
        "user_text": "I often feel gas and bloating, and suffer from constipation.",
        "current_json_state": initial_state.model_dump(),
        "chat_history": [
            {"role": "user", "content": "I have lower back stiffness for 2 weeks"},
            {"role": "assistant", "content": "How is your appetite and bowel evacuation?"},
        ],
    }

    with patch.object(ClinicalLLMService, "process_chat", new_callable=AsyncMock) as mock_process:
        mock_process.return_value = mock_updated_state
        response = client.post("/api/v1/chat", json=payload)

    assert response.status_code == 200
    body = response.json()
    data = body["data"]

    assert data["chief_complaint"]["symptom"] == "Lower back stiffness"
    assert data["ahara_vihara_lifestyle"]["koshtha_bowel"] == "Krura"
    assert data["red_flag_alert"] is False


def test_chat_endpoint_emergency_red_flag():
    """Test immediate triage flagging for emergency symptoms (chest pain, breathlessness)."""
    mock_emergency_result = ClinicalHistoryRecord(
        chief_complaint=ChiefComplaint(symptom="Severe crushing chest pain"),
        red_flag_alert=True,
        next_question_to_ask_patient="EMERGENCY WARNING: Please proceed immediately to the nearest emergency room.",
    )

    payload = {
        "user_text": "I have severe crushing chest pain radiating to my left arm and sudden breathlessness!",
        "current_json_state": None,
        "chat_history": [],
    }

    with patch.object(ClinicalLLMService, "process_chat", new_callable=AsyncMock) as mock_process:
        mock_process.return_value = mock_emergency_result
        response = client.post("/api/v1/chat", json=payload)

    assert response.status_code == 200
    body = response.json()
    data = body["data"]

    assert data["red_flag_alert"] is True
    assert "emergency" in data["next_question_to_ask_patient"].lower()


def test_chat_endpoint_multilingual_support():
    """Test Hindi language preference handling."""
    mock_hindi_result = ClinicalHistoryRecord(
        patient_demographics=PatientDemographics(language_preference="hi"),
        chief_complaint=ChiefComplaint(symptom="Severe headache"),
        next_question_to_ask_patient="यह समस्या आपको कितने समय से हो रही है?",
    )

    payload = {
        "user_text": "मुझे तेज सिरदर्द है",
        "current_json_state": None,
        "chat_history": [],
    }

    with patch.object(ClinicalLLMService, "process_chat", new_callable=AsyncMock) as mock_process:
        mock_process.return_value = mock_hindi_result
        response = client.post("/api/v1/chat", json=payload)

    assert response.status_code == 200
    body = response.json()
    data = body["data"]

    assert data["patient_demographics"]["language_preference"] == "hi"
    assert any(char >= "\u0900" and char <= "\u097F" for char in data["next_question_to_ask_patient"])


def test_chat_endpoint_llm_failure_propagation():
    """Verify that an external LLM failure raises a clear 500 error instead of falling back to dummy data."""
    payload = {
        "user_text": "I have stomach pain.",
        "current_json_state": None,
        "chat_history": [],
    }

    with patch.object(ClinicalLLMService, "process_chat", new_callable=AsyncMock) as mock_process:
        mock_process.side_effect = HTTPException(
            status_code=500,
            detail="LLM clinical intake inference failed: Rate limit exceeded on upstream provider.",
        )
        response = client.post("/api/v1/chat", json=payload)

    assert response.status_code == 500
    assert "Rate limit exceeded" in response.json()["detail"]


def test_list_models_endpoint():
    """Verify that GET /api/v1/models returns discovered models and active model names."""
    response = client.get("/api/v1/models")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "active_text_model" in data
    assert "active_vision_model" in data
    assert isinstance(data["models"], list)
    assert len(data["models"]) > 0


def test_select_model_endpoint():
    """Verify that POST /api/v1/models/select switches active model in memory."""
    payload = {
        "model_name": "google/medgemma-1.5-4b-it",
        "target": "both",
    }
    response = client.post("/api/v1/models/select", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["active_text_model"] == "google/medgemma-1.5-4b-it"
    assert data["active_vision_model"] == "google/medgemma-1.5-4b-it"

