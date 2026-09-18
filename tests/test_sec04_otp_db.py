import asyncio
import time
from fastapi.testclient import TestClient
from sqlalchemy import select, delete

from app.main import app
from app.api.auth import _generate_and_store_otp, _verify_and_consume_otp, _ACTIVE_OTPS, get_active_otp
from app.db.database import AsyncSessionLocal
from app.db.models import ActiveOTP, Patient

client = TestClient(app)

SEC04_PATIENT_ABHA = "14-9999-8888-7777"
SEC04_PATIENT_NAME = "MultiWorker Test Patient"


def _cleanup():
    async def _async_cleanup():
        async with AsyncSessionLocal() as session:
            await session.execute(delete(ActiveOTP).where(ActiveOTP.identifier == SEC04_PATIENT_ABHA))
            await session.execute(delete(Patient).where(Patient.abha_id == SEC04_PATIENT_ABHA))
            await session.commit()
    asyncio.run(_async_cleanup())
    _ACTIVE_OTPS.pop(SEC04_PATIENT_ABHA, None)


def test_sec04_otp_persisted_to_database():
    """Verify that generating an OTP records it into active_otps DB table."""
    _cleanup()
    async def _run():
        async with AsyncSessionLocal() as session:
            code = await _generate_and_store_otp(SEC04_PATIENT_ABHA, db=session)
            assert len(code) == 6

            stmt = select(ActiveOTP).where(ActiveOTP.identifier == SEC04_PATIENT_ABHA)
            res = await session.execute(stmt)
            record = res.scalar_one_or_none()
            assert record is not None
            assert record.code == code
            assert record.expires_at > time.time()
            assert record.attempts_count == 0
    asyncio.run(_run())
    _cleanup()


def test_sec04_multi_worker_simulation():
    """
    Simulate worker A generating OTP and worker B verifying it.
    Worker B has an empty memory cache (_ACTIVE_OTPS), relying on the shared DB table.
    """
    _cleanup()
    async def _run():
        async with AsyncSessionLocal() as session_worker_a:
            code = await _generate_and_store_otp(SEC04_PATIENT_ABHA, db=session_worker_a)

        # Worker B simulation: Wipe local in-memory cache
        _ACTIVE_OTPS.clear()
        assert SEC04_PATIENT_ABHA not in _ACTIVE_OTPS

        # Worker B receives verify request and checks database
        async with AsyncSessionLocal() as session_worker_b:
            verified = await _verify_and_consume_otp(SEC04_PATIENT_ABHA, code, db=session_worker_b)
            assert verified is True

            # Ensure consumed from DB
            stmt = select(ActiveOTP).where(ActiveOTP.identifier == SEC04_PATIENT_ABHA)
            res = await session_worker_b.execute(stmt)
            record = res.scalar_one_or_none()
            assert record is None
    asyncio.run(_run())
    _cleanup()


def test_sec04_rate_limiting_and_lockout():
    """Verify that after 5 failed verification attempts, the OTP is invalidated."""
    _cleanup()
    async def _run():
        async with AsyncSessionLocal() as session:
            code = await _generate_and_store_otp(SEC04_PATIENT_ABHA, db=session)

        # 4 failed attempts
        for attempt in range(1, 5):
            async with AsyncSessionLocal() as session:
                verified = await _verify_and_consume_otp(SEC04_PATIENT_ABHA, "000000", db=session)
                assert verified is False

                stmt = select(ActiveOTP).where(ActiveOTP.identifier == SEC04_PATIENT_ABHA)
                res = await session.execute(stmt)
                record = res.scalar_one_or_none()
                assert record is not None
                assert record.attempts_count == attempt

        # 5th failed attempt: should invalidate/prune OTP
        async with AsyncSessionLocal() as session:
            verified = await _verify_and_consume_otp(SEC04_PATIENT_ABHA, "000000", db=session)
            assert verified is False

            stmt = select(ActiveOTP).where(ActiveOTP.identifier == SEC04_PATIENT_ABHA)
            res = await session.execute(stmt)
            record = res.scalar_one_or_none()
            assert record is None  # Deleted due to lockout!

        # Even if the user now submits the correct code, it's locked out
        async with AsyncSessionLocal() as session:
            verified = await _verify_and_consume_otp(SEC04_PATIENT_ABHA, code, db=session)
            assert verified is False
    asyncio.run(_run())
    _cleanup()


def test_sec04_expired_otp_rejection():
    """Verify that expired OTP cannot be verified and is pruned from DB."""
    _cleanup()
    async def _run():
        async with AsyncSessionLocal() as session:
            # Create an already-expired record
            expired_record = ActiveOTP(
                identifier=SEC04_PATIENT_ABHA,
                code="123456",
                expires_at=time.time() - 10.0,  # 10s in the past
                attempts_count=0,
            )
            session.add(expired_record)
            await session.commit()

        async with AsyncSessionLocal() as session:
            verified = await _verify_and_consume_otp(SEC04_PATIENT_ABHA, "123456", db=session)
            assert verified is False

            stmt = select(ActiveOTP).where(ActiveOTP.identifier == SEC04_PATIENT_ABHA)
            res = await session.execute(stmt)
            record = res.scalar_one_or_none()
            assert record is None  # Pruned upon expiration check
    asyncio.run(_run())
    _cleanup()


def test_sec04_http_flow():
    """Test full HTTP request-otp and verify-otp roundtrip with DB backing."""
    _cleanup()
    # 1. Register patient
    reg_payload = {
        "name": SEC04_PATIENT_NAME,
        "abha_id": SEC04_PATIENT_ABHA,
        "phone": "9876500000",
        "gender": "Female",
        "age_years": 28,
    }
    reg_res = client.post("/api/v1/auth/patient/register", json=reg_payload)
    assert reg_res.status_code == 201

    # 2. Request OTP
    req_res = client.post("/api/v1/auth/patient/request-otp", json={"abha_id": SEC04_PATIENT_ABHA})
    assert req_res.status_code == 200

    # Verify DB has the record
    async def _check_db():
        async with AsyncSessionLocal() as session:
            stmt = select(ActiveOTP).where(ActiveOTP.identifier == SEC04_PATIENT_ABHA)
            res = await session.execute(stmt)
            record = res.scalar_one_or_none()
            assert record is not None
            return record.code
    db_code = asyncio.run(_check_db())

    # Simulate another worker by clearing local memory cache
    _ACTIVE_OTPS.clear()

    # 3. Verify OTP via HTTP
    ver_res = client.post("/api/v1/auth/patient/verify-otp", json={
        "abha_id": SEC04_PATIENT_ABHA,
        "otp": db_code,
    })
    assert ver_res.status_code == 200
    data = ver_res.json()
    assert data["status"] == "success"
    assert "token" in data
    assert data["user"]["abha_id"] == SEC04_PATIENT_ABHA
    _cleanup()
