"""
Unit test for DB-02: Verification of composite indexes on foreign keys and lookup queries.
"""
from app.db.models import IntakeSession, PatientDocument


def test_intake_session_composite_indexes():
    index_names = {idx.name for idx in IntakeSession.__table__.indexes}
    assert "ix_intake_patient_created" in index_names
    assert "ix_intake_doctor_status" in index_names
    assert "ix_intake_session_date" in index_names


def test_patient_document_composite_indexes():
    index_names = {idx.name for idx in PatientDocument.__table__.indexes}
    assert "ix_doc_patient_created" in index_names
    assert "ix_doc_file_type" in index_names
