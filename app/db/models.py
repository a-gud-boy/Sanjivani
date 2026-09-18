import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Patient(Base):
    """
    Patient entity registered under Ayushman Bharat Digital Mission (ABDM).
    Indexed by unique 14-digit ABHA ID.
    """
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    abha_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    gender: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    age_years: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Patient demographics & medical baseline (blood_group, emergency_contact, address, allergies, etc.)
    patient_details: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    intake_sessions: Mapped[List["IntakeSession"]] = relationship(
        "IntakeSession",
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="desc(IntakeSession.created_at)",
    )
    documents: Mapped[List["PatientDocument"]] = relationship(
        "PatientDocument",
        back_populates="patient",
        cascade="all, delete-orphan",
        order_by="desc(PatientDocument.created_at)",
    )


class Doctor(Base):
    """
    Doctor entity registered in the Healthcare Professional Registry (HPR) / Ayush Grid.
    Indexed by unique HP ID (Health Professional ID). Absolutely NO ABHA ID.
    """
    __tablename__ = "doctors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    hp_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    gender: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    age_years: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Clinical credentials & institutional affiliation
    specialization: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    license_no: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    hospital: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    qualifications: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    duty_status: Mapped[str] = mapped_column(String(32), default="On Duty")
    opd_hours: Mapped[Optional[str]] = mapped_column(String(64), default="09:00 AM - 04:00 PM")

    # Flexible doctor configuration/preferences
    doctor_details: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationship to intake sessions reviewed or treated by this doctor
    intake_sessions: Mapped[List["IntakeSession"]] = relationship(
        "IntakeSession",
        back_populates="doctor",
        order_by="desc(IntakeSession.created_at)",
    )


# Backward-compatibility alias during refactoring
User = Patient


class IntakeSession(Base):
    """
    Recorded patient clinical intake session, containing chat dialogue,
    extracted clinical entities (SOCRATES / Ayush), and synthesized summaries.
    """
    __tablename__ = "intake_sessions"
    __table_args__ = (
        Index("ix_intake_patient_created", "patient_id", "created_at"),
        Index("ix_intake_doctor_status", "doctor_id", "status"),
        Index("ix_intake_session_date", "session_date"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    patient_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("patients.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    doctor_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("doctors.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    session_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    status: Mapped[str] = mapped_column(String(24), default="submitted")  # "draft" or "submitted"
    language: Mapped[str] = mapped_column(String(8), default="en")

    # Structured medical payloads
    chief_complaint: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    clinical_record: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    chat_history: Mapped[Optional[List[Dict[str, Any]]]] = mapped_column(JSON, nullable=True)
    ai_summary_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_summary_sections: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    red_flag_active: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="intake_sessions")
    doctor: Mapped[Optional["Doctor"]] = relationship("Doctor", back_populates="intake_sessions")
    documents: Mapped[List["PatientDocument"]] = relationship(
        "PatientDocument",
        back_populates="session",
    )


class PatientDocument(Base):
    """
    Scanned or uploaded medical prescription or diagnostic laboratory document.
    """
    __tablename__ = "patient_documents"
    __table_args__ = (
        Index("ix_doc_patient_created", "patient_id", "created_at"),
        Index("ix_doc_file_type", "file_type"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    patient_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("patients.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    session_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("intake_sessions.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    filename: Mapped[str] = mapped_column(String(256), nullable=False)
    file_type: Mapped[str] = mapped_column(String(64), default="prescription")
    preview_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    structured_result: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="documents")
    session: Mapped[Optional["IntakeSession"]] = relationship("IntakeSession", back_populates="documents")


class ActiveOTP(Base):
    """
    Persistent OTP store for multi-worker deployments (SEC-04).
    Tracks active OTP code, expiration epoch, and failed verification attempts.
    """
    __tablename__ = "active_otps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    identifier: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(16), nullable=False)
    expires_at: Mapped[float] = mapped_column(Float, index=True, nullable=False)
    attempts_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

