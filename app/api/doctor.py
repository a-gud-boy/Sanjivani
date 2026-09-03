import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.patient import (
    ActiveMedication,
    PatientDashboardResponse,
    SavedDocumentResponse,
    SavedIntakeSessionResponse,
    _aggregate_medications,
)
from app.db.database import get_db
from app.db.models import IntakeSession, PatientDocument, User

logger = logging.getLogger("sanjivani.api.doctor")
router = APIRouter(prefix="/doctor", tags=["Doctor Clinical Oversight Portal"])


# ── Pydantic Models for Doctor View ───────────────────────────────────────────

class LatestSessionSummary(BaseModel):
    id: str
    session_date: datetime
    status: str
    chief_complaint: Optional[Dict[str, Any]] = None
    ai_summary_text: Optional[str] = None
    red_flag_active: bool


class DoctorPatientSummary(BaseModel):
    id: str
    name: str
    abha_id: str
    gender: Optional[str] = None
    age_years: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    patient_details: Optional[Dict[str, Any]] = None
    latest_session: Optional[LatestSessionSummary] = None
    total_documents_count: int = 0
    total_sessions_count: int = 0
    has_red_flags: bool = False
    created_at: datetime


class DoctorPortalStats(BaseModel):
    total_patients: int
    red_flag_patients: int
    total_prescriptions: int
    total_consultations: int


class DoctorPatientsListResponse(BaseModel):
    status: str
    total_patients: int
    stats: DoctorPortalStats
    patients: List[DoctorPatientSummary]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/patients", response_model=DoctorPatientsListResponse)
async def list_all_patients(
    query: Optional[str] = Query(None, description="Optional search term matching patient name or ABHA ID"),
    red_flag_only: bool = Query(False, description="Filter for patients with active red flags"),
    db: AsyncSession = Depends(get_db),
) -> DoctorPatientsListResponse:
    """
    Retrieve all registered patients in the database with their latest intake complaints,
    document counts, triage status, and aggregate portal statistics.
    """
    # 1. Fetch all patients with relationships eager-loaded
    stmt = (
        select(User)
        .where(User.user_type == "patient")
        .options(
            selectinload(User.intake_sessions),
            selectinload(User.documents),
        )
        .order_by(User.created_at.desc())
    )

    result = await db.execute(stmt)
    patients_list = result.scalars().all()

    # 2. Compute aggregate portal statistics across the entire database
    total_patients_count = len(patients_list)
    total_prescriptions_count = 0
    total_consultations_count = 0
    red_flag_patients_count = 0

    patient_summaries: List[DoctorPatientSummary] = []

    clean_query = query.strip().lower() if query else None

    for p in patients_list:
        sessions = p.intake_sessions or []
        docs = p.documents or []

        total_prescriptions_count += len(docs)
        total_consultations_count += len(sessions)

        # Determine red flag status
        has_red = any(s.red_flag_active for s in sessions)
        if has_red:
            red_flag_patients_count += 1

        # Check search filtering
        if clean_query:
            matches_name = clean_query in p.name.lower()
            matches_abha = clean_query in p.abha_id.lower()
            if not (matches_name or matches_abha):
                continue

        if red_flag_only and not has_red:
            continue

        latest_s = sessions[0] if sessions else None
        latest_summary = None
        if latest_s:
            latest_summary = LatestSessionSummary(
                id=latest_s.id,
                session_date=latest_s.session_date,
                status=latest_s.status,
                chief_complaint=latest_s.chief_complaint,
                ai_summary_text=latest_s.ai_summary_text,
                red_flag_active=latest_s.red_flag_active,
            )

        patient_summaries.append(
            DoctorPatientSummary(
                id=p.id,
                name=p.name,
                abha_id=p.abha_id,
                gender=p.gender,
                age_years=p.age_years,
                phone=p.phone,
                email=p.email,
                patient_details=p.patient_details,
                latest_session=latest_summary,
                total_documents_count=len(docs),
                total_sessions_count=len(sessions),
                has_red_flags=has_red,
                created_at=p.created_at,
            )
        )

    stats = DoctorPortalStats(
        total_patients=total_patients_count,
        red_flag_patients=red_flag_patients_count,
        total_prescriptions=total_prescriptions_count,
        total_consultations=total_consultations_count,
    )

    return DoctorPatientsListResponse(
        status="success",
        total_patients=len(patient_summaries),
        stats=stats,
        patients=patient_summaries,
    )


@router.get("/patient/{patient_id}", response_model=PatientDashboardResponse)
async def get_patient_dossier(
    patient_id: str,
    db: AsyncSession = Depends(get_db),
) -> PatientDashboardResponse:
    """
    Retrieve full clinical dossier for a specific patient, allowing the clinician
    to review all historical AI consultation transcripts, scanned prescriptions,
    lab reports, and active medications.
    """
    clean_id = patient_id.strip()

    stmt = (
        select(User)
        .where((User.id == clean_id) | (User.abha_id == clean_id))
        .options(
            selectinload(User.intake_sessions),
            selectinload(User.documents),
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{clean_id}' not found.",
        )

    sessions_data = [
        SavedIntakeSessionResponse(
            id=s.id,
            session_date=s.session_date,
            status=s.status,
            language=s.language,
            chief_complaint=s.chief_complaint,
            clinical_record=s.clinical_record,
            chat_history=s.chat_history,
            ai_summary_text=s.ai_summary_text,
            ai_summary_sections=s.ai_summary_sections,
            red_flag_active=s.red_flag_active,
            created_at=s.created_at,
        )
        for s in (user.intake_sessions or [])
    ]

    docs_data = [
        SavedDocumentResponse(
            id=d.id,
            session_id=d.session_id,
            filename=d.filename,
            file_type=d.file_type,
            preview_url=d.preview_url,
            structured_result=d.structured_result,
            created_at=d.created_at,
        )
        for d in (user.documents or [])
    ]

    active_meds, past_meds = _aggregate_medications(user.documents or [])

    patient_info = {
        "id": user.id,
        "abha_id": user.abha_id,
        "user_type": user.user_type,
        "name": user.name,
        "gender": user.gender,
        "age_years": user.age_years,
        "phone": user.phone,
        "email": user.email,
        "patient_details": user.patient_details or {},
    }

    return PatientDashboardResponse(
        status="success",
        patient=patient_info,
        intake_sessions=sessions_data,
        documents=docs_data,
        active_medications=active_meds,
        past_medications=past_meds,
    )
