import asyncio
import concurrent.futures
import pytest
from sqlalchemy import delete, select
from app.db.database import AsyncSessionLocal
from app.db.models import Doctor, IntakeSession, Patient, PatientDocument

TEST_PATIENT_ABHA = "14-5555-4444-3333"
TEST_DOCTOR_HP_ID = "HP-KA-99881"


async def _async_purge_test_entities():
    async with AsyncSessionLocal() as session:
        try:
            res = await session.execute(
                select(Patient).where(Patient.abha_id == TEST_PATIENT_ABHA)
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

            await session.execute(
                delete(Doctor).where(Doctor.hp_id == TEST_DOCTOR_HP_ID)
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
