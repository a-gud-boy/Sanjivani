import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import (
    AharaViharaLifestyle,
    ChiefComplaint,
    ClinicalHistoryRecord,
    HpiSocrates,
    PatientDemographics,
)

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
    """Test first conversational intake turn."""
    payload = {
        "user_text": "I have severe lower back ache that started 2 weeks ago.",
        "current_json_state": None,
        "chat_history": [],
    }
    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    data = body["data"]

    assert data["chief_complaint"] is not None
    assert "back" in data["chief_complaint"]["symptom"].lower()
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

    payload = {
        "user_text": "I often feel gas and bloating, and suffer from constipation.",
        "current_json_state": initial_state.model_dump(),
        "chat_history": [
            {"role": "user", "content": "I have lower back stiffness for 2 weeks"},
            {"role": "assistant", "content": "How is your appetite and bowel evacuation?"},
        ],
    }

    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    body = response.json()
    data = body["data"]

    assert data["chief_complaint"]["symptom"] == "Lower back stiffness"
    assert data["ahara_vihara_lifestyle"]["koshtha_bowel"] == "Krura"
    assert data["ahara_vihara_lifestyle"]["agni_digestion"] == "Vishamagni"
    assert data["red_flag_alert"] is False


def test_chat_endpoint_emergency_red_flag():
    """Test immediate triage flagging for emergency symptoms (chest pain, breathlessness)."""
    payload = {
        "user_text": "I have severe crushing chest pain radiating to my left arm and sudden breathlessness!",
        "current_json_state": None,
        "chat_history": [],
    }

    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    body = response.json()
    data = body["data"]

    assert data["red_flag_alert"] is True
    assert "emergency" in data["next_question_to_ask_patient"].lower() or "urgent" in data["next_question_to_ask_patient"].lower()


def test_chat_endpoint_multilingual_support():
    """Test Hindi language preference handling."""
    initial_state = ClinicalHistoryRecord(
        patient_demographics=PatientDemographics(language_preference="hi"),
        chief_complaint=ChiefComplaint(symptom="सिरदर्द (Headache)", duration=None),
    )

    payload = {
        "user_text": "मुझे तेज सिरदर्द है",
        "current_json_state": initial_state.model_dump(),
        "chat_history": [],
    }

    response = client.post("/api/v1/chat", json=payload)
    assert response.status_code == 200
    body = response.json()
    data = body["data"]

    assert data["patient_demographics"]["language_preference"] == "hi"
    assert "समय" in data["next_question_to_ask_patient"] or "समस्या" in data["next_question_to_ask_patient"]
