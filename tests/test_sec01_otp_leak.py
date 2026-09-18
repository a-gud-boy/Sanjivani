"""
Tests for SEC-01: Plaintext OTP Leakage in HTTP Responses Remediation.

Verifies:
1. In production (or when DEBUG=False), /auth/patient/request-otp NEVER returns plaintext OTP or simulated_otp.
2. In production (or when DEBUG=False), /auth/doctor/request-otp NEVER returns plaintext OTP or simulated_otp.
3. Defense in depth: Even if DEBUG=True, setting ENVIRONMENT='production' suppresses OTP in responses.
4. When DEBUG=True and ENVIRONMENT='development', simulated_otp is returned for testing convenience.
5. The generated OTP remains functional and can be verified by the user via /auth/verify-otp.
6. Verification immediately invalidates the OTP preventing replay attacks.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.api.auth import get_active_otp, _ACTIVE_OTPS

client = TestClient(app)

SEC_TEST_PATIENT_ABHA = "14-9999-8888-7777"
SEC_TEST_DOCTOR_HP_ID = "HP-SEC-01010"


def _ensure_sec_patient():
    client.post(
        "/api/v1/auth/register",
        json={
            "user_type": "patient",
            "name": "SecTest Patient",
            "abha_id": SEC_TEST_PATIENT_ABHA,
            "phone": "9811122233",
            "gender": "Female",
            "age_years": 29,
        },
    )


def _ensure_sec_doctor():
    client.post(
        "/api/v1/auth/doctor/register",
        json={
            "name": "Dr. SecTest Doctor",
            "hp_id": SEC_TEST_DOCTOR_HP_ID,
            "phone": "9811122244",
            "specialization": "Kayachikitsa",
            "license_no": "AYUSH-SEC-01",
            "hospital": "AIIMS Ayush",
        },
    )


def test_sec01_patient_otp_redacted_when_debug_false(monkeypatch):
    """Verify that when DEBUG=False, patient OTP is not leaked in response."""
    _ensure_sec_patient()
    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    resp = client.post(
        "/api/v1/auth/patient/request-otp",
        json={"abha_id": SEC_TEST_PATIENT_ABHA},
    )
    assert resp.status_code == 200
    data = resp.json()

    # SEC-01 Assertion: Plaintext OTP MUST be None
    assert data["otp"] is None, "CRITICAL: Plaintext OTP was leaked in HTTP response with DEBUG=False!"
    assert data["simulated_otp"] is None, "CRITICAL: simulated_otp was leaked in HTTP response with DEBUG=False!"
    assert data["status"] == "success"
    assert data["masked_phone"] == "+91 ******2233"

    # Verify that the OTP was still generated and stored securely on server
    active_code = get_active_otp(SEC_TEST_PATIENT_ABHA)
    assert active_code is not None
    assert len(active_code) == 6
    assert active_code.isdigit()

    # Verify that login works with the actual OTP
    verify_resp = client.post(
        "/api/v1/auth/patient/verify-otp",
        json={"abha_id": SEC_TEST_PATIENT_ABHA, "otp": active_code},
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["status"] == "success"


def test_sec01_doctor_otp_redacted_when_debug_false(monkeypatch):
    """Verify that when DEBUG=False, doctor OTP is not leaked in response."""
    _ensure_sec_doctor()
    monkeypatch.setattr(settings, "DEBUG", False)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    resp = client.post(
        "/api/v1/auth/doctor/request-otp",
        json={"hp_id": SEC_TEST_DOCTOR_HP_ID},
    )
    assert resp.status_code == 200
    data = resp.json()

    # SEC-01 Assertion: Plaintext OTP MUST be None
    assert data["otp"] is None, "CRITICAL: Plaintext Doctor OTP was leaked in HTTP response with DEBUG=False!"
    assert data["simulated_otp"] is None, "CRITICAL: simulated_otp was leaked in HTTP response with DEBUG=False!"
    assert data["status"] == "success"
    assert data["masked_phone"] == "+91 ******2244"

    # Verify doctor can still log in with the real OTP
    active_code = get_active_otp(SEC_TEST_DOCTOR_HP_ID)
    assert active_code is not None
    verify_resp = client.post(
        "/api/v1/auth/doctor/verify-otp",
        json={"hp_id": SEC_TEST_DOCTOR_HP_ID, "otp": active_code},
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["status"] == "success"


def test_sec01_otp_redacted_in_production_even_if_debug_is_true(monkeypatch):
    """Defense-in-depth: If ENVIRONMENT=production, OTP is never leaked even if DEBUG=True."""
    _ensure_sec_patient()
    monkeypatch.setattr(settings, "DEBUG", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    resp = client.post(
        "/api/v1/auth/patient/request-otp",
        json={"abha_id": SEC_TEST_PATIENT_ABHA},
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["otp"] is None, "CRITICAL: Plaintext OTP leaked in PRODUCTION response!"
    assert data["simulated_otp"] is None, "CRITICAL: simulated_otp leaked in PRODUCTION response!"


def test_sec01_otp_exposed_only_in_development_with_debug_true(monkeypatch):
    """Developer simulator convenience: Only when ENVIRONMENT=development AND DEBUG=True is OTP returned."""
    _ensure_sec_patient()
    monkeypatch.setattr(settings, "DEBUG", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    resp = client.post(
        "/api/v1/auth/patient/request-otp",
        json={"abha_id": SEC_TEST_PATIENT_ABHA},
    )
    assert resp.status_code == 200
    data = resp.json()

    # In local debug mode, developer convenience is preserved
    assert data["otp"] is not None
    assert data["simulated_otp"] is not None
    assert data["otp"] == data["simulated_otp"]
    assert len(data["otp"]) == 6
    assert data["otp"] == get_active_otp(SEC_TEST_PATIENT_ABHA)


def test_sec01_otp_replay_attack_prevention():
    """Verify that an OTP cannot be reused once verified."""
    _ensure_sec_patient()
    client.post(
        "/api/v1/auth/patient/request-otp",
        json={"abha_id": SEC_TEST_PATIENT_ABHA},
    )
    active_code = get_active_otp(SEC_TEST_PATIENT_ABHA)
    assert active_code is not None

    # First verification succeeds
    first_verify = client.post(
        "/api/v1/auth/patient/verify-otp",
        json={"abha_id": SEC_TEST_PATIENT_ABHA, "otp": active_code},
    )
    assert first_verify.status_code == 200

    # Second verification with same OTP must fail (HTTP 400)
    second_verify = client.post(
        "/api/v1/auth/patient/verify-otp",
        json={"abha_id": SEC_TEST_PATIENT_ABHA, "otp": active_code},
    )
    assert second_verify.status_code == 400
    assert "Invalid or expired OTP" in second_verify.json()["detail"]
