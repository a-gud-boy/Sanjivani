import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True, scope="module")
def cleanup_doctor_test_entities():
    """Ensure doctor test entities are completely purged after running."""
    yield
    from tests.conftest import purge_test_entities
    purge_test_entities()


def _get_or_create_test_doctor() -> str:
    resp = client.post(
        "/api/v1/auth/doctor/register",
        json={
            "name": "Dr. Test Clinician",
            "hp_id": "HP-DOC-TEST-001",
            "phone": "9876543201",
            "specialization": "Panchakarma",
            "license_no": "AYUSH-TEST-001",
            "hospital": "Ayurveda Hospital",
        },
    )
    if resp.status_code == 201:
        return resp.json()["token"]
    from app.api.auth import get_active_otp
    client.post("/api/v1/auth/doctor/request-otp", json={"hp_id": "HP-DOC-TEST-001"})
    otp = get_active_otp("HP-DOC-TEST-001")
    vresp = client.post("/api/v1/auth/doctor/verify-otp", json={"hp_id": "HP-DOC-TEST-001", "otp": otp})
    return vresp.json()["token"]


def _get_or_create_test_patient():
    token = _get_or_create_test_doctor()
    headers = {"Authorization": f"Bearer {token}"}
    # Register test patient if not present
    client.post(
        "/api/v1/auth/register",
        json={
            "user_type": "patient",
            "name": "Suresh Kumar",
            "abha_id": "14-5555-4444-3333",
            "phone": "9123456780",
            "gender": "Male",
            "age_years": 32,
            "blood_group": "A+",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
        },
    )
    resp = client.get("/api/v1/doctor/patients", params={"query": "14-5555-4444-3333"}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["patients"]) >= 1
    return data["patients"][0]


def test_doctor_list_patients_success():
    token = _get_or_create_test_doctor()
    headers = {"Authorization": f"Bearer {token}"}
    patient = _get_or_create_test_patient()
    resp = client.get("/api/v1/doctor/patients", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["total_patients"] >= 1
    assert "stats" in data
    stats = data["stats"]
    assert stats["total_patients"] >= 1
    assert "total_prescriptions" in stats
    assert "total_consultations" in stats

    names = [p["name"] for p in data["patients"]]
    assert patient["name"] in names

    p_summary = next(p for p in data["patients"] if p["id"] == patient["id"])
    assert p_summary["abha_id"] == patient["abha_id"]
    assert "patient_details" in p_summary
    assert p_summary["gender"] == "Male"


def test_doctor_search_patients_by_name():
    token = _get_or_create_test_doctor()
    headers = {"Authorization": f"Bearer {token}"}
    patient = _get_or_create_test_patient()
    resp = client.get("/api/v1/doctor/patients", params={"query": patient["name"].split()[0]}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_patients"] >= 1
    matching_names = [p["name"] for p in data["patients"]]
    assert patient["name"] in matching_names


def test_doctor_search_patients_by_abha():
    token = _get_or_create_test_doctor()
    headers = {"Authorization": f"Bearer {token}"}
    patient = _get_or_create_test_patient()
    resp = client.get("/api/v1/doctor/patients", params={"query": patient["abha_id"]}, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_patients"] >= 1
    matching = [p for p in data["patients"] if p["abha_id"] == patient["abha_id"]]
    assert len(matching) == 1


def test_doctor_get_patient_dossier():
    token = _get_or_create_test_doctor()
    headers = {"Authorization": f"Bearer {token}"}
    patient = _get_or_create_test_patient()
    resp = client.get(f"/api/v1/doctor/patient/{patient['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["patient"]["name"] == patient["name"]
    assert data["patient"]["abha_id"] == patient["abha_id"]
    assert isinstance(data["intake_sessions"], list)
    assert isinstance(data["documents"], list)
    assert isinstance(data["active_medications"], list)


def test_doctor_get_nonexistent_patient_404():
    token = _get_or_create_test_doctor()
    headers = {"Authorization": f"Bearer {token}"}
    resp = client.get("/api/v1/doctor/patient/nonexistent-patient-999", headers=headers)
    assert resp.status_code == 404


def test_doctor_translate_session_unauthenticated_401():
    resp = client.post("/api/v1/doctor/translate-session", json={"target_language": "en"})
    assert resp.status_code == 401


def test_doctor_translate_session_with_mock():
    from unittest.mock import AsyncMock, patch
    from app.services.llm_service import ClinicalLLMService

    token = _get_or_create_test_doctor()
    headers = {"Authorization": f"Bearer {token}"}

    mock_result = {
        "chief_complaint": "Severe headache and high fever",
        "ai_summary_text": "Patient has 3-day history of fever and cephalalgia.",
        "chat_history": [
            {"role": "user", "content": "I have a high fever"},
            {"role": "assistant", "content": "How long have you had this fever?"},
        ],
    }

    with patch.object(ClinicalLLMService, "translate_clinical_session", new_callable=AsyncMock) as mock_tr:
        mock_tr.return_value = mock_result

        payload = {
            "target_language": "en",
            "source_language": "hi",
            "chief_complaint": "तेज सिरदर्द और बुखार",
            "ai_summary_text": "मरीज को 3 दिनों से सिरदर्द और बुखार है।",
            "chat_history": [
                {"role": "user", "content": "मुझे तेज बुखार है"},
                {"role": "assistant", "content": "यह बुखार कितने दिनों से है?"},
            ],
        }

        resp = client.post("/api/v1/doctor/translate-session", json=payload, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["target_language"] == "en"
        assert data["translated_chief_complaint"] == "Severe headache and high fever"
        assert data["translated_ai_summary_text"] == "Patient has 3-day history of fever and cephalalgia."
        assert len(data["translated_chat_history"]) == 2
        assert data["translated_chat_history"][0]["content"] == "I have a high fever"


def test_doctor_translate_text_with_mock():
    from unittest.mock import AsyncMock, patch
    from app.services.llm_service import ClinicalLLMService

    token = _get_or_create_test_doctor()
    headers = {"Authorization": f"Bearer {token}"}

    with patch.object(ClinicalLLMService, "translate_text", new_callable=AsyncMock) as mock_tr:
        mock_tr.return_value = "Headache and fever"

        payload = {
            "text": "सिरदर्द और बुखार",
            "target_language": "en",
            "source_language": "hi",
        }

        resp = client.post("/api/v1/doctor/translate", json=payload, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["translated_text"] == "Headache and fever"


