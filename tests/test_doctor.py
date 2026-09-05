import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _get_or_create_test_patient():
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
    resp = client.get("/api/v1/doctor/patients", params={"query": "14-5555-4444-3333"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["patients"]) >= 1
    return data["patients"][0]


def test_doctor_list_patients_success():
    patient = _get_or_create_test_patient()
    resp = client.get("/api/v1/doctor/patients")
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
    patient = _get_or_create_test_patient()
    resp = client.get("/api/v1/doctor/patients", params={"query": patient["name"].split()[0]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_patients"] >= 1
    matching_names = [p["name"] for p in data["patients"]]
    assert patient["name"] in matching_names


def test_doctor_search_patients_by_abha():
    patient = _get_or_create_test_patient()
    resp = client.get("/api/v1/doctor/patients", params={"query": patient["abha_id"]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_patients"] >= 1
    matching = [p for p in data["patients"] if p["abha_id"] == patient["abha_id"]]
    assert len(matching) == 1


def test_doctor_get_patient_dossier():
    patient = _get_or_create_test_patient()
    resp = client.get(f"/api/v1/doctor/patient/{patient['id']}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["patient"]["name"] == patient["name"]
    assert data["patient"]["abha_id"] == patient["abha_id"]
    assert isinstance(data["intake_sessions"], list)
    assert isinstance(data["documents"], list)
    assert isinstance(data["active_medications"], list)


def test_doctor_get_nonexistent_patient_404():
    resp = client.get("/api/v1/doctor/patient/nonexistent-patient-999")
    assert resp.status_code == 404
