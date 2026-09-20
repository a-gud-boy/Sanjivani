import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_doctor_user
from app.api.patient import (
    ActiveMedication,
    PatientDashboardResponse,
    SavedDocumentResponse,
    SavedIntakeSessionResponse,
    _aggregate_medications,
)
from app.db.database import get_db
from app.db.models import Doctor, IntakeSession, Patient, PatientDocument
from app.services.llm_service import ClinicalLLMService, get_llm_service

logger = logging.getLogger("sanjivani.api.doctor")
router = APIRouter(prefix="/doctor", tags=["Doctor Clinical Oversight Portal"])



# ── Request / Response Schemas ────────────────────────────────────────────────

class LatestSessionSummary(BaseModel):
    id: str
    session_date: datetime
    status: str
    language: str = "en"
    chief_complaint: Optional[Dict[str, Any]] = None
    ai_summary_text: Optional[str] = None
    red_flag_active: bool


class DoctorTranslateSessionRequest(BaseModel):
    session_id: Optional[str] = None
    target_language: str = "en"
    source_language: Optional[str] = None
    chief_complaint: Optional[str] = None
    ai_summary_text: Optional[str] = None
    chat_history: Optional[List[Dict[str, Any]]] = None


class DoctorTranslateSessionResponse(BaseModel):
    status: str
    session_id: Optional[str] = None
    target_language: str
    source_language: Optional[str] = None
    translated_chief_complaint: Optional[str] = None
    translated_ai_summary_text: Optional[str] = None
    translated_chat_history: List[Dict[str, Any]] = []


class DoctorTranslateTextRequest(BaseModel):
    text: Optional[str] = None
    texts: Optional[List[str]] = None
    target_language: str = "en"
    source_language: Optional[str] = None


class DoctorTranslateTextResponse(BaseModel):
    status: str
    target_language: str
    translated_text: Optional[str] = None
    translated_texts: Optional[List[str]] = None


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
    current_doctor: Doctor = Depends(require_doctor_user),
    db: AsyncSession = Depends(get_db),
) -> DoctorPatientsListResponse:
    """
    Retrieve all registered patients in the database with their latest intake complaints,
    document counts, triage status, and aggregate portal statistics.
    """
    # 1. Fetch all patients with relationships eager-loaded
    stmt = (
        select(Patient)
        .options(
            selectinload(Patient.intake_sessions),
            selectinload(Patient.documents),
        )
        .order_by(Patient.created_at.desc())
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
                language=latest_s.language or "en",
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
    current_doctor: Doctor = Depends(require_doctor_user),
    db: AsyncSession = Depends(get_db),
) -> PatientDashboardResponse:
    """
    Retrieve full clinical dossier for a specific patient, allowing the clinician
    to review all historical AI consultation transcripts, scanned prescriptions,
    lab reports, and active medications.
    """
    clean_id = patient_id.strip()

    stmt = (
        select(Patient)
        .where((Patient.id == clean_id) | (Patient.abha_id == clean_id))
        .options(
            selectinload(Patient.intake_sessions),
            selectinload(Patient.documents),
        )
    )
    result = await db.execute(stmt)
    patient = result.scalar_one_or_none()

    if not patient:
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
        for s in (patient.intake_sessions or [])
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
        for d in (patient.documents or [])
    ]

    active_meds, past_meds = _aggregate_medications(patient.documents or [])

    patient_info = {
        "id": patient.id,
        "abha_id": patient.abha_id,
        "user_type": "patient",
        "name": patient.name,
        "gender": patient.gender,
        "age_years": patient.age_years,
        "phone": patient.phone,
        "email": patient.email,
        "patient_details": patient.patient_details or {},
    }


    return PatientDashboardResponse(
        status="success",
        patient=patient_info,
        intake_sessions=sessions_data,
        documents=docs_data,
        active_medications=active_meds,
        past_medications=past_meds,
    )


@router.post("/translate-session", response_model=DoctorTranslateSessionResponse)
async def translate_patient_session(
    request: DoctorTranslateSessionRequest,
    current_doctor: Doctor = Depends(require_doctor_user),
    db: AsyncSession = Depends(get_db),
    llm_service: ClinicalLLMService = Depends(get_llm_service),
) -> DoctorTranslateSessionResponse:
    """
    Translates an intake session's chief complaint, clinical summary, and chat history
    to the doctor's language.
    If session_id is provided and payload fields are missing, fetches them from the database.
    """
    chief_complaint = request.chief_complaint
    ai_summary_text = request.ai_summary_text
    chat_history = request.chat_history
    source_language = request.source_language

    # Fetch from DB if session_id is provided and fields are not passed
    if request.session_id and (not chief_complaint or not ai_summary_text or not chat_history):
        stmt = select(IntakeSession).where(IntakeSession.id == request.session_id)
        result = await db.execute(stmt)
        session_obj = result.scalar_one_or_none()
        if session_obj:
            if not source_language:
                source_language = session_obj.language
            if not chief_complaint and session_obj.chief_complaint:
                chief_complaint = session_obj.chief_complaint.get("symptom")
            if not ai_summary_text:
                ai_summary_text = session_obj.ai_summary_text
            if not chat_history:
                chat_history = session_obj.chat_history or []

    # Call translation
    res = await llm_service.translate_clinical_session(
        chief_complaint=chief_complaint,
        ai_summary_text=ai_summary_text,
        chat_history=chat_history,
        target_language=request.target_language,
        source_language=source_language,
    )

    return DoctorTranslateSessionResponse(
        status="success",
        session_id=request.session_id,
        target_language=request.target_language,
        source_language=source_language,
        translated_chief_complaint=res.get("chief_complaint"),
        translated_ai_summary_text=res.get("ai_summary_text"),
        translated_chat_history=res.get("chat_history") or [],
    )


@router.post("/translate", response_model=DoctorTranslateTextResponse)
async def translate_doctor_text(
    request: DoctorTranslateTextRequest,
    current_doctor: Doctor = Depends(require_doctor_user),
    llm_service: ClinicalLLMService = Depends(get_llm_service),
) -> DoctorTranslateTextResponse:
    """
    Translate arbitrary clinical text or list of texts to target language.
    """
    translated_text = None
    translated_texts = None

    if request.text:
        translated_text = await llm_service.translate_text(
            text=request.text,
            target_language=request.target_language,
            source_language=request.source_language,
        )

    if request.texts:
        translated_texts = []
        for t in request.texts:
            tr = await llm_service.translate_text(
                text=t,
                target_language=request.target_language,
                source_language=request.source_language,
            )
            translated_texts.append(tr)

    return DoctorTranslateTextResponse(
        status="success",
        target_language=request.target_language,
        translated_text=translated_text,
        translated_texts=translated_texts,
    )

