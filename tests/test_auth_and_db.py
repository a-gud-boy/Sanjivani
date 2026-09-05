from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

TEST_PATIENT_ABHA = "14-5555-4444-3333"
TEST_DOCTOR_ABHA = "14-8888-7777-6666"


def _ensure_test_patient() -> dict:
    client.post(
        "/api/v1/auth/register",
        json={
            "user_type": "patient",
            "name": "Suresh Kumar",
            "abha_id": TEST_PATIENT_ABHA,
            "phone": "9123456780",
            "gender": "Male",
            "age_years": 32,
            "blood_group": "A+",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
        },
    )
    doc_resp = client.get("/api/v1/doctor/patients", params={"query": TEST_PATIENT_ABHA})
    assert doc_resp.status_code == 200
    patients = doc_resp.json().get("patients", [])
    assert len(patients) >= 1
    return patients[0]


def _ensure_test_doctor() -> dict:
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "user_type": "doctor",
            "name": "Dr. Amit Verma",
            "abha_id": TEST_DOCTOR_ABHA,
            "phone": "9876543299",
            "specialization": "Panchakarma",
            "license_no": "AYUSH-KA-2024-9988",
            "hospital": "National Ayurveda Hospital",
        },
    )
    if resp.status_code == 201:
        return resp.json()["user"]
    # If already exists, verify via request-otp
    otp_resp = client.post(
        "/api/v1/auth/request-otp",
        json={"abha_id": TEST_DOCTOR_ABHA, "user_type": "doctor"},
    )
    assert otp_resp.status_code == 200
    return {"name": "Dr. Amit Verma", "abha_id": TEST_DOCTOR_ABHA}


def test_auth_register_patient_success():
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "user_type": "patient",
            "name": "Suresh Kumar",
            "abha_id": TEST_PATIENT_ABHA,
            "phone": "9123456780",
            "gender": "Male",
            "age_years": 32,
            "blood_group": "A+",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
        },
    )
    # 201 if first time, 409 if already registered
    assert resp.status_code in (201, 409)
    if resp.status_code == 201:
        data = resp.json()
        assert data["status"] == "success"
        assert data["user"]["name"] == "Suresh Kumar"
        assert data["user"]["abha_id"] == TEST_PATIENT_ABHA
        assert data["user"]["patient_details"]["blood_group"] == "A+"
        assert "token" in data


def test_auth_register_duplicate_abha_fails():
    _ensure_test_patient()
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "user_type": "patient",
            "name": "Duplicate Suresh",
            "abha_id": TEST_PATIENT_ABHA,
            "phone": "9876543210",
        },
    )
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]


def test_auth_register_doctor_success():
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "user_type": "doctor",
            "name": "Dr. Amit Verma",
            "abha_id": TEST_DOCTOR_ABHA,
            "phone": "9876543299",
            "specialization": "Panchakarma",
            "license_no": "AYUSH-KA-2024-9988",
            "hospital": "National Ayurveda Hospital",
        },
    )
    assert resp.status_code in (201, 409)
    if resp.status_code == 201:
        data = resp.json()
        assert data["status"] == "success"
        assert data["user"]["name"] == "Dr. Amit Verma"
        assert data["user"]["doctor_details"]["license_no"] == "AYUSH-KA-2024-9988"
        assert data["user"]["doctor_details"]["specialization"] == "Panchakarma"


def test_auth_request_otp_patient_success():
    _ensure_test_patient()
    resp = client.post(
        "/api/v1/auth/request-otp",
        json={"abha_id": TEST_PATIENT_ABHA, "user_type": "patient"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["user_name"] == "Suresh Kumar"
    assert data["simulated_otp"] == "123456"


def test_auth_request_otp_doctor_success():
    _ensure_test_doctor()
    resp = client.post(
        "/api/v1/auth/request-otp",
        json={"abha_id": TEST_DOCTOR_ABHA, "user_type": "doctor"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["user_name"] == "Dr. Amit Verma"
    assert data["simulated_otp"] == "123456"


def test_auth_request_otp_unregistered_fails():
    resp = client.post(
        "/api/v1/auth/request-otp",
        json={"abha_id": "14-0000-0000-0000", "user_type": "patient"},
    )
    assert resp.status_code == 404
    assert "register a new account" in resp.json()["detail"]


def test_auth_verify_otp_success():
    _ensure_test_patient()
    resp = client.post(
        "/api/v1/auth/verify-otp",
        json={
            "abha_id": TEST_PATIENT_ABHA,
            "otp": "123456",
            "user_type": "patient",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "token" in data
    assert data["user"]["name"] == "Suresh Kumar"
    assert data["user"]["patient_details"]["blood_group"] == "A+"


def test_auth_verify_otp_invalid_code():
    _ensure_test_patient()
    resp = client.post(
        "/api/v1/auth/verify-otp",
        json={
            "abha_id": TEST_PATIENT_ABHA,
            "otp": "999999999",  # not 6 digits
            "user_type": "patient",
        },
    )
    assert resp.status_code == 400


def test_patient_dashboard_data():
    patient = _ensure_test_patient()
    resp = client.get(
        "/api/v1/patient/dashboard",
        params={"patient_id": patient["id"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["patient"]["name"] == patient["name"]
    assert data["patient"]["abha_id"] == patient["abha_id"]
    assert isinstance(data["intake_sessions"], list)
    assert isinstance(data["documents"], list)
    assert isinstance(data["active_medications"], list)


def test_patient_save_intake_session_and_delete():
    patient = _ensure_test_patient()
    # Save a new intake session
    save_resp = client.post(
        "/api/v1/patient/intake-session",
        json={
            "patient_id": patient["id"],
            "language": "en",
            "chat_history": [
                {"role": "user", "content": "I have mild fever since yesterday."},
                {"role": "assistant", "content": "Did you measure your temperature?"},
            ],
            "clinical_record": {
                "chief_complaint": {"symptom": "Fever", "duration": "1 day"}
            },
            "scanned_documents": [
                {
                    "id": "test-doc-upload-101",
                    "filename": "blood_test_report.pdf",
                    "file_type": "lab_report",
                    "result": {
                        "medications": [
                            {"drug_name": "Paracetamol", "dosage": "650mg", "frequency": "SOS", "duration": "3 days"}
                        ],
                        "lab_investigations": [
                            {"parameter_name": "Platelets", "observed_value": "220000", "unit": "/mcL", "is_abnormal": False}
                        ],
                        "raw_text": "Platelets 220000 /mcL. Paracetamol 650mg SOS.",
                    },
                }
            ],
            "ai_summary_text": "Patient has mild fever for 1 day.",
        },
    )
    assert save_resp.status_code == 200
    saved_session = save_resp.json()
    assert saved_session["status"] == "success"
    assert saved_session["saved_documents_count"] == 1

    # Check dashboard has the new document & medication
    dash_resp = client.get(
        "/api/v1/patient/dashboard",
        params={"patient_id": patient["id"]},
    )
    dash_data = dash_resp.json()
    doc_filenames = [d["filename"] for d in dash_data["documents"]]
    assert "blood_test_report.pdf" in doc_filenames
    med_names = [m["drug_name"] for m in dash_data["active_medications"]]
    assert "Paracetamol" in med_names

    # Delete the uploaded document
    del_resp = client.delete("/api/v1/patient/document/test-doc-upload-101")
    assert del_resp.status_code == 200

    # Check dashboard no longer has the deleted document
    dash_resp_after = client.get(
        "/api/v1/patient/dashboard",
        params={"patient_id": patient["id"]},
    )
    dash_after = dash_resp_after.json()
    doc_filenames_after = [d["filename"] for d in dash_after["documents"]]
    assert "blood_test_report.pdf" not in doc_filenames_after


def test_update_patient_profile():
    patient = _ensure_test_patient()
    resp = client.put(
        "/api/v1/patient/profile",
        json={
            "patient_id": patient["id"],
            "phone": "+91 91234 56789",
            "patient_details": {
                "occupation": "Principal",
                "city": "Bengaluru",
            },
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["patient"]["phone"] == "+91 91234 56789"
    assert data["patient"]["patient_details"]["occupation"] == "Principal"


def test_delete_intake_session():
    patient = _ensure_test_patient()
    # 1. Create an intake session to delete
    save_resp = client.post(
        "/api/v1/patient/intake-session",
        json={
            "patient_id": patient["id"],
            "language": "en",
            "chat_history": [
                {"role": "user", "content": "Temporary test session."},
            ],
            "clinical_record": {
                "chief_complaint": {"symptom": "Transient headache", "duration": "1 hour"}
            },
        },
    )
    assert save_resp.status_code == 200
    sess_id = save_resp.json()["session_id"]

    # 2. Delete the session
    del_resp = client.delete(f"/api/v1/patient/intake-session/{sess_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["status"] == "success"

    # 3. Verify session no longer in dashboard
    dash_resp = client.get(
        "/api/v1/patient/dashboard",
        params={"patient_id": patient["id"]},
    )
    session_ids = [s["id"] for s in dash_resp.json()["intake_sessions"]]
    assert sess_id not in session_ids


def test_active_vs_past_medications_filtering():
    patient = _ensure_test_patient()
    # 1. Upload a session with an expired medication and an active medication
    save_resp = client.post(
        "/api/v1/patient/intake-session",
        json={
            "patient_id": patient["id"],
            "language": "en",
            "chat_history": [{"role": "user", "content": "Medication filter test"}],
            "clinical_record": {"chief_complaint": {"symptom": "Followup"}},
            "scanned_documents": [
                {
                    "id": "test-doc-past-med",
                    "filename": "old_prescription.pdf",
                    "file_type": "prescription",
                    "result": {
                        "medications": [
                            {"drug_name": "Azithromycin", "dosage": "500mg", "frequency": "TDS", "duration": "5 days"}
                        ],
                        "raw_text": "Prescription Date: 01/01/2026. Azithromycin 500mg TDS for 5 days.",
                    },
                },
                {
                    "id": "test-doc-active-med",
                    "filename": "current_prescription.pdf",
                    "file_type": "prescription",
                    "result": {
                        "medications": [
                            {"drug_name": "Cetirizine", "dosage": "10mg", "frequency": "OD", "duration": "ongoing"}
                        ],
                        "raw_text": "Cetirizine 10mg OD ongoing daily.",
                    },
                },
            ],
            "ai_summary_text": "Test session for active and past medications.",
        },
    )
    assert save_resp.status_code == 200

    # 2. Verify patient dashboard separates active vs past
    dash_resp = client.get(
        "/api/v1/patient/dashboard",
        params={"patient_id": patient["id"]},
    )
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()

    active_names = [m["drug_name"] for m in dash_data.get("active_medications", [])]
    past_names = [m["drug_name"] for m in dash_data.get("past_medications", [])]

    assert "Azithromycin" in past_names
    assert "Azithromycin" not in active_names
    assert "Cetirizine" in active_names
    assert "Cetirizine" not in past_names

    # Clean up test documents
    client.delete("/api/v1/patient/document/test-doc-past-med")
    client.delete("/api/v1/patient/document/test-doc-active-med")
