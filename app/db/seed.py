import logging
from sqlalchemy import delete
from app.db.database import AsyncSessionLocal, Base, engine
from app.db.models import IntakeSession, PatientDocument, User

logger = logging.getLogger("sanjivani.db.seed")


async def init_db() -> None:
    """Create all database tables if they do not exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema synchronized successfully.")


async def clear_demo_data() -> None:
    """
    Remove all legacy demo accounts (Ramesh Sharma, Dr. Priya Nair, etc.)
    and their associated sessions/documents. Demo accounts are deprecated
    in favor of self-registration.
    """
    async with AsyncSessionLocal() as session:
        try:
            demo_ids = ["patient-demo-001", "patient-demo-002", "doctor-demo-001"]
            demo_abhas = ["14-1234-5678-9012", "14-9988-7766-5544"]

            # Clean up sessions
            await session.execute(
                delete(IntakeSession).where(
                    IntakeSession.patient_id.in_(demo_ids)
                    | IntakeSession.id.in_(["session-demo-001", "session-demo-002"])
                )
            )

            # Clean up documents
            await session.execute(
                delete(PatientDocument).where(
                    PatientDocument.patient_id.in_(demo_ids)
                    | PatientDocument.id.in_(["doc-demo-001", "doc-demo-002"])
                )
            )

            # Clean up users
            await session.execute(
                delete(User).where(
                    User.id.in_(demo_ids) | User.abha_id.in_(demo_abhas)
                )
            )

            await session.commit()
            logger.info("All demo accounts and mock records successfully cleared.")
        except Exception as e:
            await session.rollback()
            logger.error("Error clearing demo accounts: %s", str(e), exc_info=True)


async def seed_demo_data() -> None:
    """
    Backward-compatibility alias. Ensures demo accounts remain cleared
    rather than recreated.
    """
    await clear_demo_data()
