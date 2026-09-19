import asyncio
import concurrent.futures
import pytest
from sqlalchemy import delete, select, or_
from app.db.database import AsyncSessionLocal
from app.db.models import ActiveOTP, Doctor, IntakeSession, Patient, PatientDocument

TEST_PATIENT_ABHAS = [
    "14-5555-4444-3333",
    "14-1111-2222-3333",
    "14-4444-5555-6666",
    "14-9999-8888-7777",
    "14-9999-8888-7778",
]

TEST_DOCTOR_HP_IDS = [
    "HP-KA-99881",
    "HP-DOC-TEST-001",
    "HP-SEC-01010",
    "HP-DOC-77889",
]


async def _async_purge_test_entities():
    async with AsyncSessionLocal() as session:
        try:
            # 1. Find and purge all test patients and their cascades
            res = await session.execute(
                select(Patient).where(
                    or_(
                        Patient.abha_id.in_(TEST_PATIENT_ABHAS),
                        Patient.abha_id.like("14-5555-%"),
                        Patient.abha_id.like("14-9999-%"),
                    )
                )
            )
            patients = res.scalars().all()
            p_ids = [p.id for p in patients]

            if p_ids:
                await session.execute(
                    delete(IntakeSession).where(IntakeSession.patient_id.in_(p_ids))
                )
                await session.execute(
                    delete(PatientDocument).where(PatientDocument.patient_id.in_(p_ids))
                )
                await session.execute(
                    delete(Patient).where(Patient.id.in_(p_ids))
                )

            # 2. Find and purge all test doctors
            res_doc = await session.execute(
                select(Doctor).where(
                    or_(
                        Doctor.hp_id.in_(TEST_DOCTOR_HP_IDS),
                        Doctor.hp_id.like("HP-DOC-TEST%"),
                        Doctor.hp_id.like("HP-SEC-%"),
                    )
                )
            )
            doctors = res_doc.scalars().all()
            # Safety check: NEVER delete genuine clinical account
            doctors = [d for d in doctors if d.hp_id != "HP-RJ-68717"]
            d_ids = [d.id for d in doctors]

            if d_ids:
                # Disassociate sessions if any
                from sqlalchemy import update
                await session.execute(
                    update(IntakeSession).where(IntakeSession.doctor_id.in_(d_ids)).values(doctor_id=None)
                )
                await session.execute(
                    delete(Doctor).where(Doctor.id.in_(d_ids))
                )

            # 3. Clean up active OTPs for any test identifiers
            all_test_ids = TEST_PATIENT_ABHAS + TEST_DOCTOR_HP_IDS
            await session.execute(
                delete(ActiveOTP).where(ActiveOTP.identifier.in_(all_test_ids))
            )

            await session.commit()
        except Exception:
            await session.rollback()


def purge_test_entities():
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pool.submit(asyncio.run, _async_purge_test_entities()).result()
    else:
        asyncio.run(_async_purge_test_entities())


@pytest.fixture(scope="session", autouse=True)
def global_database_test_cleanup():
    """Ensure test entities are purged before and after the entire test suite."""
    purge_test_entities()
    yield
    purge_test_entities()
