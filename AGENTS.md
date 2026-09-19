# Agent Guidelines & Safety Rules: Sanjivani Clinical Intake Assistant

## Mandatory Protocol: Testing Entity Lifecycle & Database Hygiene

### 1. Zero Test Profiles Left Behind
Whenever any agent, subagent, or test routine creates a **Patient** or **Doctor** profile for testing, debugging, verification, or demonstration:
- **YOU MUST ALWAYS DELETE IT IMMEDIATELY** before concluding the task.
- **NEVER leave dummy or simulated profiles** in any persistent database (`sanjivani.db`, Supabase PostgreSQL, or other environments).
- Ensure cascade deletion removes all associated items:
  - Intake sessions (`intake_sessions`)
  - Patient documents (`patient_documents`)
  - Active OTPs (`active_otps`)
  - Patient/Doctor profile records (`patients`, `doctors`)

### 2. Test Suite Fixture Teardowns
- Automated test scripts (`pytest`) that register patient or doctor accounts must register explicit teardown logic or rely on `tests/conftest.py`.
- `tests/conftest.py` maintains an exhaustive purge list for all test ABHA IDs and HP IDs.

### 3. Post-Task Audit Requirement
- Always verify database status before completing a task:
  - Run `python scripts/cleanup_test_data.py --inspect` to confirm that all test accounts are gone.
  - Never delete the primary doctor account: `HP-RJ-68717` (Dr. Avirup Banerjee).
