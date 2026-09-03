import logging
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.date_utils import extract_prescription_date_from_text, parse_duration_to_days
from app.db.database import get_db
from app.db.models import IntakeSession, PatientDocument, User

logger = logging.getLogger("sanjivani.api.patient")
router = APIRouter(prefix="/patient", tags=["Patient Dashboard & Records"])


# ── Pydantic Request & Response Schemas ────────────────────────────────────────

class SavedDocumentResponse(BaseModel):
    id: str
    session_id: Optional[str] = None
    filename: str
    file_type: str
    preview_url: Optional[str] = None
    structured_result: Optional[Dict[str, Any]] = None
    created_at: datetime


class SavedIntakeSessionResponse(BaseModel):
    id: str
    session_date: datetime
    status: str
    language: str
    chief_complaint: Optional[Dict[str, Any]] = None
    clinical_record: Optional[Dict[str, Any]] = None
    chat_history: Optional[List[Dict[str, Any]]] = None
    ai_summary_text: Optional[str] = None
    ai_summary_sections: Optional[Dict[str, Any]] = None
    red_flag_active: bool
    created_at: datetime


class ActiveMedication(BaseModel):
    drug_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    source_document: str
    prescription_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True
    days_remaining: Optional[int] = None


class PatientDashboardResponse(BaseModel):
    status: str
    patient: Dict[str, Any]
    intake_sessions: List[SavedIntakeSessionResponse]
    documents: List[SavedDocumentResponse]
    active_medications: List[ActiveMedication]
    past_medications: List[ActiveMedication] = Field(default_factory=list)


class SaveIntakeSessionRequest(BaseModel):
    patient_id: str = Field(..., description="ID of the logged-in patient")
    session_id: Optional[str] = Field(default=None, description="Optional existing session ID to update")
    language: str = Field(default="en")
    chat_history: List[Dict[str, Any]] = Field(default_factory=list)
    clinical_record: Optional[Dict[str, Any]] = None
    scanned_documents: List[Dict[str, Any]] = Field(default_factory=list)
    ai_summary_text: Optional[str] = None
    ai_summary_sections: Optional[Dict[str, Any]] = None
    red_flag_active: bool = False


class SaveIntakeSessionResponse(BaseModel):
    status: str
    session_id: str
    message: str
    saved_documents_count: int


class UpdatePatientProfileRequest(BaseModel):
    patient_id: str = Field(..., description="ID of the logged-in patient")
    name: Optional[str] = None
    gender: Optional[str] = None
    age_years: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    patient_details: Optional[Dict[str, Any]] = None


class UpdatePatientProfileResponse(BaseModel):
    status: str
    message: str
    patient: Dict[str, Any]


# ── Helper: Aggregate Active vs Past Medications ────────────────────────────────

def _extract_prescription_date(doc: PatientDocument) -> date:
    """
    Extracts the explicit prescription date present on the prescription document.
    Prioritizes:
    1. doc.structured_result["document_date"] or ["prescription_date"]
    2. doc.structured_result["raw_text"] via comprehensive clinical date regex
       (supporting 2-digit/4-digit years, multiline DATE, slash/dash/dot separators)
    3. Fallback to doc.created_at.date() only if no date is written on the document.
    """
    if doc.structured_result and isinstance(doc.structured_result, dict):
        date_str = doc.structured_result.get("document_date") or doc.structured_result.get("prescription_date")
        if date_str:
            parsed = extract_prescription_date_from_text(str(date_str))
            if parsed:
                return parsed

        raw_text = str(doc.structured_result.get("raw_text") or "")
        if raw_text:
            parsed = extract_prescription_date_from_text(raw_text)
            if parsed:
                return parsed

    if doc.created_at:
        return doc.created_at.date()
    return datetime.now(timezone.utc).date()


def _aggregate_medications(
    documents: List[PatientDocument],
) -> Tuple[List[ActiveMedication], List[ActiveMedication]]:
    """
    Categorizes prescribed medications into active medications and past medications
    by comparing prescription date (present on the prescription) + duration against current date.
    """
    today = datetime.now(timezone.utc).date()
    active_map: Dict[str, ActiveMedication] = {}
    past_map: Dict[str, ActiveMedication] = {}

    for doc in documents:
        if not doc.structured_result or not isinstance(doc.structured_result, dict):
            continue
        doc_meds = doc.structured_result.get("medications", [])
        if not isinstance(doc_meds, list):
            continue

        doc_rx_date = _extract_prescription_date(doc)

        for m in doc_meds:
            if not isinstance(m, dict):
                continue
            dname = str(m.get("drug_name") or "").strip()
            if not dname:
                continue

            # Check for medication-specific prescription date, fallback to document date
            m_date_str = m.get("prescription_date")
            m_rx_date = extract_prescription_date_from_text(str(m_date_str)) if m_date_str else None
            rx_date = m_rx_date or doc_rx_date

            duration_str = m.get("duration")
            days = parse_duration_to_days(duration_str)
            end_date = rx_date + timedelta(days=days)
            is_active = (end_date >= today)
            days_diff = (end_date - today).days

            med_obj = ActiveMedication(
                drug_name=dname,
                dosage=m.get("dosage"),
                frequency=m.get("frequency"),
                duration=duration_str,
                source_document=doc.filename,
                prescription_date=rx_date.isoformat(),
                end_date=end_date.isoformat(),
                is_active=is_active,
                days_remaining=days_diff if is_active else 0,
            )

            key = dname.lower()
            if is_active:
                if key not in active_map or (med_obj.end_date and (active_map[key].end_date or "") < med_obj.end_date):
                    active_map[key] = med_obj
                past_map.pop(key, None)
            else:
                if key not in active_map:
                    if key not in past_map or (med_obj.end_date and (past_map[key].end_date or "") < med_obj.end_date):
                        past_map[key] = med_obj

    # Sort medications by end_date descending
    sorted_active = sorted(active_map.values(), key=lambda x: x.end_date or "", reverse=True)
    sorted_past = sorted(past_map.values(), key=lambda x: x.end_date or "", reverse=True)
    return sorted_active, sorted_past


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=PatientDashboardResponse)
async def get_patient_dashboard(
    patient_id: str = Query(..., description="Patient UUID or ABHA ID"),
    db: AsyncSession = Depends(get_db),
) -> PatientDashboardResponse:
    """
    Fetch comprehensive patient health data: demographics, past intake summaries,
    uploaded clinical documents, and separated active vs past medications.
    """
    clean_id = patient_id.strip()

    # Query user by ID or ABHA ID
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
            detail=f"Patient with ID/ABHA '{clean_id}' not found.",
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
        for s in user.intake_sessions
    ]

    documents_data = [
        SavedDocumentResponse(
            id=d.id,
            session_id=d.session_id,
            filename=d.filename,
            file_type=d.file_type,
            preview_url=d.preview_url,
            structured_result=d.structured_result,
            created_at=d.created_at,
        )
        for d in user.documents
    ]

    active_meds, past_meds = _aggregate_medications(user.documents or [])

    patient_payload = {
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
        patient=patient_payload,
        intake_sessions=sessions_data,
        documents=documents_data,
        active_medications=active_meds,
        past_medications=past_meds,
    )


@router.post("/intake-session", response_model=SaveIntakeSessionResponse)
async def save_intake_session(
    payload: SaveIntakeSessionRequest,
    db: AsyncSession = Depends(get_db),
) -> SaveIntakeSessionResponse:
    """
    Save or update patient intake consultation session, including chat transcript,
    extracted clinical history record, scanned documents, and AI clinical summary.
    """
    # 1. Verify patient exists
    stmt = select(User).where((User.id == payload.patient_id) | (User.abha_id == payload.patient_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{payload.patient_id}' not found.",
        )

    patient_db_id = user.id

    # 2. Extract chief complaint from clinical record if available
    chief_complaint = None
    if payload.clinical_record and isinstance(payload.clinical_record, dict):
        chief_complaint = payload.clinical_record.get("chief_complaint")

    # 3. Create or update session
    session_id = payload.session_id or str(uuid.uuid4())
    session_stmt = select(IntakeSession).where(IntakeSession.id == session_id)
    session_res = await db.execute(session_stmt)
    existing_session = session_res.scalar_one_or_none()

    if existing_session:
        existing_session.chat_history = payload.chat_history
        existing_session.clinical_record = payload.clinical_record
        existing_session.chief_complaint = chief_complaint
        existing_session.ai_summary_text = payload.ai_summary_text
        existing_session.ai_summary_sections = payload.ai_summary_sections
        existing_session.red_flag_active = payload.red_flag_active
        existing_session.language = payload.language
        existing_session.status = "submitted"
        existing_session.updated_at = datetime.now(timezone.utc)
    else:
        new_session = IntakeSession(
            id=session_id,
            patient_id=patient_db_id,
            status="submitted",
            language=payload.language,
            chief_complaint=chief_complaint,
            clinical_record=payload.clinical_record,
            chat_history=payload.chat_history,
            ai_summary_text=payload.ai_summary_text,
            ai_summary_sections=payload.ai_summary_sections,
            red_flag_active=payload.red_flag_active,
        )
        db.add(new_session)

    # 4. Save/update documents associated with this session
    saved_docs_count = 0
    for doc_item in payload.scanned_documents:
        if not isinstance(doc_item, dict):
            continue
        doc_id = str(doc_item.get("id") or uuid.uuid4())
        filename = str(doc_item.get("filename") or "medical_document.jpg")
        file_type = str(doc_item.get("file_type") or "prescription")
        preview_url = doc_item.get("preview_url") or doc_item.get("previewUrl")
        structured_res = doc_item.get("result") or doc_item.get("structured_result")

        # Check if already present
        doc_stmt = select(PatientDocument).where(PatientDocument.id == doc_id)
        doc_res = await db.execute(doc_stmt)
        existing_doc = doc_res.scalar_one_or_none()

        if existing_doc:
            existing_doc.session_id = session_id
            existing_doc.filename = filename
            existing_doc.file_type = file_type
            if preview_url:
                existing_doc.preview_url = preview_url
            if structured_res:
                existing_doc.structured_result = structured_res
        else:
            new_doc = PatientDocument(
                id=doc_id,
                patient_id=patient_db_id,
                session_id=session_id,
                filename=filename,
                file_type=file_type,
                preview_url=preview_url,
                structured_result=structured_res,
            )
            db.add(new_doc)
        saved_docs_count += 1

    await db.commit()
    logger.info("Successfully persisted intake session '%s' with %d documents.", session_id, saved_docs_count)

    return SaveIntakeSessionResponse(
        status="success",
        session_id=session_id,
        message="Intake consultation and documents successfully saved to health record.",
        saved_documents_count=saved_docs_count,
    )


@router.delete("/document/{doc_id}")
async def delete_patient_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Delete a specific uploaded medical document from the database.
    """
    clean_id = doc_id.strip()
    stmt = select(PatientDocument).where(PatientDocument.id == clean_id)
    res = await db.execute(stmt)
    doc = res.scalar_one_or_none()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{clean_id}' not found.",
        )

    await db.delete(doc)
    await db.commit()
    logger.info("Deleted document '%s' from patient database.", clean_id)

    return {
        "status": "success",
        "message": f"Document '{doc.filename}' deleted successfully.",
        "deleted_id": clean_id,
    }


@router.delete("/intake-session/{session_id}")
async def delete_intake_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Delete a specific patient clinical intake session.
    """
    clean_id = session_id.strip()
    stmt = select(IntakeSession).where(IntakeSession.id == clean_id)
    res = await db.execute(stmt)
    sess = res.scalar_one_or_none()

    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Intake session with ID '{clean_id}' not found.",
        )

    await db.delete(sess)
    await db.commit()
    logger.info("Deleted intake session '%s'.", clean_id)

    return {
        "status": "success",
        "message": "Intake session removed from records.",
        "deleted_id": clean_id,
    }


@router.put("/profile", response_model=UpdatePatientProfileResponse)
async def update_patient_profile(
    payload: UpdatePatientProfileRequest,
    db: AsyncSession = Depends(get_db),
) -> UpdatePatientProfileResponse:
    """
    Update patient personal details and clinical baseline information.
    """
    clean_id = payload.patient_id.strip()
    stmt = select(User).where((User.id == clean_id) | (User.abha_id == clean_id))
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{clean_id}' not found.",
        )

    if payload.name is not None:
        user.name = payload.name.strip()
    if payload.gender is not None:
        user.gender = payload.gender
    if payload.age_years is not None:
        user.age_years = payload.age_years
    if payload.phone is not None:
        user.phone = payload.phone.strip()
    if payload.email is not None:
        user.email = payload.email.strip()
    if payload.patient_details is not None:
        current_details = dict(user.patient_details or {})
        current_details.update(payload.patient_details)
        user.patient_details = current_details

    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    logger.info("Updated profile for patient '%s' (%s).", user.name, user.id)

    return UpdatePatientProfileResponse(
        status="success",
        message="Patient personal profile updated successfully.",
        patient={
            "id": user.id,
            "abha_id": user.abha_id,
            "user_type": user.user_type,
            "name": user.name,
            "gender": user.gender,
            "age_years": user.age_years,
            "phone": user.phone,
            "email": user.email,
            "patient_details": user.patient_details or {},
        },
    )
