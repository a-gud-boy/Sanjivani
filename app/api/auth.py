from datetime import datetime
import logging
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import User

logger = logging.getLogger("sanjivani.api.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Pydantic Request & Response Schemas ────────────────────────────────────────

class RequestOtpRequest(BaseModel):
    abha_id: str = Field(..., description="14-digit ABHA ID (e.g. 14-XXXX-XXXX-XXXX)")
    user_type: str = Field(default="patient", description="'patient' or 'doctor'")


class RequestOtpResponse(BaseModel):
    status: str
    message: str
    masked_phone: Optional[str] = None
    simulated_otp: str
    abha_id: str
    user_name: str
    user_type: str


class VerifyOtpRequest(BaseModel):
    abha_id: str = Field(..., description="14-digit ABHA ID")
    otp: str = Field(..., description="6-digit verification code")
    user_type: str = Field(default="patient", description="'patient' or 'doctor'")


class UserProfileResponse(BaseModel):
    id: str
    abha_id: str
    user_type: str
    name: str
    gender: Optional[str] = None
    age_years: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    patient_details: Optional[Dict[str, Any]] = None
    doctor_details: Optional[Dict[str, Any]] = None


class VerifyOtpResponse(BaseModel):
    status: str
    token: str
    user: UserProfileResponse


class RegisterRequest(BaseModel):
    user_type: str = Field(default="patient", description="'patient' or 'doctor'")
    name: str = Field(..., min_length=2, description="Full legal name of the user")
    abha_id: str = Field(..., min_length=8, description="14-digit ABHA Health ID")
    phone: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = Field(default="Male", description="'Male', 'Female', or 'Other'")
    age_years: Optional[int] = None
    dob: Optional[str] = None

    # Patient demographics
    blood_group: Optional[str] = None
    address_line: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None

    # Doctor credentials
    specialization: Optional[str] = None
    license_no: Optional[str] = None
    hospital: Optional[str] = None
    department: Optional[str] = None
    qualifications: Optional[str] = None


class RegisterResponse(BaseModel):
    status: str
    message: str
    user_type: str
    abha_id: str
    token: Optional[str] = None
    user: Optional[UserProfileResponse] = None


# ── Helper util ────────────────────────────────────────────────────────────────

def mask_phone(phone: Optional[str]) -> Optional[str]:
    if not phone or len(phone) < 4:
        return "+91 ******1234"
    return f"+91 ******{phone[-4:]}"


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/request-otp", response_model=RequestOtpResponse)
async def request_otp(
    payload: RequestOtpRequest,
    db: AsyncSession = Depends(get_db),
) -> RequestOtpResponse:
    """
    Simulate ABHA OTP generation for registered patients or doctors.
    """
    clean_abha = payload.abha_id.strip()
    clean_role = payload.user_type.strip().lower()

    stmt = select(User).where(
        User.abha_id == clean_abha,
        User.user_type == clean_role,
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {clean_role} account found with ABHA ID '{clean_abha}'. Please check the ID or register a new account.",
        )

    # Return a deterministic test OTP so the user can test without external SMS delays
    simulated_otp = "123456"

    return RequestOtpResponse(
        status="success",
        message=f"OTP dispatched to mobile linked with ABHA {clean_abha}.",
        masked_phone=mask_phone(user.phone),
        simulated_otp=simulated_otp,
        abha_id=user.abha_id,
        user_name=user.name,
        user_type=user.user_type,
    )


@router.post("/verify-otp", response_model=VerifyOtpResponse)
async def verify_otp(
    payload: VerifyOtpRequest,
    db: AsyncSession = Depends(get_db),
) -> VerifyOtpResponse:
    """
    Verify ABHA OTP code and issue authenticated user profile session.
    """
    clean_abha = payload.abha_id.strip()
    clean_role = payload.user_type.strip().lower()
    clean_otp = payload.otp.strip()

    stmt = select(User).where(
        User.abha_id == clean_abha,
        User.user_type == clean_role,
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Account with ABHA ID '{clean_abha}' not found.",
        )

    # Validate OTP (allow 123456 or any 6-digit number in kiosk demo mode)
    if clean_otp != "123456" and not (len(clean_otp) == 6 and clean_otp.isdigit()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code. Please enter '123456'.",
        )

    session_token = f"sanjivani-token-{uuid.uuid4()}"

    user_profile = UserProfileResponse(
        id=user.id,
        abha_id=user.abha_id,
        user_type=user.user_type,
        name=user.name,
        gender=user.gender,
        age_years=user.age_years,
        phone=user.phone,
        email=user.email,
        patient_details=user.patient_details,
        doctor_details=user.doctor_details,
    )

    return VerifyOtpResponse(
        status="success",
        token=session_token,
        user=user_profile,
    )


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Patient or Doctor with persistent ABHA profile",
)
async def register_user(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    """
    Self-register a new Patient or Doctor profile in the national health database.
    Prevents duplicate ABHA registrations and automatically initializes clinical records.
    """
    clean_abha = payload.abha_id.strip()
    clean_role = payload.user_type.strip().lower()
    clean_name = payload.name.strip()

    if clean_role not in ("patient", "doctor"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user_type. Must be 'patient' or 'doctor'.",
        )

    # 1. Prevent duplicate registrations with the same ABHA ID
    existing_stmt = select(User).where(User.abha_id == clean_abha)
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An account with ABHA ID '{clean_abha}' already exists. Please sign in.",
        )

    # 2. Build structured details based on role
    patient_details = None
    doctor_details = None

    if clean_role == "patient":
        calc_dob = payload.dob
        if not calc_dob and payload.age_years:
            calc_dob = f"{datetime.now().year - payload.age_years}-01-01"

        patient_details = {
            "blood_group": payload.blood_group or "O+",
            "dob": calc_dob or "1995-01-01",
            "emergency_contact": {
                "name": payload.emergency_contact_name or "Family Member",
                "phone": payload.emergency_contact_phone or (payload.phone or "9876543210"),
                "relation": payload.emergency_contact_relation or "Guardian",
            },
            "address_line": payload.address_line or "Registered Address",
            "city": payload.city or "New Delhi",
            "state": payload.state or "Delhi",
            "pincode": payload.pincode or "110001",
            "occupation": "Self-Enrolled Citizen",
            "marital_status": "Single",
            "preferred_language": "English / Hindi",
            "allergies": [],
            "chronic_conditions": [],
            "ayush_prakriti": None,
        }
    else:
        # Doctor role
        clean_license = payload.license_no or f"AYUSH-NHA-{clean_abha.replace('-', '')[-6:]}"
        doctor_details = {
            "specialization": payload.specialization or "Ayurvedic Medicine & Clinical Intake",
            "hospital": payload.hospital or "All India Institute of Ayurveda (AIIA)",
            "department": payload.department or "Kayachikitsa (Internal Medicine)",
            "license_no": clean_license,
            "qualifications": payload.qualifications or "BAMS, MD (Ayurveda)",
            "duty_status": "On Duty",
            "opd_hours": "09:00 AM - 04:00 PM",
        }

    # 3. Create persistent User in database
    user_id = f"{clean_role}-{str(uuid.uuid4())[:8]}"
    new_user = User(
        id=user_id,
        abha_id=clean_abha,
        user_type=clean_role,
        name=clean_name,
        gender=payload.gender or "Male",
        age_years=payload.age_years or 30,
        phone=payload.phone or "9876543210",
        email=payload.email or f"{clean_abha.replace('-', '')[-6:]}@abha.gov.in",
        patient_details=patient_details,
        doctor_details=doctor_details,
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # 4. Generate immediate authenticated session token
    session_token = f"sanjivani-token-{uuid.uuid4()}"

    user_profile = UserProfileResponse(
        id=new_user.id,
        abha_id=new_user.abha_id,
        user_type=new_user.user_type,
        name=new_user.name,
        gender=new_user.gender,
        age_years=new_user.age_years,
        phone=new_user.phone,
        email=new_user.email,
        patient_details=new_user.patient_details,
        doctor_details=new_user.doctor_details,
    )

    logger.info("Successfully registered new %s: %s (%s)", clean_role, clean_name, clean_abha)

    return RegisterResponse(
        status="success",
        message=f"ABHA profile for {new_user.name} successfully registered in National Health Database.",
        user_type=new_user.user_type,
        abha_id=new_user.abha_id,
        token=session_token,
        user=user_profile,
    )


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    user_id: Optional[str] = None,
    x_user_id: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> UserProfileResponse:
    """
    Fetch active authenticated user profile.
    """
    target_id = user_id or x_user_id
    if not target_id:
        # Fallback to default demo patient if no ID supplied
        target_id = "patient-demo-001"

    stmt = select(User).where(User.id == target_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    return UserProfileResponse(
        id=user.id,
        abha_id=user.abha_id,
        user_type=user.user_type,
        name=user.name,
        gender=user.gender,
        age_years=user.age_years,
        phone=user.phone,
        email=user.email,
        patient_details=user.patient_details,
        doctor_details=user.doctor_details,
    )
