"""
FastAPI Authentication and Authorization Dependencies.
Remediates SEC-02 (Broken Object Level Authorization) across medical endpoints.
"""
import logging
from typing import Optional, Union, Tuple
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.database import get_db
from app.db.models import Doctor, Patient

logger = logging.getLogger("sanjivani.api.deps")

# HTTP Bearer authentication scheme
security_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> Union[Patient, Doctor]:
    """
    Extract and validate JWT token from 'Authorization: Bearer <token>' header.
    Returns the authenticated Patient or Doctor database instance.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Bearer token required in Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials.strip()
    payload = decode_access_token(token)

    user_id: Optional[str] = payload.get("sub")
    role: Optional[str] = payload.get("role")

    if not user_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload: missing user ID or role claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if role == "patient":
        stmt = select(Patient).where((Patient.id == user_id) | (Patient.abha_id == user_id))
        result = await db.execute(stmt)
        patient = result.scalar_one_or_none()
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Patient account associated with this token was not found.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return patient

    elif role == "doctor":
        stmt = select(Doctor).where((Doctor.id == user_id) | (Doctor.hp_id == user_id))
        result = await db.execute(stmt)
        doctor = result.scalar_one_or_none()
        if not doctor:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Doctor account associated with this token was not found.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return doctor

    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Unrecognized role claim '{role}' in token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_patient_user(
    current_user: Union[Patient, Doctor] = Depends(get_current_user),
) -> Patient:
    """
    Dependency that enforces the authenticated user is a Patient.
    """
    if not isinstance(current_user, Patient):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Patient account required.",
        )
    return current_user


async def require_doctor_user(
    current_user: Union[Patient, Doctor] = Depends(get_current_user),
) -> Doctor:
    """
    Dependency that enforces the authenticated user is a verified Doctor / Clinician.
    """
    if not isinstance(current_user, Doctor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Doctor / Clinician account required to access clinical registry.",
        )
    return current_user
