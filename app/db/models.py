import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    """
    User entity supporting both 'patient' and 'doctor' roles.
    Indexed by unique ABHA ID.
    """
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    abha_id: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    user_type: Mapped[str] = mapped_column(String(16), index=True, nullable=False)  # "patient" or "doctor"
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    gender: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    age_years: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # Role-specific rich profile payloads
    doctor_details: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
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


class IntakeSession(Base):
    """
    Recorded patient clinical intake session, containing chat dialogue,
    extracted clinical entities (SOCRATES / Ayush), and synthesized summaries.
    """
    __tablename__ = "intake_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    patient_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
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
    patient: Mapped["User"] = relationship("User", back_populates="intake_sessions")
    documents: Mapped[List["PatientDocument"]] = relationship(
        "PatientDocument",
        back_populates="session",
    )


class PatientDocument(Base):
    """
    Scanned or uploaded medical prescription or diagnostic laboratory document.
    """
    __tablename__ = "patient_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    patient_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
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
    patient: Mapped["User"] = relationship("User", back_populates="documents")
    session: Mapped[Optional["IntakeSession"]] = relationship("IntakeSession", back_populates="documents")
