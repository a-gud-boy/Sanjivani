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
    abha_id: str = Field(..., description="14-digit ABHA ID (e.g. 14-1234-5678-9012)")
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
    name: str
    abha_id: str
    phone: Optional[str] = None
    gender: Optional[str] = None
    age_years: Optional[int] = None
    specialization: Optional[str] = None
    license_no: Optional[str] = None


class RegisterResponse(BaseModel):
    status: str
    message: str
    user_type: str
    abha_id: str


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
            detail=f"No {clean_role} account found with ABHA ID '{clean_abha}'. Please check the ID or use the demo credentials.",
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


@router.post("/register", response_model=RegisterResponse)
async def register_user(
    payload: RegisterRequest,
) -> RegisterResponse:
    """
    Placeholder registration endpoint for Patient or Doctor.
    Does not modify database records per user instruction.
    """
    return RegisterResponse(
        status="success",
        message=(
            f"Registration for new {payload.user_type} '{payload.name}' noted. "
            "ABHA National Health Authority sandbox onboarding is simulated in local kiosk mode."
        ),
        user_type=payload.user_type,
        abha_id=payload.abha_id,
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
