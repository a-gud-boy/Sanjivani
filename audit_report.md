# Sanjivani (संजीवनी) — Clinical Intake & EHR Architecture Audit Report

**Audit Date:** 18 September 2026  
**Auditor:** Sanjivani Lead Critique & Systems Security Agent  
**Target Project:** Sanjivani Clinical Intake Assistant (`/media/bruno/Files/Projects/SIH 2026/Sanjivani`)  
**Audit Artifact Under Review:** `browser_test_report.md` (Conversation `25f2d5c8-79ea-4540-bb06-4e3a202d7c1b`)  
**Deployment Target:** Frontend on GitHub Pages / Local Vite (`:5173`), Backend on Render (`https://sanjivani-9ne0.onrender.com`), Database on Supabase Cloud PostgreSQL  

---

## 1. Executive Summary & Assessment Scorecard

A thorough architectural, UX/UI, and security audit was conducted on the Sanjivani Clinical Intake Assistant, reviewing both the automated browser testing report (`browser_test_report.md`) with its visual verification artifacts and the underlying full-stack codebase.

Sanjivani demonstrates strong foundations in its core mission: an Ayushman Bharat Digital Mission (ABDM) aligned clinical intake kiosk integrating Allopathic (SOCRATES) and Ayurvedic (Dashavidha Pariksha, Agni, Koshtha) diagnostic models, multilingual support (7 Indian languages), and Vision-Language Model (VLM) prescription digitization.

However, critical systemic vulnerabilities and UX shortcomings were identified that must be addressed prior to clinical production deployment:

### Overall Quality Scorecard

| Domain | Rating | Status | Summary of Findings |
| :--- | :---: | :---: | :--- |
| **Authentication & Authorization** | **4.8 / 5.0** | 🟢 **RESOLVED** | SEC-01 (OTP leakage), SEC-02 (BOLA on medical data), and SEC-03 (cosmetic tokens) fully remediated with cryptographic HS256 JWTs, role-based FastAPI dependencies, object-level ownership checks, and frontend Axios interceptor. |
| **Clinical Safety & Medical Data** | **2.5 / 5.0** | 🟠 **HIGH RISK** | Fictitious fallback clinical data (hardcoded B+ blood group, 38y age, fake phone); unrestricted deletion of medical records. |
| **Test Verification Integrity** | **2.0 / 5.0** | 🟠 **HIGH RISK** | Test report claims 100% pass despite CDP logs confirming chat interaction was skipped (`Chat input detected: false`); tests hit live Gemini API unmocked. |
| **UI / UX & Accessibility** | **3.5 / 5.0** | 🟡 **MODERATE RISK** | Polished visual styling, but mixed language leakage (hardcoded Hindi in English mode), dummy microphone recorder with no STT transcription, and lack of i18n on Doctor Portal. |
| **AI & LLM Service Pipeline** | **3.8 / 5.0** | 🟢 **ACCEPTABLE** | High-quality prompt engineering, SOCRATES/Ayurvedic structuring, robust thought token cleaning; missing client timeout and live API mock isolation in CI. |
| **Database & Infrastructure** | **3.0 / 5.0** | 🟡 **MODERATE RISK** | Asynchronous SQLAlchemy with PostgreSQL/SQLite support; lacks Alembic migration engine; in-memory OTP cache breaks under multi-worker scaling. |

---

## 2. In-Depth Critique of `browser_test_report.md` & UI Flows

The previous browser test report (`browser_test_report.md`) documented automated Chrome DevTools Protocol (CDP) testing across the authentication and portal landing flows. Below is an exhaustive critique of the reported results, visual evidence, and UX execution:

### 2.1 Verification Integrity & Missed Test Scenarios
1. **False Completeness on Chat Intake**:
   - The test report claims complete validation of the patient journey. However, line 517 of the execution transcript reveals:
     ```text
     --- Testing Chat Interaction ---
     Chat input detected: false
     ```
   - **Root Cause**: Upon patient login, `App.tsx` navigates to `patient_dashboard`, not `intake`. The automated test script looked for chat inputs on the dashboard where none existed, silently failed, and proceeded directly to the doctor login flow without testing the core clinical conversational engine.
   - **Recommendation**: The test suite must click the **Add Details (नया विवरण जोड़ें)** button to transition `currentView` to `intake`, submit multiple symptoms, verify AI clinical response turns, validate dynamic quick replies, and assert SOCRATES entity extraction.
2. **Missing Document Scanner & OCR Validation**:
   - The test script did not upload or scan any medical prescriptions or laboratory reports via the `ScannerPanel` component.
   - Neither the camera capture hook (`useCameraCapture`) nor the multimodal VLM extraction pipeline was exercised in the browser.
3. **Missing Doctor Dossier Inspection**:
   - The doctor flow only verified loading of the patient roster. It never clicked on a patient to open the **Patient Dossier Modal**, test clinical tab switching (Consultations, Prescriptions, Medications, Baseline), or verify prescription inspection.

---

### 2.2 Visual Critique of UI Screenshots

#### Screenshot 1: Initial Login Landing (`login_page.png`)
- **Strengths**:
  - Balanced card layout with backdrop blur and clean AYUSH brand palette (emerald/teal tones).
  - Clear distinction between "Patient (मरीज़)" and "Doctor (चिकित्सक)" role toggles.
  - Distinct ABHA ID input card with national formatting hint (`14-XXXX-XXXX-XXXX`).
- **Critique & Defects**:
  - **No Input Masking**: The input field accepts freeform text. Patients are expected to manually type hyphens. It should automatically format digits into `##-####-####-####` as the citizen types.
  - **Subtle Header Contrast**: The header subtitle (`Ministry of Ayush • National Health Authority`) renders in small 11px text (`text-slate-500`) with poor contrast on light backgrounds, failing WCAG AA (requires 4.5:1 for body/small text).
  - **Language Selector Display**: The selector button displays "English" without showing the native script preview ("English / हिन्दी"), making it harder for non-English-literate citizens to discover the dropdown.

#### Screenshot 2: Patient OTP Verification (`browser_02_patient_otp_displayed.png`)
- **Strengths**:
  - Informative banner showing masked mobile number (`+91 ******3210`).
  - Active 30-second countdown timer disabling the resend button to prevent SMS flood.
- **Critique & Defects**:
  - **Severe Security Violation (Plaintext OTP on Screen)**:
    - The amber banner displays `VERIFICATION OTP (SMS SIMULATOR) 895838` with an `Auto-fill` button.
    - While designed as a simulation aid, this OTP was returned in the API response from the **live production Render backend** (`https://sanjivani-9ne0.onrender.com`).
    - Any attacker with a citizen's ABHA ID can send a POST request to `/api/v1/auth/patient/request-otp` and receive the full 6-digit OTP directly in the JSON response, completely bypassing 2FA.
  - **Hardcoded Name Formatting**: "Welcome, ye" shows that the patient registration endpoint allowed a 2-character test string (`"ye"`) as a full legal name. Input validation should enforce minimum length, proper character sets, and trim anomalies.

#### Screenshot 3: Patient Dashboard (`browser_03_patient_intake_loaded.png`)
- **Strengths**:
  - Well-structured hierarchy: sticky top bar, identity card, hero banner, baseline indicators, and medication schedule.
  - Clear categorization of "Active (0)" vs "Past Medications (0)".
- **Critique & Defects**:
  - **Language Leakage (Mixed Hindi/English)**:
    - In English mode, the main CTA button displays `Add Details (नया विवरण जोड़ें)`.
    - Hardcoding Devanagari inside the button label violates internationalization. If a user selects Bengali, Tamil, Telugu, Marathi, or Gujarati, the button still shows Hindi.
  - **Dangerous Fallback Medical Data**:
    - Lines 172-179 of `PatientDashboard.tsx`:
      ```tsx
      ({patient.age_years || 38}y, {patient.gender || 'Male'})
      {String(patientDetails.blood_group || 'B+')}
      Phone: {patient.phone || '+91 98765 43210'}
      ```
    - When a patient has not provided their blood group, the UI displays `B+` with a red droplet icon! In a clinical medical system, **displaying a fake blood group is a dangerous clinical safety hazard**. If a patient or paramedic relies on this during emergency triage, the consequences could be disastrous. It MUST display `Not specified` or `Pending test`.
  - **Hidden Conversational AI**:
    - For an AI-first clinical kiosk, the conversational intake is tucked away behind a secondary button click rather than being front-and-center or clearly positioned as the primary action.
  - **Truncated Empty States**:
    - The "Medications Schedule" card displays an empty pill icon with no helpful instructions or shortcut to scan a prescription slip.

#### Screenshot 4 & 5: Doctor Portal & Clinical Registry (`browser_06_doctor_portal_loaded.png`)
- **Strengths**:
  - Professional clinical oversight station with HPR verification badge (`HPR Verified Clinician`).
  - High-level metric summary cards (Registered Patients, Triage Red Flags, Digitized Prescriptions, Consultation Sessions).
  - Search filter supporting both patient name and ABHA ID.
- **Critique & Defects**:
  - **Missing Language Selector**: The Doctor Portal header omits the `LanguageSelector` component entirely! Clinicians cannot switch interface language.
  - **Zero Internationalization (i18n)**: All doctor portal text is hardcoded in English. `translations.ts` has no dictionary entries for doctor portal components.
  - **Lack of Patient Consent Verification**: The doctor can view all patients in the entire database immediately upon login without any patient-granted OTP consent or ABDM Consent Artifact.

---

## 3. Comprehensive Codebase Technical Audit

### 3.1 Security & Access Control (Critical Severity)

#### [RESOLVED] SEC-01: Plaintext OTP Returned in Public HTTP Responses
- **Status:** ✅ **RESOLVED** (18 September 2026)
- **Location:** `app/api/auth.py`, `app/core/config.py`
- **Vulnerability:** The backend endpoints `/auth/patient/request-otp` and `/auth/doctor/request-otp` previously populated `otp=code` and `simulated_otp=code` in the JSON response payload regardless of environment configuration.
- **Risk:** Complete 2FA bypass. Any client or malicious script could query the endpoint and read the valid OTP directly from the response body.
- **Resolution Applied:** 
  1. Configured `ENVIRONMENT` with `is_production` and `is_development` flags in `app/core/config.py`.
  2. Implemented `_should_expose_otp() -> bool` in `app/api/auth.py`: returns `True` strictly when `settings.DEBUG is True` AND `settings.is_production is False`.
  3. Sanitized production logs: logs `Generated verification OTP for '%s' (dispatched via SMS gateway, TTL: 10m)` without printing plaintext OTPs.
  4. Verified with automated test suite `tests/test_sec01_otp_leak.py` (5/5 tests passed).

---

#### [RESOLVED] SEC-02: Broken Object Level Authorization (BOLA) on Medical Data
- **Status:** ✅ **RESOLVED** (18 September 2026)
- **Location:** `app/api/doctor.py`, `app/api/patient.py`, `app/api/deps.py`, `app/core/security.py`
- **Vulnerability:**
  - `GET /api/v1/doctor/patients` was completely unauthenticated.
  - `GET /api/v1/patient/dashboard` accepted arbitrary patient IDs without token validation.
  - `DELETE /api/v1/patient/document/{id}` and `DELETE /api/v1/patient/intake-session/{id}` accepted raw IDs without session ownership verification.
  - `PUT /api/v1/patient/profile` accepted any ID and overwrote profile data.
- **Risk:** Unrestricted medical data exfiltration and tampering. Violates HIPAA, DISHA, ABDM data privacy guidelines, and OWASP API Security Risks (API1:2023 BOLA).
- **Resolution Applied:**
  1. Created `app/core/security.py` with standard HS256 JWT encoding (`create_access_token`) and verification (`decode_access_token`).
  2. Implemented FastAPI security dependencies in `app/api/deps.py`: `get_current_user`, `require_patient_user`, and `require_doctor_user`.
  3. Secured doctor endpoints (`/api/v1/doctor/patients`, `/api/v1/doctor/patient/{patient_id}`) with `require_doctor_user` (returns 401 for unauthenticated, 403 for patients).
  4. Enforced strict object-level validation in `app/api/patient.py`:
     - Dashboard enforces that patient callers can only access their own records (`clean_id in (current_user.id, current_user.abha_id)`), returning 403 Forbidden on mismatch. Clinicians are authorized to view patient records.
     - Document deletion, intake session deletion, intake session creation, and profile update all enforce patient identity match (403 Forbidden on cross-patient actions).
  5. Verified with automated test suite `tests/test_sec02_bola.py` (18/18 tests passed) and updated `tests/test_doctor.py` (5/5 passed).

---

#### [RESOLVED] SEC-03: Cosmetic Token System & Frontend Security Theater
- **Status:** ✅ **RESOLVED** (18 September 2026)
- **Location:** `app/core/security.py`, `app/api/auth.py`, `frontend/src/services/api.ts`, `frontend/src/App.tsx`
- **Vulnerability:**
  - Login endpoints previously generated unverified UUID strings (`sanjivani-token-{uuid.uuid4()}`).
  - Frontend Axios client never attached an `Authorization: Bearer <token>` header.
- **Risk:** Complete absence of session enforcement. If an attacker bypassed the frontend UI, all backend endpoints were wide open.
- **Resolution Applied:**
  1. Replaced arbitrary UUIDs with cryptographically signed HS256 JWT tokens containing `sub`, `role`, `iat`, `exp` claims issued upon successful OTP verification and registration.
  2. Configured Axios request interceptor in `frontend/src/services/api.ts` to automatically attach `Authorization: Bearer <token>` from `localStorage.getItem('sanjivani_auth_token')`.
  3. Added `setAuthToken(token)` upon verification/registration and token clearance in `frontend/src/App.tsx` upon logout.
  4. Verified full end-to-end integration via `npm --prefix frontend run build` (passed cleanly with zero errors) and all backend auth test suites.

---

#### [HIGH] SEC-04: Single-Process In-Memory OTP Cache
- **Location:** `app/api/auth.py` (lines 20-48)
- **Vulnerability:**
  ```python
  _ACTIVE_OTPS: Dict[str, Tuple[str, float]] = {}
  ```
  - Active OTPs are stored in a standard Python dictionary in process memory.
- **Risk:**
  - Under multi-worker server deployments (`uvicorn app.main:app --workers 4` or Gunicorn), worker processes have isolated memory spaces. An OTP requested on Worker A will fail verification when the subsequent verify request lands on Worker B.
  - Server restarts or autoscaling instances immediately discard all active OTPs.
- **Remediation:** Store OTPs in Redis or in a dedicated database table (`active_otps`) with `expires_at`, `attempts_count`, and row-level locking.

---

#### [MEDIUM] SEC-05: Wildcard CORS with Credentials
- **Location:** `app/main.py` (lines 65-71)
- **Vulnerability:**
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```
- **Risk:**
  - Modern web browsers reject responses where `Access-Control-Allow-Credentials: true` is combined with wildcard `Access-Control-Allow-Origin: *`.
  - If dynamically reflected, it permits arbitrary third-party malicious origins to make credentialed requests to the healthcare backend.
- **Remediation:** Define an explicit whitelist of allowed origins (e.g., `["http://localhost:5173", "https://<your-username>.github.io"]`) loaded from an environment variable `ALLOWED_CORS_ORIGINS`.

---

#### [MEDIUM] SEC-06: Production Secrets in Repository `.env`
- **Location:** `.env` (root directory)
- **Vulnerability:** The local `.env` file contains live API credentials:
  - Google Gemini API Key (`GEMINI_API_KEY=AQ.Ab8RN6ISpRu...`)
  - Supabase Cloud PostgreSQL pooler connection string with plaintext password
  - Render API Key and Service ID (`RENDER_API_KEY=rnd_6KBvhYVe...`)
- **Risk:** While `.env` is listed in `.gitignore`, developers frequently risk accidental commits or exposure during script backups or artifact transfers.
- **Remediation:** Rotate these keys immediately. Use secret managers (e.g. Render Environment Secret Groups, Doppler, or GitHub Secrets) for deployment environments.

---

### 3.2 AI & Clinical Processing Architecture

#### [HIGH] AI-01: Un-Mocked Live Gemini API Calls in Test Suite
- **Location:** `tests/test_language.py` (lines 23-33, 65-80)
- **Issue:**
  - `test_chat_init_all_supported_languages` executes 7 live HTTP requests to Google Gemini across all supported languages.
  - `test_chat_endpoint_with_language_parameter` executes a live clinical intake inference turn to Google Gemini.
  - During test runs, these calls can take 60-90+ seconds, cause timeout failures if the network blips, and consume the user's API quota.
- **Remediation:** Mock `ClinicalLLMService.generate_initial_greeting` and `ClinicalLLMService.process_chat` in unit tests using `unittest.mock.patch`, identical to `tests/test_api.py`. Tag live API tests with `@pytest.mark.integration` and gate them behind an environment variable (`RUN_LIVE_LLM_TESTS=1`).

---

#### [MEDIUM] AI-02: Missing Timeout on AsyncOpenAI Client
- **Location:** `app/services/llm_service.py` (lines 120-127)
- **Issue:**
  ```python
  self._direct_chat_client = AsyncOpenAI(
      api_key=self.text_api_key,
      base_url=self.text_base_url or None,
  )
  ```
  - The OpenAI Python SDK defaults to a 10-minute (600s) timeout if unspecified. If Google Gemini or the proxy hangs, incoming HTTP requests from patients will freeze the FastAPI worker thread for up to 10 minutes.
- **Remediation:** Pass an explicit `timeout=30.0` to `AsyncOpenAI`.

---

#### [HIGH] AI-03: Dummy Audio Recording in Frontend (Dead-End Feature)
- **Location:** `frontend/src/components/Chat/ChatInterface.tsx` (lines 51-58), `frontend/src/hooks/useAudioRecorder.ts`
- **Issue:**
  - The chat interface includes a microphone button that triggers `useAudioRecorder`.
  - `useAudioRecorder` records microphone input into an `audioBlob: Blob | null`.
  - However, `ChatInterface.tsx` **never destructures `audioBlob`**, never sends it to a backend speech-to-text (STT) endpoint, and never integrates the browser's Web Speech API (`webkitSpeechRecognition`).
  - When a patient clicks the mic, speaks, and stops, the recording is silently discarded into memory void without transcribing a single word.
- **Remediation:**
  1. Primary: Integrate the browser's native `SpeechRecognition` / `webkitSpeechRecognition` with language mapping (`hi-IN`, `ta-IN`, `bn-IN`, `te-IN`, `mr-IN`, `gu-IN`, `en-IN`) for real-time speech-to-text.
  2. Fallback: Implement a `/api/v1/chat/transcribe-audio` endpoint using Gemini Multimodal Audio or Whisper to transcribe `audioBlob`.

---

#### [MEDIUM] AI-04: Monolingual End-of-Chat Heuristic
- **Location:** `frontend/src/components/Chat/ChatInterface.tsx` (lines 11-15)
- **Issue:**
  - `END_INTENT_PHRASES` only checks English terms: `done`, `that's all`, `finished`, `bye`, `thank you`.
  - If an Indian citizen speaking Hindi says `"बस इतना ही"`, `"धन्यवाद"`, or `"हो गया"`, the end-intent banner is never triggered.
- **Remediation:** Expand end-intent phrases into the multilingual translation dictionary (`translations.ts`) for all 7 supported Indian languages.

---

### 3.3 Frontend Architecture & UI/UX Issues

#### [MEDIUM] FE-01: Incomplete Internationalization (Doctor Portal & Patient Dashboard)
- **Location:** `frontend/src/components/Doctor/DoctorPortal.tsx`, `frontend/src/components/Dashboard/PatientDashboard.tsx`
- **Issue:**
  - `DoctorPortal.tsx` does not use the `useTranslation` hook. All text, titles, labels, badges, and empty states are hardcoded in English.
  - The Doctor Portal header has no `LanguageSelector`.
  - `PatientDashboard.tsx` contains hardcoded Hindi `Add Details (नया विवरण जोड़ें)` in the primary hero banner button, regardless of whether the citizen selected English, Tamil, Telugu, or Bengali.
- **Remediation:** Extract all Doctor Portal strings into `i18n/translations.ts`, add `LanguageSelector` to the doctor header, and bind all dashboard buttons to localized dictionary keys.

---

#### [HIGH] FE-02: Clinically Hazardous Hardcoded Fallbacks
- **Location:** `frontend/src/components/Dashboard/PatientDashboard.tsx` (lines 172-179)
- **Issue:**
  - If a patient profile lacks age, blood group, or phone number, the UI injects hardcoded fallbacks:
    - Age: `patient.age_years || 38`
    - Blood Group: `patientDetails.blood_group || 'B+'`
    - Phone: `patient.phone || '+91 98765 43210'`
- **Risk:** Showing a default blood group `B+` on an EHR screen is a critical medical safety hazard. If clinical staff rely on this display without cross-checking laboratory confirmation, it could result in incompatible blood transfusion reactions.
- **Remediation:** Replace all synthetic defaults with clear indicators: `"Not documented"`, `"Unknown"`, or `"Pending laboratory typing"`.

---

#### [MEDIUM] FE-03: Zero Frontend Test Coverage
- **Location:** `frontend/package.json`
- **Issue:**
  - `package.json` contains scripts for `dev`, `build`, `preview`, and `lint`, but **no test script or testing framework** (no Vitest, Jest, or React Testing Library).
  - The frontend has zero component unit tests, snapshot tests, or regression tests.
- **Remediation:** Install `vitest`, `@testing-library/react`, and `@testing-library/user-event`. Add component tests for `LoginPage`, `PatientDashboard`, `ChatInterface`, and `DoctorPortal`.

---

### 3.4 Database & Infrastructure Architecture

#### [MEDIUM] DB-01: Missing Database Migration System (Alembic)
- **Location:** `app/db/seed.py`, `app/main.py`
- **Issue:**
  - Database tables are created on startup via `await init_db()` which calls `Base.metadata.create_all(engine)`.
  - `create_all` does not apply schema updates, column alterations, or index changes to existing tables.
  - Any future schema changes (e.g., adding an auth token table or consent records) will require manual SQL migrations or dropping existing production tables.
- **Remediation:** Initialize Alembic (`alembic init alembic`) and configure migration scripts for automated schema versioning.

---

#### [LOW] DB-02: Missing Indexes on Foreign Keys and Lookups
- **Location:** `app/db/models.py`
- **Issue:**
  - While `patient_id` on `intake_sessions` has an index, `session_date` and `status` are unindexed.
  - In `patient_documents`, searching by `file_type` or filtering documents by `created_at` performs sequential table scans.
- **Remediation:** Add composite indexes on `(patient_id, created_at DESC)` and `(doctor_id, status)`.

---

## 4. Prioritized Remediation Roadmap

The table below outlines a structured, actionable plan to resolve all identified issues:

| Priority | ID | Status | Component | Task Description | Effort | Risk Level |
| :---: | :--- | :---: | :--- | :--- | :---: | :---: |
| **P0** | **SEC-01** | ✅ **Resolved** | Backend Auth | Gate `simulated_otp` behind `DEBUG=True` only; redact OTPs in production responses. | 1 hr | 🔴 Critical |
| **P0** | **SEC-02** | ✅ **Resolved** | Backend Auth | Implement JWT authentication with role-based access control (`get_current_user`). | 3 hrs | 🔴 Critical |
| **P0** | **SEC-03** | ✅ **Resolved** | Frontend API | Attach Bearer tokens in Axios interceptor and protect all API routes. | 1.5 hrs | 🔴 Critical |
| **P0** | **FE-02** | ⏳ Pending | Frontend UI | Remove fake medical fallbacks (`B+`, `38y`, `+91 98765...`) in `PatientDashboard`. | 0.5 hr | 🔴 Critical |
| **P1** | **AI-01** | ⏳ Pending | Backend Tests | Mock Gemini API calls in `tests/test_language.py` to prevent CI hangs & quota burn. | 1 hr | 🟠 High |
| **P1** | **AI-03** | ⏳ Pending | Frontend Chat | Implement native browser `SpeechRecognition` for working voice-to-text. | 2 hrs | 🟠 High |
| **P1** | **SEC-04** | ⏳ Pending | Backend DB | Migrate in-memory `_ACTIVE_OTPS` to database/Redis with TTL for multi-worker safety. | 2 hrs | 🟠 High |
| **P2** | **FE-01** | ⏳ Pending | Frontend i18n | Add i18n dictionary to Doctor Portal; remove hardcoded Hindi from English dashboard. | 2 hrs | 🟡 Medium |
| **P2** | **AI-02** | ⏳ Pending | Backend AI | Configure explicit 30s timeout on `AsyncOpenAI` client in `llm_service.py`. | 0.5 hr | 🟡 Medium |
| **P2** | **AI-04** | ⏳ Pending | Frontend Chat | Localize `hasEndIntent` to recognize Hindi, Tamil, Bengali, Telugu phrases. | 1 hr | 🟡 Medium |
| **P2** | **SEC-05** | ⏳ Pending | Backend Main | Replace `allow_origins=["*"]` + `allow_credentials=True` with explicit whitelist. | 0.5 hr | 🟡 Medium |
| **P3** | **DB-01** | ⏳ Pending | Backend DB | Setup Alembic migration environment for structured relational migrations. | 2 hrs | 🔵 Low |
| **P3** | **FE-03** | ⏳ Pending | Frontend Test | Add Vitest + React Testing Library suite for core frontend components. | 3 hrs | 🔵 Low |

---

## 5. Conclusion

The Sanjivani application demonstrates exceptional domain modeling and prompt architecture for Ayush-integrated digital healthcare. However, the current build prioritizes demonstration convenience over clinical security and production rigor. 

By removing plaintext OTP responses, enforcing strict JWT-based authorization on medical records, eliminating dangerous fallback medical vitals, wiring up real speech-to-text transcription, and isolating unit tests from live external LLM network requests, Sanjivani will meet the stringent reliability, safety, and security requirements demanded of India's national digital health infrastructure.
