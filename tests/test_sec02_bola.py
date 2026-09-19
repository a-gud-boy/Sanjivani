"""
Tests for SEC-02: Broken Object Level Authorization (BOLA) & SEC-03: Authorization Enforcement.

Verifies:
1. Endpoints reject unauthenticated requests with HTTP 401 Unauthorized.
2. Patient role tokens cannot access doctor registry endpoints (HTTP 403 Forbidden).
3. Patient A cannot access Patient B's medical dashboard (HTTP 403 Forbidden).
4. Patient A cannot create/modify intake sessions for Patient B (HTTP 403 Forbidden).
5. Patient A cannot delete Patient B's medical documents (HTTP 403 Forbidden).
6. Patient A cannot delete Patient B's intake sessions (HTTP 403 Forbidden).
7. Patient A cannot modify Patient B's personal profile (HTTP 403 Forbidden).
8. Authorized actions succeed with 200 OK (Patient on own data, Doctor on clinician endpoints).
9. Tampered, invalid, and expired tokens return HTTP 401 Unauthorized.
"""

from datetime import timedelta
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

PATIENT_A_ABHA = "14-1111-2222-3333"
PATIENT_B_ABHA = "14-4444-5555-6666"
DOCTOR_HP_ID = "HP-DOC-77889"


@pytest.fixture(autouse=True, scope="module")
def cleanup_bola_test_entities():
    """Ensure BOLA test entities are completely purged after running."""
    yield
    from tests.conftest import purge_test_entities
    purge_test_entities()


def _register_and_get_patient(name: str, abha: str, phone: str):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "user_type": "patient",
            "name": name,
            "abha_id": abha,
            "phone": phone,
            "gender": "Female",
            "age_years": 28,
            "blood_group": "O+",
        },
    )
    if resp.status_code == 201:
        data = resp.json()
        return data["user"]["id"], data["token"]
    # If already registered, fetch token via verify-otp
    from app.api.auth import get_active_otp
    client.post("/api/v1/auth/patient/request-otp", json={"abha_id": abha})
    otp = get_active_otp(abha)
    vresp = client.post("/api/v1/auth/patient/verify-otp", json={"abha_id": abha, "otp": otp})
    vdata = vresp.json()
    return vdata["user"]["id"], vdata["token"]


def _register_and_get_doctor():
    resp = client.post(
        "/api/v1/auth/doctor/register",
        json={
            "name": "Dr. Kavita Sharma",
            "hp_id": DOCTOR_HP_ID,
            "phone": "9811223344",
            "specialization": "Kayachikitsa",
            "license_no": "AYUSH-KA-77889",
            "hospital": "Central Ayurvedic Institute",
        },
    )
    if resp.status_code == 201:
        data = resp.json()
        return data["user"]["id"], data["token"]
    from app.api.auth import get_active_otp
    client.post("/api/v1/auth/doctor/request-otp", json={"hp_id": DOCTOR_HP_ID})
    otp = get_active_otp(DOCTOR_HP_ID)
    vresp = client.post("/api/v1/auth/doctor/verify-otp", json={"hp_id": DOCTOR_HP_ID, "otp": otp})
    vdata = vresp.json()
    return vdata["user"]["id"], vdata["token"]


# ── 1. Unauthenticated Requests (401 Unauthorized) ────────────────────────────

def test_unauthenticated_doctor_patients_rejected():
    resp = client.get("/api/v1/doctor/patients")
    assert resp.status_code == 401
    assert "Bearer token required" in resp.json()["detail"]


def test_unauthenticated_doctor_dossier_rejected():
    resp = client.get("/api/v1/doctor/patient/some-patient-id")
    assert resp.status_code == 401


def test_unauthenticated_patient_dashboard_rejected():
    resp = client.get("/api/v1/patient/dashboard", params={"patient_id": "any-id"})
    assert resp.status_code == 401


def test_unauthenticated_save_intake_rejected():
    resp = client.post(
        "/api/v1/patient/intake-session",
        json={"patient_id": "any-id", "chat_history": []},
    )
    assert resp.status_code == 401


def test_unauthenticated_delete_document_rejected():
    resp = client.delete("/api/v1/patient/document/some-doc-id")
    assert resp.status_code == 401


def test_unauthenticated_delete_intake_session_rejected():
    resp = client.delete("/api/v1/patient/intake-session/some-session-id")
    assert resp.status_code == 401


def test_unauthenticated_update_profile_rejected():
    resp = client.put(
        "/api/v1/patient/profile",
        json={"patient_id": "any-id", "name": "Hacker"},
    )
    assert resp.status_code == 401


# ── 2. Role-Based Access Control (Patient cannot access Doctor Portal) ─────────

def test_patient_cannot_access_doctor_registry():
    _, pat_token = _register_and_get_patient("Priya Sharma", PATIENT_A_ABHA, "9870000001")
    headers = {"Authorization": f"Bearer {pat_token}"}

    resp = client.get("/api/v1/doctor/patients", headers=headers)
    assert resp.status_code == 403
    assert "Doctor / Clinician account required" in resp.json()["detail"]


def test_patient_cannot_access_doctor_dossier():
    _, pat_token = _register_and_get_patient("Priya Sharma", PATIENT_A_ABHA, "9870000001")
    headers = {"Authorization": f"Bearer {pat_token}"}

    resp = client.get(f"/api/v1/doctor/patient/{PATIENT_B_ABHA}", headers=headers)
    assert resp.status_code == 403


# ── 3. BOLA: Patient A vs Patient B Isolation ─────────────────────────────────

def test_bola_patient_a_cannot_view_patient_b_dashboard():
    id_a, token_a = _register_and_get_patient("Priya Sharma", PATIENT_A_ABHA, "9870000001")
    id_b, _ = _register_and_get_patient("Rahul Mehra", PATIENT_B_ABHA, "9870000002")

    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Patient A attempts to view Patient B's dashboard by UUID
    resp_uuid = client.get("/api/v1/patient/dashboard", params={"patient_id": id_b}, headers=headers_a)
    assert resp_uuid.status_code == 403
    assert "not authorized to view another patient" in resp_uuid.json()["detail"]

    # Patient A attempts to view Patient B's dashboard by ABHA ID
    resp_abha = client.get("/api/v1/patient/dashboard", params={"patient_id": PATIENT_B_ABHA}, headers=headers_a)
    assert resp_abha.status_code == 403


def test_patient_a_can_view_own_dashboard():
    id_a, token_a = _register_and_get_patient("Priya Sharma", PATIENT_A_ABHA, "9870000001")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    resp = client.get("/api/v1/patient/dashboard", params={"patient_id": id_a}, headers=headers_a)
    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    assert resp.json()["patient"]["id"] == id_a


def test_bola_patient_b_cannot_tamper_patient_a_intake_session():
    id_a, token_a = _register_and_get_patient("Priya Sharma", PATIENT_A_ABHA, "9870000001")
    id_b, token_b = _register_and_get_patient("Rahul Mehra", PATIENT_B_ABHA, "9870000002")

    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Patient B attempts to submit session for Patient A
    resp = client.post(
        "/api/v1/patient/intake-session",
        json={
            "patient_id": id_a,
            "chat_history": [{"role": "user", "content": "Fake medical history injected"}],
        },
        headers=headers_b,
    )
    assert resp.status_code == 403
    assert "cannot create or modify intake sessions for another patient" in resp.json()["detail"]


def test_bola_patient_b_cannot_delete_patient_a_document():
    id_a, token_a = _register_and_get_patient("Priya Sharma", PATIENT_A_ABHA, "9870000001")
    id_b, token_b = _register_and_get_patient("Rahul Mehra", PATIENT_B_ABHA, "9870000002")

    # Patient A uploads a document
    headers_a = {"Authorization": f"Bearer {token_a}"}
    save_resp = client.post(
        "/api/v1/patient/intake-session",
        json={
            "patient_id": id_a,
            "scanned_documents": [
                {
                    "id": "doc-a-secure-101",
                    "filename": "priya_blood_report.pdf",
                    "file_type": "lab_report",
                }
            ],
        },
        headers=headers_a,
    )
    assert save_resp.status_code == 200

    # Patient B attempts to delete Patient A's document
    headers_b = {"Authorization": f"Bearer {token_b}"}
    del_resp = client.delete("/api/v1/patient/document/doc-a-secure-101", headers=headers_b)
    assert del_resp.status_code == 403
    assert "not authorized to delete another patient's medical document" in del_resp.json()["detail"]

    # Verify document still exists on Patient A's dashboard
    dash_resp = client.get("/api/v1/patient/dashboard", params={"patient_id": id_a}, headers=headers_a)
    doc_ids = [d["id"] for d in dash_resp.json()["documents"]]
    assert "doc-a-secure-101" in doc_ids


def test_bola_patient_b_cannot_delete_patient_a_intake_session():
    id_a, token_a = _register_and_get_patient("Priya Sharma", PATIENT_A_ABHA, "9870000001")
    id_b, token_b = _register_and_get_patient("Rahul Mehra", PATIENT_B_ABHA, "9870000002")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    save_resp = client.post(
        "/api/v1/patient/intake-session",
        json={"patient_id": id_a, "chat_history": [{"role": "user", "content": "Headache"}]},
        headers=headers_a,
    )
    sess_id = save_resp.json()["session_id"]

    # Patient B attempts to delete Patient A's session
    headers_b = {"Authorization": f"Bearer {token_b}"}
    del_resp = client.delete(f"/api/v1/patient/intake-session/{sess_id}", headers=headers_b)
    assert del_resp.status_code == 403
    assert "not authorized to delete another patient's intake session" in del_resp.json()["detail"]


def test_bola_patient_b_cannot_modify_patient_a_profile():
    id_a, _ = _register_and_get_patient("Priya Sharma", PATIENT_A_ABHA, "9870000001")
    _, token_b = _register_and_get_patient("Rahul Mehra", PATIENT_B_ABHA, "9870000002")

    headers_b = {"Authorization": f"Bearer {token_b}"}
    resp = client.put(
        "/api/v1/patient/profile",
        json={"patient_id": id_a, "name": "Malicious Tampered Name"},
        headers=headers_b,
    )
    assert resp.status_code == 403
    assert "not authorized to modify another patient's profile" in resp.json()["detail"]


# ── 4. Legitimate Doctor Clinical Access ───────────────────────────────────────

def test_doctor_can_access_patients_registry_and_dossier():
    doc_id, doc_token = _register_and_get_doctor()
    id_a, _ = _register_and_get_patient("Priya Sharma", PATIENT_A_ABHA, "9870000001")

    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    # Doctor queries patient registry
    reg_resp = client.get("/api/v1/doctor/patients", headers=doc_headers)
    assert reg_resp.status_code == 200
    assert reg_resp.json()["status"] == "success"

    # Doctor opens Patient A's clinical dossier
    dossier_resp = client.get(f"/api/v1/doctor/patient/{id_a}", headers=doc_headers)
    assert dossier_resp.status_code == 200
    assert dossier_resp.json()["patient"]["id"] == id_a

    # Doctor opens Patient A's dashboard via patient endpoint as clinician
    dash_resp = client.get("/api/v1/patient/dashboard", params={"patient_id": id_a}, headers=doc_headers)
    assert dash_resp.status_code == 200


# ── 5. Invalid / Expired Token Rejection ───────────────────────────────────────

def test_tampered_token_rejected():
    headers = {"Authorization": "Bearer not-a-real-jwt-token"}
    resp = client.get("/api/v1/doctor/patients", headers=headers)
    assert resp.status_code == 401


def test_expired_token_rejected():
    id_a, _ = _register_and_get_patient("Priya Sharma", PATIENT_A_ABHA, "9870000001")
    expired_token = create_access_token(
        {"sub": id_a, "role": "patient"},
        expires_delta=timedelta(seconds=-60),  # expired 1 minute ago
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    resp = client.get("/api/v1/patient/dashboard", params={"patient_id": id_a}, headers=headers)
    assert resp.status_code == 401
    assert "expired" in resp.json()["detail"].lower()
