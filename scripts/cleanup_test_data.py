#!/usr/bin/env python3
"""
Sanjivani Test Data Audit & Cleanup Utility.

Provides safe inspection, automated backup, dry-run simulation, and targeted
purging of test patient and doctor profiles.

Protected Real Profile:
- HP-RJ-68717 (Dr. Avirup Banerjee) - CAN NEVER BE DELETED.
"""

import argparse
import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from typing import List, Dict, Any, Set

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import delete, select, or_
from app.db.database import AsyncSessionLocal
from app.db.models import ActiveOTP, Doctor, IntakeSession, Patient, PatientDocument

# Protected real accounts that MUST NEVER be deleted
PROTECTED_HP_IDS: Set[str] = {"HP-RJ-68717"}

# Known automated test patient ABHA IDs
KNOWN_TEST_PATIENT_ABHAS: Set[str] = {
    "14-5555-4444-3333",  # Suresh Kumar (test_auth_and_db, test_doctor)
    "14-1111-2222-3333",  # Priya Sharma (test_sec02_bola)
    "14-4444-5555-6666",  # Rahul Mehra (test_sec02_bola)
    "14-9999-8888-7777",  # SecTest Patient (test_sec01_otp_leak, test_sec04)
    "14-9999-8888-7778",  # MultiWorker Test Patient (test_sec04)
}

# Known automated test doctor HP IDs
KNOWN_TEST_DOCTOR_HP_IDS: Set[str] = {
    "HP-KA-99881",       # Dr. Amit Verma (test_auth_and_db)
    "HP-DOC-TEST-001",   # Dr. Test Clinician (test_doctor)
    "HP-SEC-01010",      # Dr. SecTest Doctor (test_sec01_otp_leak)
    "HP-DOC-77889",      # Dr. Kavita Sharma (test_sec02_bola)
}

# Known manual test profiles created during dev/verification
KNOWN_MANUAL_TEST_PATIENT_ABHAS: Set[str] = {
    "14-2658-2029-9581",  # Aviruyp (phone sfsdfsf)
    "14-8598-9884-7923",  # ye (dummy)
    "14-8571-3153-3819",  # Pooja Sharma (test duplicate 1)
    "14-7258-8825-6075",  # Pooja Sharma (test duplicate 2)
    "14-8088-7996-9345",  # Pooja Sharma (test duplicate 3)
    "14-9613-9968-9633",  # Avir (test phone 1234567890)
}


def serialize_model(obj: Any) -> Dict[str, Any]:
    """Helper to convert SQLAlchemy model instance to JSON-serializable dict."""
    if obj is None:
        return {}
    data = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        data[col.name] = val
    return data


async def backup_database() -> str:
    """Export complete snapshot of patients, doctors, sessions, and docs to JSON."""
    backup_dir = os.path.join(os.path.dirname(__file__), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_file = os.path.join(backup_dir, f"db_backup_{timestamp}.json")

    async with AsyncSessionLocal() as session:
        patients = (await session.execute(select(Patient))).scalars().all()
        doctors = (await session.execute(select(Doctor))).scalars().all()
        sessions = (await session.execute(select(IntakeSession))).scalars().all()
        documents = (await session.execute(select(PatientDocument))).scalars().all()
        otps = (await session.execute(select(ActiveOTP))).scalars().all()

        dump = {
            "timestamp": timestamp,
            "counts": {
                "patients": len(patients),
                "doctors": len(doctors),
                "intake_sessions": len(sessions),
                "patient_documents": len(documents),
                "active_otps": len(otps),
            },
            "patients": [serialize_model(p) for p in patients],
            "doctors": [serialize_model(d) for d in doctors],
            "intake_sessions": [serialize_model(s) for s in sessions],
            "patient_documents": [serialize_model(doc) for doc in documents],
            "active_otps": [serialize_model(o) for o in otps],
        }

    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(dump, f, indent=2, ensure_ascii=False)

    print(f"Database snapshot saved to: {backup_file}")
    return backup_file


async def inspect_database() -> None:
    """Print full report of existing doctors, patients, sessions, and docs."""
    async with AsyncSessionLocal() as session:
        patients = (await session.execute(select(Patient).order_by(Patient.created_at))).scalars().all()
        doctors = (await session.execute(select(Doctor).order_by(Doctor.created_at))).scalars().all()
        intake_sessions = (await session.execute(select(IntakeSession))).scalars().all()
        documents = (await session.execute(select(PatientDocument))).scalars().all()

        print("\n" + "=" * 80)
        print("               SANJIVANI CLINICAL INTAKE DATABASE AUDIT")
        print("=" * 80)
        print(f"Total Patients:        {len(patients)}")
        print(f"Total Doctors:         {len(doctors)}")
        print(f"Total Intake Sessions: {len(intake_sessions)}")
        print(f"Total Documents:       {len(documents)}")
        print("=" * 80)

        print("\n--- DOCTORS ---")
        for d in doctors:
            is_protected = d.hp_id in PROTECTED_HP_IDS
            tag = "[REAL / PROTECTED]" if is_protected else "[TEST / DUMMY]"
            print(f"{tag} ID: {d.id} | HP_ID: {d.hp_id} | Name: {d.name}")
            print(f"    Specialization: {d.specialization} | Hospital: {d.hospital}")
            print(f"    Phone: {d.phone} | Email: {d.email} | Created: {d.created_at}")

        print("\n--- PATIENTS ---")
        for p in patients:
            is_auto_test = p.abha_id in KNOWN_TEST_PATIENT_ABHAS
            is_manual_test = p.abha_id in KNOWN_MANUAL_TEST_PATIENT_ABHAS
            tag = "[TEST / AUTO]" if is_auto_test else ("[TEST / MANUAL]" if is_manual_test else "[UNKNOWN / POTENTIAL TEST]")
            
            p_sessions = [s for s in intake_sessions if s.patient_id == p.id]
            p_docs = [doc for doc in documents if doc.patient_id == p.id]

            print(f"{tag} ID: {p.id} | ABHA: {p.abha_id} | Name: {p.name}")
            print(f"    Phone: {p.phone} | Email: {p.email} | Created: {p.created_at}")
            print(f"    Sessions: {len(p_sessions)} | Documents: {len(p_docs)}")


async def purge_test_profiles(dry_run: bool = False, include_manual_tests: bool = True) -> None:
    """
    Safely purge test doctor and patient profiles, cascading through
    their intake sessions, patient documents, and active OTPs.
    """
    if not dry_run:
        await backup_database()

    async with AsyncSessionLocal() as session:
        # Collect test doctor targets
        doctor_stmt = select(Doctor).where(Doctor.hp_id.in_(KNOWN_TEST_DOCTOR_HP_IDS))
        res_docs = await session.execute(doctor_stmt)
        doctors_to_delete = res_docs.scalars().all()

        # Collect test patient targets
        target_abhas = set(KNOWN_TEST_PATIENT_ABHAS)
        if include_manual_tests:
            target_abhas.update(KNOWN_MANUAL_TEST_PATIENT_ABHAS)

        patient_stmt = select(Patient).where(Patient.abha_id.in_(target_abhas))
        res_patients = await session.execute(patient_stmt)
        patients_to_delete = res_patients.scalars().all()

        p_ids = [p.id for p in patients_to_delete]
        d_ids = [d.id for d in doctors_to_delete]

        # Verify no protected accounts are matched
        for d in doctors_to_delete:
            if d.hp_id in PROTECTED_HP_IDS:
                raise ValueError(f"CRITICAL SAFETY VIOLATION: Cannot delete protected account {d.hp_id}!")

        # Find sessions and documents to be deleted
        sessions_to_delete = []
        documents_to_delete = []
        if p_ids:
            s_res = await session.execute(select(IntakeSession).where(IntakeSession.patient_id.in_(p_ids)))
            sessions_to_delete = s_res.scalars().all()

            doc_res = await session.execute(select(PatientDocument).where(PatientDocument.patient_id.in_(p_ids)))
            documents_to_delete = doc_res.scalars().all()

        print("\n" + "=" * 80)
        mode_str = "DRY RUN - PREVIEW OF PURGE TARGETS" if dry_run else "EXECUTING PURGE OF TEST ENTITIES"
        print(f" {mode_str}")
        print("=" * 80)
        print(f"Doctors to delete:         {len(doctors_to_delete)}")
        for d in doctors_to_delete:
            print(f"  - [{d.hp_id}] {d.name} ({d.specialization})")

        print(f"\nPatients to delete:        {len(patients_to_delete)}")
        for p in patients_to_delete:
            print(f"  - [{p.abha_id}] {p.name} (Phone: {p.phone})")

        print(f"\nIntake sessions cascading: {len(sessions_to_delete)}")
        print(f"Documents cascading:       {len(documents_to_delete)}")
        print("=" * 80)

        if dry_run:
            print("\nDry run completed. No modifications were made to the database.")
            return

        # Perform actual deletion with proper cascade order
        if p_ids:
            await session.execute(delete(PatientDocument).where(PatientDocument.patient_id.in_(p_ids)))
            await session.execute(delete(IntakeSession).where(IntakeSession.patient_id.in_(p_ids)))
            await session.execute(delete(Patient).where(Patient.id.in_(p_ids)))

        if d_ids:
            # Nullify any foreign key references in intake_sessions for these doctors
            from sqlalchemy import update
            await session.execute(
                update(IntakeSession).where(IntakeSession.doctor_id.in_(d_ids)).values(doctor_id=None)
            )
            await session.execute(delete(Doctor).where(Doctor.id.in_(d_ids)))

        # Clean up any active OTPs for targeted identifiers
        all_test_identifiers = list(target_abhas) + list(KNOWN_TEST_DOCTOR_HP_IDS)
        await session.execute(delete(ActiveOTP).where(ActiveOTP.identifier.in_(all_test_identifiers)))

        await session.commit()
        print("\nPurge completed successfully! All test profiles and cascades removed.")


async def delete_single_patient(identifier: str) -> None:
    """Delete a single patient by ABHA ID or database UUID."""
    async with AsyncSessionLocal() as session:
        stmt = select(Patient).where(
            or_(Patient.abha_id == identifier, Patient.id == identifier)
        )
        res = await session.execute(stmt)
        patient = res.scalar_one_or_none()
        if not patient:
            print(f"No patient found matching identifier: {identifier}")
            return

        print(f"Deleting patient: {patient.name} (ABHA: {patient.abha_id}, ID: {patient.id})")
        # Cascade sessions and documents
        await session.execute(delete(PatientDocument).where(PatientDocument.patient_id == patient.id))
        await session.execute(delete(IntakeSession).where(IntakeSession.patient_id == patient.id))
        await session.execute(delete(ActiveOTP).where(ActiveOTP.identifier == patient.abha_id))
        await session.execute(delete(Patient).where(Patient.id == patient.id))
        await session.commit()
        print(f"Successfully purged patient {patient.abha_id} and all related records.")


async def delete_single_doctor(identifier: str) -> None:
    """Delete a single doctor by HP ID or database UUID."""
    if identifier in PROTECTED_HP_IDS:
        print(f"ERROR: Cannot delete protected account {identifier}!")
        return

    async with AsyncSessionLocal() as session:
        stmt = select(Doctor).where(
            or_(Doctor.hp_id == identifier, Doctor.id == identifier)
        )
        res = await session.execute(stmt)
        doctor = res.scalar_one_or_none()
        if not doctor:
            print(f"No doctor found matching identifier: {identifier}")
            return

        if doctor.hp_id in PROTECTED_HP_IDS:
            print(f"ERROR: Cannot delete protected account {doctor.hp_id}!")
            return

        print(f"Deleting doctor: {doctor.name} (HP_ID: {doctor.hp_id}, ID: {doctor.id})")
        from sqlalchemy import update
        await session.execute(update(IntakeSession).where(IntakeSession.doctor_id == doctor.id).values(doctor_id=None))
        await session.execute(delete(ActiveOTP).where(ActiveOTP.identifier == doctor.hp_id))
        await session.execute(delete(Doctor).where(Doctor.id == doctor.id))
        await session.commit()
        print(f"Successfully purged doctor {doctor.hp_id}.")


async def main():
    parser = argparse.ArgumentParser(description="Sanjivani Test Data Cleanup Utility")
    parser.add_argument("--inspect", action="store_true", help="Inspect and list all database entities")
    parser.add_argument("--backup", action="store_true", help="Take a full JSON backup of the database")
    parser.add_argument("--dry-run", action="store_true", help="Preview deletions without modifying database")
    parser.add_argument("--purge-tests", action="store_true", help="Purge all known test patient and doctor profiles")
    parser.add_argument("--auto-only", action="store_true", help="Only purge automated test IDs, leave manual entries")
    parser.add_argument("--delete-patient", type=str, help="Delete a specific patient by ABHA ID or UUID")
    parser.add_argument("--delete-doctor", type=str, help="Delete a specific doctor by HP ID or UUID")

    args = parser.parse_args()

    if args.inspect:
        await inspect_database()
    elif args.backup:
        await backup_database()
    elif args.dry_run:
        await purge_test_profiles(dry_run=True, include_manual_tests=not args.auto_only)
    elif args.purge_tests:
        await purge_test_profiles(dry_run=False, include_manual_tests=not args.auto_only)
    elif args.delete_patient:
        await delete_single_patient(args.delete_patient)
    elif args.delete_doctor:
        await delete_single_doctor(args.delete_doctor)
    else:
        parser.print_help()


if __name__ == "__main__":
    asyncio.run(main())
