import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_doctor_list_patients_success():
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
    assert "Ramesh Sharma" in names

    # Check each patient summary has expected personal details
    ramesh = next(p for p in data["patients"] if p["name"] == "Ramesh Sharma")
    assert ramesh["abha_id"] == "14-1234-5678-9012"
    assert "patient_details" in ramesh
    assert "occupation" in ramesh["patient_details"]
    assert ramesh["gender"] == "Male"


def test_doctor_search_patients_by_name():
    resp = client.get("/api/v1/doctor/patients", params={"query": "Ramesh"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_patients"] == 1
    assert data["patients"][0]["name"] == "Ramesh Sharma"
    assert data["patients"][0]["abha_id"] == "14-1234-5678-9012"


def test_doctor_search_patients_by_abha():
    resp = client.get("/api/v1/doctor/patients", params={"query": "14-1234-5678-9012"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_patients"] == 1
    assert data["patients"][0]["name"] == "Ramesh Sharma"


def test_doctor_get_patient_dossier():
    resp = client.get("/api/v1/doctor/patient/patient-demo-001")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["patient"]["name"] == "Ramesh Sharma"
    assert data["patient"]["abha_id"] == "14-1234-5678-9012"
    assert isinstance(data["intake_sessions"], list)
    assert isinstance(data["documents"], list)
    assert isinstance(data["active_medications"], list)


def test_doctor_get_nonexistent_patient_404():
    resp = client.get("/api/v1/doctor/patient/nonexistent-patient-999")
    assert resp.status_code == 404
