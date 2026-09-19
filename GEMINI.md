# Antigravity / Gemini Workspace Rules: Sanjivani Clinical Intake Assistant

## Mandatory Rules for Test Entity Lifecycle & Database Hygiene

### 1. Mandatory Deletion of Test Profiles (Patients & Doctors)
Whenever you create or register a **Patient** or **Doctor** profile for testing, debugging, demonstration, or reproduction:
- **YOU MUST ALWAYS DELETE IT IMMEDIATELY** after your test or verification completes.
- **NEVER leave dummy, simulated, or test profiles** in the persistent database (`sanjivani.db`, Supabase PostgreSQL, or any cloud instance).
- Cascade deletion must remove all associated test artifacts:
  - Any **Intake Sessions** (`intake_sessions`) linked to the test patient/doctor.
  - Any **Patient Documents** (`patient_documents`) linked to the test patient.
  - Any **Active OTPs** (`active_otps`) generated for the test identifier.
  - The **Patient** or **Doctor** record itself.

### 2. Automated Test Isolation & Fixture Teardowns
- All automated tests (`pytest`) that create patients or doctors MUST implement clean teardowns:
  - Register test entities using recognized test identifiers (e.g. `14-5555-4444-3333`, `14-1111-2222-3333`, `14-4444-5555-6666`, `14-9999-8888-7777`, `HP-DOC-TEST-001`, `HP-SEC-01010`, `HP-DOC-77889`, `HP-KA-99881` or prefixes `HP-TEST-*`, `14-0000-TEST-*`).
  - Purge them in `finally:` blocks or `pytest` fixture teardowns.
  - `tests/conftest.py` must enforce global pre-session and post-session purges for all known test IDs so that even failed tests never leak records into the database.

### 3. Post-Task Verification Gate
- Before concluding any task or interaction that involved creating or manipulating patient/doctor accounts:
  1. Inspect the database (`scripts/cleanup_test_data.py --inspect` or SQL query).
  2. Verify that **zero** test patient profiles and **zero** test doctor profiles remain.
  3. Ensure only genuine user/production profiles (e.g., `HP-RJ-68717` - Avirup Banerjee) are retained.

### 4. Preservation of Real Data
- Under no circumstances should real clinical profiles, genuine doctor credentials (`HP-RJ-68717`), or non-test patient records be deleted or modified.
- Always inspect records before deletion and verify they match test criteria.
