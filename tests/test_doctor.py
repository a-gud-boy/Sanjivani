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

