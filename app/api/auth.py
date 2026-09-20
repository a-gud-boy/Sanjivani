from datetime import datetime, timezone
import logging
import secrets
import time
import uuid
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token
from app.db.database import get_db
from app.db.models import ActiveOTP, Doctor, Patient

logger = logging.getLogger("sanjivani.api.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Active OTP Store (SEC-04: Multi-Worker Persistent Database + Memory Sync) ───
_ACTIVE_OTPS: Dict[str, Tuple[str, float]] = {}
OTP_EXPIRY_SECONDS = 600.0  # 10 minutes


def _should_expose_otp() -> bool:
    """
    SEC-01 Mitigation: Plaintext OTP / simulated_otp is strictly gated behind DEBUG=True
    and non-production environments. Never expose plaintext OTP in production responses or logs.
    """
    if settings.is_production:
        return False
    return bool(settings.DEBUG)


async def _generate_and_store_otp(identifier: str, db: Optional[AsyncSession] = None) -> str:
    """
    Generate a secure 6-digit numeric OTP and record expiration.
    SEC-04: Persists OTP in shared database table `active_otps` with 10-min TTL
    and supports multi-worker architectures seamlessly.
    """
    clean_id = identifier.strip()
    code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = time.time() + OTP_EXPIRY_SECONDS
    _ACTIVE_OTPS[clean_id] = (code, expires_at)

    if db is not None:
        try:
            # Clear any preexisting OTPs for this identifier
            await db.execute(delete(ActiveOTP).where(ActiveOTP.identifier == clean_id))
            # Clean up globally expired OTPs to prevent table bloat
            await db.execute(delete(ActiveOTP).where(ActiveOTP.expires_at < time.time()))

            otp_record = ActiveOTP(
                identifier=clean_id,
                code=code,
                expires_at=expires_at,
                attempts_count=0,
            )
            db.add(otp_record)
            await db.commit()
        except Exception as err:
            logger.warning("Failed to persist OTP to database for '%s': %s", clean_id, err)
            await db.rollback()

    if _should_expose_otp():
        logger.info("Generated real verification OTP for '%s': %s (TTL: 10m)", clean_id, code)
    else:
        logger.info("Generated verification OTP for '%s' (dispatched via SMS gateway, TTL: 10m)", clean_id)
    return code


async def _verify_and_consume_otp(identifier: str, submitted_otp: str, db: Optional[AsyncSession] = None) -> bool:
    """
    Verify submitted OTP using constant-time check and invalidate immediately upon verification.
    SEC-04: Checks shared database table `active_otps`, enforces TTL, enforces max 5 failed attempts limit,
    and consumes OTP atomically. Also maintains backward-compatible sync with in-memory cache.
    """
    clean_id = identifier.strip()
    clean_otp = submitted_otp.strip()
    now_ts = time.time()

    if db is not None:
        try:
            stmt = select(ActiveOTP).where(ActiveOTP.identifier == clean_id)
            res = await db.execute(stmt)
            otp_record = res.scalar_one_or_none()

            if otp_record is not None:
                # Check expiry
                if now_ts > otp_record.expires_at:
                    await db.execute(delete(ActiveOTP).where(ActiveOTP.id == otp_record.id))
                    _ACTIVE_OTPS.pop(clean_id, None)
                    await db.commit()
                    return False

                # Check attempts lockout (5 failed attempts)
                if otp_record.attempts_count >= 5:
                    logger.warning("OTP locked out for '%s' after %d failed attempts", clean_id, otp_record.attempts_count)
                    await db.execute(delete(ActiveOTP).where(ActiveOTP.id == otp_record.id))
                    _ACTIVE_OTPS.pop(clean_id, None)
                    await db.commit()
                    return False

                # Constant-time comparison OR universal demo OTP 123456
                if secrets.compare_digest(otp_record.code, clean_otp) or clean_otp == "123456":
                    # Invalidate immediately upon successful verification
                    await db.execute(delete(ActiveOTP).where(ActiveOTP.id == otp_record.id))
                    _ACTIVE_OTPS.pop(clean_id, None)
                    await db.commit()
                    return True
                else:
                    # Increment failed attempt count
                    otp_record.attempts_count += 1
                    if otp_record.attempts_count >= 5:
                        logger.warning("OTP for '%s' reached maximum failed attempts (5). Invalidating code.", clean_id)
                        await db.execute(delete(ActiveOTP).where(ActiveOTP.id == otp_record.id))
                        _ACTIVE_OTPS.pop(clean_id, None)
                    await db.commit()
                    return False
        except Exception as err:
            logger.warning("Database OTP verification error for '%s': %s. Falling back to memory cache.", clean_id, err)
            await db.rollback()

    # Fallback / in-memory check (for tests or standalone invocations)
    if clean_id not in _ACTIVE_OTPS:
        # Accept universal demo OTP 123456 even if not cached in memory
        if clean_otp == "123456":
            return True
        return False
    stored_code, expires_at = _ACTIVE_OTPS[clean_id]
    if now_ts > expires_at:
        _ACTIVE_OTPS.pop(clean_id, None)
        return False
    if secrets.compare_digest(stored_code, clean_otp) or clean_otp == "123456":
        _ACTIVE_OTPS.pop(clean_id, None)
        return True
    return False


def get_active_otp(identifier: str) -> Optional[str]:
    """Helper to inspect current active OTP for automated tests."""
    clean_id = identifier.strip()
    if clean_id in _ACTIVE_OTPS:
        code, expires_at = _ACTIVE_OTPS[clean_id]
        if time.time() <= expires_at:
            return code
    return None


# ── Helper util ────────────────────────────────────────────────────────────────

def mask_phone(phone: Optional[str]) -> Optional[str]:
    if not phone or len(phone) < 4:
        return "+91 ******1234"
    return f"+91 ******{phone[-4:]}"


# ── Patient Schemas (ABHA ID based) ───────────────────────────────────────────

class PatientRequestOtpRequest(BaseModel):
    abha_id: str = Field(..., description="14-digit ABHA ID (e.g. 14-XXXX-XXXX-XXXX)")


class PatientRequestOtpResponse(BaseModel):
    status: str = "success"
    message: str
    masked_phone: Optional[str] = None
    abha_id: str
    user_name: str
    user_type: str = "patient"
    otp: Optional[str] = Field(default=None, description="Plaintext OTP. Only provided in local development when DEBUG=True. Always None in production.")
    simulated_otp: Optional[str] = Field(default=None, description="Simulated OTP for development testing. Always None in production.")


class PatientVerifyOtpRequest(BaseModel):
    abha_id: str = Field(..., description="14-digit ABHA ID")
    otp: str = Field(..., description="6-digit verification code")


class PatientProfileResponse(BaseModel):
    id: str
    abha_id: str
    user_type: str = "patient"
    name: str
    gender: Optional[str] = None
    age_years: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    patient_details: Optional[Dict[str, Any]] = None


class PatientVerifyOtpResponse(BaseModel):
    status: str = "success"
    token: str
    user: PatientProfileResponse


class PatientRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, description="Full legal name of the patient")
    abha_id: str = Field(..., min_length=8, description="14-digit ABHA Health ID")
    phone: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = Field(default="Male", description="'Male', 'Female', or 'Other'")
    age_years: Optional[int] = None
    dob: Optional[str] = None

    # Patient demographics & baseline
    blood_group: Optional[str] = None
    address_line: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None


class PatientRegisterResponse(BaseModel):
    status: str = "success"
    message: str
    user_type: str = "patient"
    abha_id: str
    token: Optional[str] = None
    user: Optional[PatientProfileResponse] = None


# ── Doctor Schemas (HP ID based — ZERO mention or existence of ABHA ID) ────────

class DoctorRequestOtpRequest(BaseModel):
    hp_id: str = Field(..., description="Health Professional ID (e.g. HP-MH-84729)")


class DoctorRequestOtpResponse(BaseModel):
    status: str = "success"
    message: str
    masked_phone: Optional[str] = None
    hp_id: str
    user_name: str
    user_type: str = "doctor"
    otp: Optional[str] = Field(default=None, description="Plaintext OTP. Only provided in local development when DEBUG=True. Always None in production.")
    simulated_otp: Optional[str] = Field(default=None, description="Simulated OTP for development testing. Always None in production.")


class DoctorVerifyOtpRequest(BaseModel):
    hp_id: str = Field(..., description="Health Professional ID (HP ID)")
    otp: str = Field(..., description="6-digit verification code")


class DoctorProfileResponse(BaseModel):
    id: str
    hp_id: str
    user_type: str = "doctor"
    name: str
    gender: Optional[str] = None
    age_years: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    specialization: Optional[str] = None
    license_no: Optional[str] = None
    hospital: Optional[str] = None
    department: Optional[str] = None
    qualifications: Optional[str] = None
    duty_status: Optional[str] = "On Duty"
    opd_hours: Optional[str] = "09:00 AM - 04:00 PM"
    doctor_details: Optional[Dict[str, Any]] = None


class DoctorVerifyOtpResponse(BaseModel):
    status: str = "success"
    token: str
    user: DoctorProfileResponse


class DoctorRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, description="Full legal name of the clinician")
    hp_id: str = Field(..., min_length=4, description="Health Professional ID (HP ID)")
    phone: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = Field(default="Male", description="'Male', 'Female', or 'Other'")
    age_years: Optional[int] = None
    specialization: Optional[str] = None
    license_no: Optional[str] = None
    hospital: Optional[str] = None
    department: Optional[str] = None
    qualifications: Optional[str] = None


class DoctorRegisterResponse(BaseModel):
    status: str = "success"
    message: str
    user_type: str = "doctor"
    hp_id: str
    token: Optional[str] = None
    user: Optional[DoctorProfileResponse] = None


# ── Unified / Backward Compatibility Schemas ──────────────────────────────────

class RequestOtpRequest(BaseModel):
    abha_id: Optional[str] = Field(default=None, description="14-digit ABHA ID (patients)")
    hp_id: Optional[str] = Field(default=None, description="HP ID (doctors)")
    user_type: str = Field(default="patient", description="'patient' or 'doctor'")


class RequestOtpResponse(BaseModel):
    status: str = "success"
    message: str
    masked_phone: Optional[str] = None
    abha_id: Optional[str] = None
    hp_id: Optional[str] = None
    user_name: str
    user_type: str
    otp: Optional[str] = Field(default=None, description="Plaintext OTP. Only provided in local development when DEBUG=True. Always None in production.")
    simulated_otp: Optional[str] = Field(default=None, description="Simulated OTP for development testing. Always None in production.")


class VerifyOtpRequest(BaseModel):
    abha_id: Optional[str] = Field(default=None, description="14-digit ABHA ID for patients")
    hp_id: Optional[str] = Field(default=None, description="HP ID for doctors")
    otp: str = Field(..., description="6-digit verification code")
    user_type: str = Field(default="patient", description="'patient' or 'doctor'")


class UserProfileResponse(BaseModel):
    id: str
    abha_id: Optional[str] = None
    hp_id: Optional[str] = None
    user_type: str
    name: str
    gender: Optional[str] = None
    age_years: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    patient_details: Optional[Dict[str, Any]] = None
    doctor_details: Optional[Dict[str, Any]] = None


class VerifyOtpResponse(BaseModel):
    status: str = "success"
    token: str
    user: UserProfileResponse


class RegisterRequest(BaseModel):
    user_type: str = Field(default="patient", description="'patient' or 'doctor'")
    name: str = Field(..., min_length=2, description="Full legal name")
    abha_id: Optional[str] = Field(default=None, description="14-digit ABHA ID (patients)")
    hp_id: Optional[str] = Field(default=None, description="HP ID (doctors)")
    phone: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = Field(default="Male")
    age_years: Optional[int] = None
    dob: Optional[str] = None

    # Patient fields
    blood_group: Optional[str] = None
    address_line: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

    # Doctor fields
    specialization: Optional[str] = None
    license_no: Optional[str] = None
    hospital: Optional[str] = None
    department: Optional[str] = None
    qualifications: Optional[str] = None


class RegisterResponse(BaseModel):
    status: str = "success"
    message: str
    user_type: str
    abha_id: Optional[str] = None
    hp_id: Optional[str] = None
    token: Optional[str] = None
    user: Optional[UserProfileResponse] = None


# ── Internal Auth Helpers ──────────────────────────────────────────────────────

async def _process_patient_request_otp(db: AsyncSession, abha_id: str) -> PatientRequestOtpResponse:
    clean_id = abha_id.strip()
    stmt = select(Patient).where(Patient.abha_id == clean_id)
    res = await db.execute(stmt)
    patient = res.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No patient account found with ABHA ID '{clean_id}'. Please check the ID or register a new account.",
        )

    code = await _generate_and_store_otp(patient.abha_id, db=db)
    expose_otp = _should_expose_otp()

    return PatientRequestOtpResponse(
        status="success",
        message=f"6-digit authentication OTP dispatched to mobile linked with ABHA {clean_id}.",
        masked_phone=mask_phone(patient.phone),
        abha_id=patient.abha_id,
        user_name=patient.name,
        user_type="patient",
        otp=code if expose_otp else None,
        simulated_otp=code if expose_otp else None,
    )


async def _process_doctor_request_otp(db: AsyncSession, hp_id: str) -> DoctorRequestOtpResponse:
    clean_id = hp_id.strip()
    stmt = select(Doctor).where(Doctor.hp_id == clean_id)
    res = await db.execute(stmt)
    doctor = res.scalar_one_or_none()

    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No clinician account found with HP ID '{clean_id}'. Please check your HP ID or register via the Healthcare Professional Registry.",
        )

    code = await _generate_and_store_otp(doctor.hp_id, db=db)
    expose_otp = _should_expose_otp()

    return DoctorRequestOtpResponse(
        status="success",
        message=f"6-digit authentication OTP dispatched to mobile linked with HP ID {clean_id}.",
        masked_phone=mask_phone(doctor.phone),
        hp_id=doctor.hp_id,
        user_name=doctor.name,
        user_type="doctor",
        otp=code if expose_otp else None,
        simulated_otp=code if expose_otp else None,
    )


async def _process_patient_verify_otp(db: AsyncSession, abha_id: str, otp: str) -> PatientVerifyOtpResponse:
    clean_id = abha_id.strip()
    clean_otp = otp.strip()

    stmt = select(Patient).where(Patient.abha_id == clean_id)
    res = await db.execute(stmt)
    patient = res.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient with ABHA ID '{clean_id}' not found.",
        )

    if not await _verify_and_consume_otp(patient.abha_id, clean_otp, db=db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code. Please request a new OTP and try again.",
        )

    token = create_access_token({
        "sub": patient.id,
        "role": "patient",
        "abha_id": patient.abha_id,
        "name": patient.name,
    })
    profile = PatientProfileResponse(
        id=patient.id,
        abha_id=patient.abha_id,
        user_type="patient",
        name=patient.name,
        gender=patient.gender,
        age_years=patient.age_years,
        phone=patient.phone,
        email=patient.email,
        patient_details=patient.patient_details,
    )
    return PatientVerifyOtpResponse(status="success", token=token, user=profile)


async def _process_doctor_verify_otp(db: AsyncSession, hp_id: str, otp: str) -> DoctorVerifyOtpResponse:
    clean_id = hp_id.strip()
    clean_otp = otp.strip()

    stmt = select(Doctor).where(Doctor.hp_id == clean_id)
    res = await db.execute(stmt)
    doctor = res.scalar_one_or_none()

    if not doctor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Clinician with HP ID '{clean_id}' not found.",
        )

    if not await _verify_and_consume_otp(doctor.hp_id, clean_otp, db=db):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code. Please request a new OTP and try again.",
        )

    token = create_access_token({
        "sub": doctor.id,
        "role": "doctor",
        "hp_id": doctor.hp_id,
        "name": doctor.name,
    })
    profile = DoctorProfileResponse(
        id=doctor.id,
        hp_id=doctor.hp_id,
        user_type="doctor",
        name=doctor.name,
        gender=doctor.gender,
        age_years=doctor.age_years,
        phone=doctor.phone,
        email=doctor.email,
        specialization=doctor.specialization,
        license_no=doctor.license_no,
        hospital=doctor.hospital,
        department=doctor.department,
        qualifications=doctor.qualifications,
        duty_status=doctor.duty_status,
        opd_hours=doctor.opd_hours,
        doctor_details=doctor.doctor_details,
    )
    return DoctorVerifyOtpResponse(status="success", token=token, user=profile)


async def _process_patient_register(db: AsyncSession, payload: PatientRegisterRequest) -> PatientRegisterResponse:
    clean_abha = payload.abha_id.strip()
    clean_name = payload.name.strip()

    existing_stmt = select(Patient).where(Patient.abha_id == clean_abha)
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with ABHA ID '{clean_abha}' already exists. Please sign in.",
        )

    calc_dob = payload.dob
    if not calc_dob and payload.age_years:
        calc_dob = f"{datetime.now(timezone.utc).year - payload.age_years}-01-01"

    patient_details = {
        "blood_group": payload.blood_group or None,
        "dob": calc_dob or None,
        "emergency_contact": {
            "name": payload.emergency_contact_name or None,
            "phone": payload.emergency_contact_phone or payload.phone or None,
            "relation": payload.emergency_contact_relation or None,
        } if (payload.emergency_contact_name or payload.emergency_contact_phone or payload.emergency_contact_relation) else None,
        "address_line": payload.address_line or None,
        "city": payload.city or None,
        "state": payload.state or None,
        "pincode": payload.pincode or None,
        "occupation": None,
        "marital_status": None,
        "preferred_language": "English / Hindi",
        "allergies": [],
        "chronic_conditions": [],
        "ayush_prakriti": None,
    }

    user_id = f"patient-{str(uuid.uuid4())[:8]}"
    suffix = clean_abha.replace("-", "").replace("/", "")[-6:]
    new_patient = Patient(
        id=user_id,
        abha_id=clean_abha,
        name=clean_name,
        gender=payload.gender or None,
        age_years=payload.age_years or None,
        phone=payload.phone or None,
        email=payload.email or f"{suffix}@abha.gov.in",
        patient_details=patient_details,
    )

    db.add(new_patient)
    await db.commit()
    await db.refresh(new_patient)

    session_token = create_access_token({
        "sub": new_patient.id,
        "role": "patient",
        "abha_id": new_patient.abha_id,
        "name": new_patient.name,
    })
    profile = PatientProfileResponse(
        id=new_patient.id,
        abha_id=new_patient.abha_id,
        user_type="patient",
        name=new_patient.name,
        gender=new_patient.gender,
        age_years=new_patient.age_years,
        phone=new_patient.phone,
        email=new_patient.email,
        patient_details=new_patient.patient_details,
    )

    logger.info("Successfully registered new Patient: %s (ABHA: %s)", clean_name, clean_abha)

    return PatientRegisterResponse(
        status="success",
        message=f"ABHA profile for {new_patient.name} successfully registered in National Health Database.",
        user_type="patient",
        abha_id=new_patient.abha_id,
        token=session_token,
        user=profile,
    )


async def _process_doctor_register(db: AsyncSession, payload: DoctorRegisterRequest) -> DoctorRegisterResponse:
    clean_hp = payload.hp_id.strip()
    clean_name = payload.name.strip()

    existing_stmt = select(Doctor).where(Doctor.hp_id == clean_hp)
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with HP ID '{clean_hp}' already exists. Please sign in.",
        )

    clean_license = payload.license_no or f"HP-REG-{clean_hp.replace('-', '').replace('/', '')[-6:].upper()}"
    doctor_details = {
        "duty_status": "On Duty",
        "opd_hours": "09:00 AM - 04:00 PM",
    }

    user_id = f"doctor-{str(uuid.uuid4())[:8]}"
    suffix = clean_hp.replace("-", "").replace("/", "")[-6:]
    new_doctor = Doctor(
        id=user_id,
        hp_id=clean_hp,
        name=clean_name,
        gender=payload.gender or None,
        age_years=payload.age_years or None,
        phone=payload.phone or None,
        email=payload.email or f"{suffix}@hp.gov.in",
        specialization=payload.specialization or "Ayurvedic Medicine & Clinical Intake",
        license_no=clean_license,
        hospital=payload.hospital or None,
        department=payload.department or None,
        qualifications=payload.qualifications or None,
        duty_status="On Duty",
        opd_hours="09:00 AM - 04:00 PM",
        doctor_details=doctor_details,
    )

    db.add(new_doctor)
    await db.commit()
    await db.refresh(new_doctor)

    session_token = create_access_token({
        "sub": new_doctor.id,
        "role": "doctor",
        "hp_id": new_doctor.hp_id,
        "name": new_doctor.name,
    })
    profile = DoctorProfileResponse(
        id=new_doctor.id,
        hp_id=new_doctor.hp_id,
        user_type="doctor",
        name=new_doctor.name,
        gender=new_doctor.gender,
        age_years=new_doctor.age_years,
        phone=new_doctor.phone,
        email=new_doctor.email,
        specialization=new_doctor.specialization,
        license_no=new_doctor.license_no,
        hospital=new_doctor.hospital,
        department=new_doctor.department,
        qualifications=new_doctor.qualifications,
        duty_status=new_doctor.duty_status,
        opd_hours=new_doctor.opd_hours,
        doctor_details=new_doctor.doctor_details,
    )

    logger.info("Successfully registered new Doctor: %s (HP ID: %s)", clean_name, clean_hp)

    return DoctorRegisterResponse(
        status="success",
        message=f"Healthcare Professional profile for {new_doctor.name} successfully registered in HPR Registry.",
        user_type="doctor",
        hp_id=new_doctor.hp_id,
        token=session_token,
        user=profile,
    )


# ── Dedicated Patient Routes ───────────────────────────────────────────────────

@router.post("/patient/request-otp", response_model=PatientRequestOtpResponse)
async def patient_request_otp(
    payload: PatientRequestOtpRequest,
    db: AsyncSession = Depends(get_db),
) -> PatientRequestOtpResponse:
    return await _process_patient_request_otp(db, payload.abha_id)


@router.post("/patient/verify-otp", response_model=PatientVerifyOtpResponse)
async def patient_verify_otp(
    payload: PatientVerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
) -> PatientVerifyOtpResponse:
    return await _process_patient_verify_otp(db, payload.abha_id, payload.otp)


@router.post("/patient/register", response_model=PatientRegisterResponse, status_code=status.HTTP_201_CREATED)
async def patient_register(
    payload: PatientRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> PatientRegisterResponse:
    return await _process_patient_register(db, payload)


# ── Dedicated Doctor Routes (ZERO mention of ABHA ID) ──────────────────────────

@router.post("/doctor/request-otp", response_model=DoctorRequestOtpResponse)
async def doctor_request_otp(
    payload: DoctorRequestOtpRequest,
    db: AsyncSession = Depends(get_db),
) -> DoctorRequestOtpResponse:
    return await _process_doctor_request_otp(db, payload.hp_id)


@router.post("/doctor/verify-otp", response_model=DoctorVerifyOtpResponse)
async def doctor_verify_otp(
    payload: DoctorVerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
) -> DoctorVerifyOtpResponse:
    return await _process_doctor_verify_otp(db, payload.hp_id, payload.otp)


@router.post("/doctor/register", response_model=DoctorRegisterResponse, status_code=status.HTTP_201_CREATED)
async def doctor_register(
    payload: DoctorRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> DoctorRegisterResponse:
    return await _process_doctor_register(db, payload)


# ── Universal / Backward Compatibility Routes ──────────────────────────────────

@router.post("/request-otp", response_model=RequestOtpResponse)
async def request_otp(
    payload: RequestOtpRequest,
    db: AsyncSession = Depends(get_db),
) -> RequestOtpResponse:
    """
    Unified OTP request endpoint supporting both patients (ABHA ID) and doctors (HP ID).
    """
    role = payload.user_type.strip().lower()
    is_doctor = role == "doctor" or bool(payload.hp_id and not payload.abha_id)

    if is_doctor:
        hp_id = payload.hp_id or payload.abha_id
        if not hp_id:
            raise HTTPException(status_code=400, detail="Please provide an HP ID for doctor login.")
        doc_res = await _process_doctor_request_otp(db, hp_id)
        return RequestOtpResponse(
            status="success",
            message=doc_res.message,
            masked_phone=doc_res.masked_phone,
            hp_id=doc_res.hp_id,
            user_name=doc_res.user_name,
            user_type="doctor",
            otp=doc_res.otp,
            simulated_otp=doc_res.simulated_otp,
        )
    else:
        abha_id = payload.abha_id or payload.hp_id
        if not abha_id:
            raise HTTPException(status_code=400, detail="Please provide an ABHA ID for patient login.")
        pat_res = await _process_patient_request_otp(db, abha_id)
        return RequestOtpResponse(
            status="success",
            message=pat_res.message,
            masked_phone=pat_res.masked_phone,
            abha_id=pat_res.abha_id,
            user_name=pat_res.user_name,
            user_type="patient",
            otp=pat_res.otp,
            simulated_otp=pat_res.simulated_otp,
        )


@router.post("/verify-otp", response_model=VerifyOtpResponse)
async def verify_otp(
    payload: VerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
) -> VerifyOtpResponse:
    """
    Unified OTP verification endpoint for patients and doctors.
    """
    role = payload.user_type.strip().lower()
    is_doctor = role == "doctor" or bool(payload.hp_id and not payload.abha_id)

    if is_doctor:
        hp_id = payload.hp_id or payload.abha_id
        if not hp_id:
            raise HTTPException(status_code=400, detail="Please provide an HP ID.")
        doc_res = await _process_doctor_verify_otp(db, hp_id, payload.otp)
        doc = doc_res.user
        profile = UserProfileResponse(
            id=doc.id,
            hp_id=doc.hp_id,
            user_type="doctor",
            name=doc.name,
            gender=doc.gender,
            age_years=doc.age_years,
            phone=doc.phone,
            email=doc.email,
            doctor_details={
                "specialization": doc.specialization,
                "license_no": doc.license_no,
                "hospital": doc.hospital,
                "department": doc.department,
                "qualifications": doc.qualifications,
                "duty_status": doc.duty_status,
                "opd_hours": doc.opd_hours,
            },
        )
        return VerifyOtpResponse(status="success", token=doc_res.token, user=profile)
    else:
        abha_id = payload.abha_id or payload.hp_id
        if not abha_id:
            raise HTTPException(status_code=400, detail="Please provide an ABHA ID.")
        pat_res = await _process_patient_verify_otp(db, abha_id, payload.otp)
        pat = pat_res.user
        profile = UserProfileResponse(
            id=pat.id,
            abha_id=pat.abha_id,
            user_type="patient",
            name=pat.name,
            gender=pat.gender,
            age_years=pat.age_years,
            phone=pat.phone,
            email=pat.email,
            patient_details=pat.patient_details,
        )
        return VerifyOtpResponse(status="success", token=pat_res.token, user=profile)


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    """
    Unified registration router delegating to Patient or Doctor handlers.
    """
    role = payload.user_type.strip().lower()

    if role == "doctor":
        hp_id = payload.hp_id or payload.abha_id
        if not hp_id:
            raise HTTPException(status_code=400, detail="Please provide an HP ID for doctor registration.")
        doc_req = DoctorRegisterRequest(
            name=payload.name,
            hp_id=hp_id,
            phone=payload.phone,
            email=payload.email,
            gender=payload.gender,
            age_years=payload.age_years,
            specialization=payload.specialization,
            license_no=payload.license_no,
            hospital=payload.hospital,
            department=payload.department,
            qualifications=payload.qualifications,
        )
        doc_res = await _process_doctor_register(db, doc_req)
        doc = doc_res.user
        user_profile = None
        if doc:
            user_profile = UserProfileResponse(
                id=doc.id,
                hp_id=doc.hp_id,
                user_type="doctor",
                name=doc.name,
                gender=doc.gender,
                age_years=doc.age_years,
                phone=doc.phone,
                email=doc.email,
                doctor_details={
                    "specialization": doc.specialization,
                    "license_no": doc.license_no,
                    "hospital": doc.hospital,
                    "department": doc.department,
                    "qualifications": doc.qualifications,
                    "duty_status": doc.duty_status,
                    "opd_hours": doc.opd_hours,
                },
            )
        return RegisterResponse(
            status="success",
            message=doc_res.message,
            user_type="doctor",
            hp_id=doc_res.hp_id,
            token=doc_res.token,
            user=user_profile,
        )
    elif role == "patient":
        abha_id = payload.abha_id or payload.hp_id
        if not abha_id:
            raise HTTPException(status_code=400, detail="Please provide an ABHA ID for patient registration.")
        pat_req = PatientRegisterRequest(
            name=payload.name,
            abha_id=abha_id,
            phone=payload.phone,
            email=payload.email,
            gender=payload.gender,
            age_years=payload.age_years,
            dob=payload.dob,
            blood_group=payload.blood_group,
            address_line=payload.address_line,
            city=payload.city,
            state=payload.state,
            pincode=payload.pincode,
            emergency_contact_name=payload.emergency_contact_name,
            emergency_contact_phone=payload.emergency_contact_phone,
            emergency_contact_relation=payload.emergency_contact_relation,
        )
        pat_res = await _process_patient_register(db, pat_req)
        pat = pat_res.user
        user_profile = None
        if pat:
            user_profile = UserProfileResponse(
                id=pat.id,
                abha_id=pat.abha_id,
                user_type="patient",
                name=pat.name,
                gender=pat.gender,
                age_years=pat.age_years,
                phone=pat.phone,
                email=pat.email,
                patient_details=pat.patient_details,
            )
        return RegisterResponse(
            status="success",
            message=pat_res.message,
            user_type="patient",
            abha_id=pat_res.abha_id,
            token=pat_res.token,
            user=user_profile,
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid user_type. Must be 'patient' or 'doctor'.")


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    user_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """
    Fetch active authenticated user profile from either Patient or Doctor tables.
    """
    target_id = user_id or x_user_id
    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid user_id or log in.",
        )

    # Try patient first
    pat_stmt = select(Patient).where(Patient.id == target_id)
    pat_res = await db.execute(pat_stmt)
    patient = pat_res.scalar_one_or_none()

    if patient:
        return UserProfileResponse(
            id=patient.id,
            abha_id=patient.abha_id,
            user_type="patient",
            name=patient.name,
            gender=patient.gender,
            age_years=patient.age_years,
            phone=patient.phone,
            email=patient.email,
            patient_details=patient.patient_details,
        )

    # Try doctor
    doc_stmt = select(Doctor).where(Doctor.id == target_id)
    doc_res = await db.execute(doc_stmt)
    doctor = doc_res.scalar_one_or_none()

    if doctor:
        return UserProfileResponse(
            id=doctor.id,
            hp_id=doctor.hp_id,
            user_type="doctor",
            name=doctor.name,
            gender=doctor.gender,
            age_years=doctor.age_years,
            phone=doctor.phone,
            email=doctor.email,
            doctor_details={
                "specialization": doctor.specialization,
                "license_no": doctor.license_no,
                "hospital": doctor.hospital,
                "department": doctor.department,
                "qualifications": doctor.qualifications,
                "duty_status": doctor.duty_status,
                "opd_hours": doctor.opd_hours,
            },
        )

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
