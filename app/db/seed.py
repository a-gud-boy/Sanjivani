import logging
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal, Base, engine
from app.db.models import IntakeSession, PatientDocument, User

logger = logging.getLogger("sanjivani.db.seed")


async def init_db() -> None:
    """Create all database tables if they do not exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database schema synchronized successfully.")


async def seed_demo_data() -> None:
    """
    Pre-seed demo users with their personal details only.
    Medical records (consultations, prescriptions, active medications)
    must remain empty until genuinely created by the user or clinician.
    """
    async with AsyncSessionLocal() as session:
        try:
            # ── Clean up any legacy fake mock intake sessions / docs ──────────
            await session.execute(
                delete(IntakeSession).where(
                    IntakeSession.id.in_(["session-demo-001", "session-demo-002"])
                )
            )
            await session.execute(
                delete(PatientDocument).where(
                    PatientDocument.id.in_(["doc-demo-001", "doc-demo-002"])
                )
            )

            # ── 1. Demo Patient: Ramesh Sharma (Personal details only) ─────────
            patient_stmt = select(User).where(User.abha_id == "14-1234-5678-9012")
            res = await session.execute(patient_stmt)
            existing_patient = res.scalar_one_or_none()

            patient1_personal_details = {
                "blood_group": "B+",
                "dob": "1988-04-15",
                "emergency_contact": {
                    "name": "Sunita Sharma",
                    "relation": "Spouse",
                    "phone": "9876543211",
                },
                "address_line": "House 42, Green Valley Enclave, Sector 14",
                "city": "Palakkad",
                "state": "Kerala",
                "pincode": "678001",
                "occupation": "Senior High School Teacher",
                "marital_status": "Married",
                "preferred_language": "English / Hindi",
                "allergies": [],
                "chronic_conditions": [],
                "ayush_prakriti": None,
            }

            if not existing_patient:
                logger.info("Seeding pre-registered demo patient: Ramesh Sharma (14-1234-5678-9012)...")
                patient = User(
                    id="patient-demo-001",
                    abha_id="14-1234-5678-9012",
                    user_type="patient",
                    name="Ramesh Sharma",
                    gender="Male",
                    age_years=38,
                    phone="9876543210",
                    email="ramesh.sharma@example.com",
                    patient_details=patient1_personal_details,
                )
                session.add(patient)
            else:
                # Update existing demo user to ensure only personal details are present
                existing_patient.name = "Ramesh Sharma"
                existing_patient.gender = "Male"
                existing_patient.age_years = 38
                existing_patient.phone = "9876543210"
                existing_patient.email = "ramesh.sharma@example.com"
                existing_patient.patient_details = patient1_personal_details

            # ── 2. Demo Doctor: Dr. Priya Nair ────────────────────────────────
            doctor_stmt = select(User).where(User.abha_id == "14-9988-7766-5544")
            res_doc = await session.execute(doctor_stmt)
            existing_doctor = res_doc.scalar_one_or_none()

            doctor_details = {
                "specialization": "MD Paediatrics & Integrative AYUSH Medicine",
                "hospital": "CHC Nemmara, Ayush Wellness Kiosk Center",
                "department": "Integrative Clinical Medicine & Triage",
                "license_no": "AYUSH-REG-2016-4412",
                "qualifications": "MBBS, MD (Paediatrics, JIPMER), Post-Grad Diploma in Ayurveda (NIA)",
                "duty_status": "Active On-Duty",
                "opd_hours": "09:00 AM – 04:30 PM",
            }

            if not existing_doctor:
                logger.info("Seeding pre-registered demo doctor: Dr. Priya Nair (14-9988-7766-5544)...")
                doctor = User(
                    id="doctor-demo-001",
                    abha_id="14-9988-7766-5544",
                    user_type="doctor",
                    name="Dr. Priya Nair",
                    gender="Female",
                    age_years=42,
                    phone="9811223344",
                    email="priya.nair@ayush.gov.in",
                    doctor_details=doctor_details,
                )
                session.add(doctor)
            else:
                existing_doctor.doctor_details = doctor_details

            # ── Clean up Sunita Mehra if previously seeded ────────────────────
            await session.execute(
                delete(User).where(User.id == "patient-demo-002")
            )

            await session.commit()
            logger.info("Database seeding verified successfully (Ramesh Sharma & Dr. Priya Nair only).")
        except Exception as e:
            await session.rollback()
            logger.error("Database seeding encountered error: %s", str(e), exc_info=True)
