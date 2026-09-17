# Sanjivani (संजीवनी) 🌿

### AI-Powered Clinical Intake, Multilingual Triage & Medical Document Digitization Kiosk
**Smart India Hackathon 2026 | Ministry of Ayush & National Health Authority (ABDM)**

[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178c6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📌 Executive Overview

**Sanjivani** is an advanced patient-facing clinical intake, triage, and medical document digitization kiosk system engineered for Primary Health Centers (PHCs), district hospitals, and AYUSH wellness centers across India.

It bridges modern allopathic clinical reasoning with traditional Indian healthcare systems (**Ayurveda, Yoga, Unani, Siddha, Homeopathy**) while integrating seamlessly with India's **Ayushman Bharat Digital Mission (ABDM)** ecosystem.

---

## 🌟 Key Capabilities

### 1. Dual Allopathic & AYUSH Clinical Reasoning
- **Allopathic Triage (SOCRATES framework)**: Systematic symptom investigation across Site, Onset, Character, Radiation, Associations, Timing, Exacerbating/relieving factors, and Severity (0–10).
- **Ayurvedic Dashavidha Pariksha**: Tenfold examination covering *Prakriti* (constitution), *Vikriti* (morbidity), *Sara* (tissue essence), *Samhanana* (compactness), *Pramana* (body proportions), *Satmya* (adaptability), *Satva* (mental strength), *Ahara-shakti* (digestive & food intake capacity), *Vyayama-shakti* (work capacity), and *Vaya* (age).
- **Ahara-Vihara & Agni Analysis**: Detailed assessment of digestive fire (*Manda*, *Tikshna*, *Vishama*, *Sama*), bowel habits (*Koshtha*), dietary habits, sleep quality, and daily routine.

### 2. Full Multilingual AI & UI (7 Indian Languages)
- **Zero-Latency Language Switching**: Switch languages instantaneously at any time — before login, on the dashboard, or mid-intake consultation.
- **7 Supported Languages**: **English (`en`)**, **Hindi (`hi` - हिन्दी)**, **Bengali (`bn` - বাংলা)**, **Tamil (`ta` - தமிழ்)**, **Telugu (`te` - తెలుగు)**, **Marathi (`mr` - मराठी)**, and **Gujarati (`gu` - ગુજરાતી)**.
- **Bilingual Clinical Intelligence**: The AI interacts with patients in their native tongue and renders contextual 1-tap quick-reply choices, while strictly persisting clinical data in standardized English for physician review.
- **Persistent Preferences**: Language selection persists automatically via local storage across browser reloads and authenticated sessions.

### 3. ABDM Identity & Complete Role Separation
- **Patient Identity (ABHA ID)**: Compliant with Ayushman Bharat Health Account (ABHA) standards (`14-XXXX-XXXX-XXXX`) for patient health record federation.
- **Healthcare Professional Identity (HP ID)**: Complete architectural separation for clinicians utilizing dedicated 10-digit Health Professional IDs (`HP-XXXX-XXXX`) with medical council registration and license validation.
- **Cryptographic OTP Engine**: Production-grade in-memory OTP engine featuring 10-minute TTL, constant-time validation (`secrets.compare_digest`), and one-time consumption (logged directly to the backend console during development/demo).
- **Dedicated Self-Registration**: Specialized registration flows (`PatientRegisterModal` for instant digital health card generation and `DoctorRegisterModal` for healthcare practitioner credentialing).
- **Patient Dashboard**: View verified health records, active vs. past medication timelines, diagnostic lab records, and past intake consultations.
- **Doctor Clinical Portal**: Comprehensive clinical review interface allowing healthcare practitioners to search patients, inspect AI intake summaries, and review digitized lab/prescription records.

### 4. Direct VLM Prescription & Report Digitization
- **Vision-Language Model (VLM)**: Direct multimodal parsing using models such as Google Gemini Flash, `google/medgemma-1.5-4b-it`, or `qwen/qwen3.6-27b`.
- **Cursive Handwriting Deciphering**: Accurately transcribes doctor handwriting, extracting medication names, dosage formulations (*Churna*, *Vati*, *Kashayam*, *Capsule*, *Syrup*), frequencies (`OD`, `BD`, `TDS`, `QID`, `HS`, `SOS`, `AC`, `PC`), and durations.
- **Lab Investigation Extraction**: Extracts quantitative biomarkers (`HbA1c`, `FBS`, `Serum Creatinine`, `Hemoglobin`, etc.) with reference ranges and abnormal flags.
- **Prescription Date & Lifecycle Tracking**: Automatically identifies prescription dates and computes medication duration to distinguish active vs. past medications.

### 5. Emergency Red-Flag Triage
- Automated real-time rule engine detecting life-threatening symptoms (e.g., acute chest pain radiating to left arm, acute breathlessness, sudden facial droop or unilateral weakness, severe hemorrhaging).
- Triggers instant full-screen visual and auditory emergency alerts instructing the patient to visit casualty immediately or dial **108 / 102**.

### 6. Kiosk-Optimized Multimodal Interaction
- **Integrated Camera Capture**: Capture instant photos of paper prescriptions and physical lab reports using built-in kiosk webcams or mobile cameras.
- **Microphone Voice Input**: Hands-free voice recording via the browser `MediaRecorder` API for effortless spoken intake at rural kiosks.
- **Light / Dark Mode**: Accessible high-contrast UI theme toggle designed for diverse lighting environments in clinical kiosks.

### 7. AI Pre-Consultation Summary
- Generates a structured narrative clinical summary synthesized from the multi-turn intake chat and all uploaded diagnostic documents.
- Formats chief complaints, HPI, AYUSH assessment, lab abnormalities, and recommended next steps for immediate physician review.

### 8. Dynamic Model Switching & Flexible Provider Support
- Dynamically inspect and switch active models at runtime (e.g. Google Gemini 2.5 Flash, Gemini Pro, Gemma 4, or local vLLM instances) directly from the UI or via API without restarting the backend.
- Supports separated endpoints and keys for Conversational Text LLM and Vision VLM (e.g., Groq, Ollama, OpenAI-compatible servers).

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.12+** (configured in virtual environment `sihvenv312` or `.venv`)
- **Node.js 18+ & npm**
- *(Optional)* CUDA-compatible GPU if hosting local models via vLLM

---

> 🪟 **Running on Windows?** Check the dedicated [Windows Setup Guide (README_WINDOWS.md)](./README_WINDOWS.md) for step-by-step PowerShell, WSL 2, and troubleshooting instructions.

---

### Option A: Using the Bash Launcher (Linux / macOS / WSL 2)
```bash
# Default: Starts database migration, backend (:8000), frontend (:5173), and Cloudflare tunnel
./start.sh

# Start without local vLLM (uses cloud AI / Google Gemini)
./start.sh --no-vllm

# Start in local-only mode without public Cloudflare tunnel
./start.sh --no-vllm --no-tunnel

# Reset database schema
./start.sh --reset-db
```

### Option B: Using the Cross-Platform Python Runner (Windows / Linux / macOS)
```bash
# Run backend & frontend with cloud AI (Google Gemini)
python run.py --no-vllm

# Reset the local SQLite database schema
python run.py --reset-db

# Run with local vLLM server enabled (requires CUDA GPU)
python run.py
```

---

## 🌐 Service URLs & Ports

| Service | Address | Description |
| :--- | :--- | :--- |
| **Frontend UI (Kiosk & Web)** | [http://localhost:5173](http://localhost:5173) | React 18 + Vite responsive kiosk interface |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI asynchronous application |
| **Interactive Swagger Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | OpenAPI interactive documentation |
| **ReDoc Documentation** | [http://localhost:8000/redoc](http://localhost:8000/redoc) | Alternative OpenAPI documentation |
| **vLLM Inference Server** *(Optional)* | [http://localhost:8001/v1](http://localhost:8001/v1) | Local OpenAI-compatible LLM/VLM endpoint |
| **Public Kiosk Tunnel** *(Optional)* | *Auto-generated URL* | Cloudflare Quick Tunnel for remote/mobile testing |

---

## 🔑 Getting Started with Free Google Gemini AI

Sanjivani runs completely free using Google Gemini's generous free tier (no credit card or local GPU required):

1. **Visit Google AI Studio**: Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. **Sign In**: Log in using any standard Google / Gmail account.
3. **Create Key**: Click the blue **"Create API key"** button.
4. **Select Project**: Choose **"Create API key in new project"** (generates instantly in 1 click).
5. **Copy Key**: Copy the generated key string (starts with `AIzaSy...`).
6. **Add to `.env`**:
   Open or create your `.env` file in the project root:
   ```ini
   GEMINI_API_KEY=AIzaSyYourCopiedKeyHere
   GEMINI_MODEL_NAME=gemini-2.5-flash
   ```
7. **Launch Sanjivani**:
   ```bash
   ./start.sh --no-vllm       # Linux / macOS / WSL 2
   python run.py --no-vllm   # Windows PowerShell / CMD
   ```

*Sanjivani will automatically detect your Gemini key on startup and route conversational intake and handwriting prescription OCR with zero local GPU VRAM needed!*

---

## ⚙️ Environment Configuration (`.env`)

Copy `.env.example` to `.env` to customize settings:

```ini
# --- Server & Global Settings ---
PROJECT_NAME="Sanjivani Clinical Intake Assistant"
API_V1_PREFIX="/api/v1"
DEBUG=False

# --- 1. Google Gemini Configuration (Zero GPU Cloud Mode) ---
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL_NAME=gemini-2.5-flash

# --- 2. Conversational Text LLM (Optional custom endpoint / Groq / vLLM) ---
TEXT_LLM_API_KEY=EMPTY
TEXT_LLM_MODEL_NAME=gemini-2.5-flash
TEXT_LLM_BASE_URL=

# --- 3. Multimodal Vision VLM (Optional custom endpoint / vLLM) ---
VISION_LLM_API_KEY=EMPTY
VISION_LLM_MODEL_NAME=google/medgemma-1.5-4b-it
VISION_LLM_BASE_URL=http://localhost:8001/v1

# --- 4. Relational Database ---
# Default: Local asynchronous SQLite database (Zero Cost)
DATABASE_URL=sqlite+aiosqlite:///./sanjivani.db
# Cloud PostgreSQL Alternative (e.g., Supabase / Neon / Render Postgres):
# DATABASE_URL=postgresql+asyncpg://user:password@host/dbname
```

---

## ☁️ Cloud Deployment (Render)

Sanjivani includes first-class deployment configuration for [Render](https://render.com) using `render.yaml` and `Procfile`.

### Deploying to Render
1. Push this repository to GitHub or GitLab.
2. Log in to Render and create a **New Blueprint Instance** pointing to your repository.
3. Configure the required environment variables:
   - `GEMINI_API_KEY`: Your Google AI Studio API key.
   - `DATABASE_URL`: Cloud PostgreSQL or persistent SQLite connection string.
4. Render will automatically build the service using `pip install -r requirements.txt` and run `uvicorn app.main:app`.

### Render CLI Management Utility
Manage your cloud deployment directly from your terminal using `scripts/render_manager.py`:
```bash
# Check current deployment and service status
python scripts/render_manager.py status

# List recent deployments and build outcomes
python scripts/render_manager.py deploys --limit 5

# Trigger a fresh cloud deployment (optionally clear build cache)
python scripts/render_manager.py deploy [--clear-cache]

# Restart the live service
python scripts/render_manager.py restart

# Inspect or update remote environment variables
python scripts/render_manager.py env-list
python scripts/render_manager.py env-set KEY=VALUE
```

---

## 📁 Repository Structure

```
Sanjivani/
├── start.sh                       # Unified launcher script with venv & tunnel support (Bash)
├── run.py                         # Cross-platform runner with auto-venv & DB sync (Python)
├── render.yaml                    # Render Blueprint deployment specification
├── Procfile                       # Production process declaration
├── requirements.txt               # Backend dependencies (FastAPI, SQLAlchemy, Pydantic v2)
├── sanjivani.db                   # SQLite database (auto-created and schema synchronized)
├── .env.example                   # Environment configuration template
├── README.md                      # Main project documentation
├── README_WINDOWS.md              # Dedicated Windows setup guide (PowerShell, WSL 2, Docker)
├── .devcontainer/
│   └── devcontainer.json          # Pre-configured Python 3.12 + Node.js LTS container
│
├── app/                           # FastAPI Clinical Backend
│   ├── main.py                    # App entrypoint, CORS, routers & exception handlers
│   ├── api/                       # Modular REST API route handlers
│   │   ├── auth.py                # ABHA & HP ID registration, cryptographic OTP, session verification
│   │   ├── doctor.py              # Doctor clinical portal & patient search endpoints
│   │   └── patient.py             # Patient records, intake sessions, medication lifecycle
│   ├── core/
│   │   ├── config.py              # Pydantic Settings (.env configuration & model routing)
│   │   └── date_utils.py          # Prescription date extraction & medication duration parsing
│   ├── db/
│   │   ├── database.py            # Async SQLAlchemy engine & session factory
│   │   ├── models.py              # Relational DB models (Patients, Doctors, Documents, Intakes)
│   │   └── seed.py                # Database initialization & schema synchronization
│   ├── models/
│   │   └── schemas.py             # Pydantic v2 validation models & clinical schemas
│   └── services/
│       ├── llm_service.py         # Multilingual prompt engine, clinical fallback & LLM logic
│       └── ocr_service.py         # Image preprocessing & VLM payload orchestration
│
├── frontend/                      # React 18 + Vite Frontend Application
│   ├── src/
│   │   ├── App.tsx                # Main view router (Auth, Dashboard, Doctor, Intake)
│   │   ├── components/
│   │   │   ├── Auth/              # LoginPage, PatientRegisterModal, DoctorRegisterModal
│   │   │   ├── Chat/              # ChatInterface, ChatBubble, QuickReplyChips, ChatEndOverlay
│   │   │   ├── ClinicalSummary/   # SummaryModal (SOCRATES & AYUSH clinical report views)
│   │   │   ├── Dashboard/         # PatientDashboard (Timeline, Meds, Lab Records)
│   │   │   ├── Doctor/            # DoctorPortal (Clinical review & patient dossier)
│   │   │   ├── DocumentScanner/   # ScannerPanel, ExtractedDataCard
│   │   │   ├── Profile/           # PatientProfile (Demographics, emergency contacts)
│   │   │   ├── BrandLogo.tsx      # Sanjivani brand identity component
│   │   │   ├── Header.tsx         # Top navigation bar with ABHA status & summary triggers
│   │   │   ├── LanguageSelector.tsx # Reusable 7-language dropdown component
│   │   │   ├── ModelSelector.tsx  # Dynamic LLM/VLM runtime model switcher
│   │   │   ├── RedFlagAlert.tsx   # Visual & auditory emergency alert banner
│   │   │   └── ThemeToggle.tsx    # Dark / Light mode accessibility toggle
│   │   ├── hooks/
│   │   │   ├── useAudioRecorder.ts # Browser MediaRecorder hook for voice intake
│   │   │   └── useCameraCapture.ts # Webcam/kiosk camera snapshot hook
│   │   ├── i18n/
│   │   │   └── translations.ts    # Comprehensive dictionary for all 7 Indian languages
│   │   ├── services/
│   │   │   └── api.ts             # Axios client for auth, dashboard, chat, and OCR APIs
│   │   └── types/
│   │       └── index.ts           # Core TypeScript types and API interfaces
│   ├── package.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
│
├── scripts/
│   └── render_manager.py          # Render Cloud deployment & environment CLI utility
│
└── tests/                         # Automated Test Suite (50 Tests)
    ├── conftest.py                # Test fixtures, session cleanup & entity teardown
    ├── test_api.py                # Chat API, CORS, model endpoints & health tests
    ├── test_auth_and_db.py        # ABHA & HP ID verification, OTP & database session tests
    ├── test_config.py             # Application settings & environment tests
    ├── test_doctor.py             # Doctor portal endpoints & clinical summary tests
    ├── test_language.py           # Multilingual greeting, prompt injection & chat tests
    ├── test_ocr.py                # VLM document digitization & encoding tests
    └── test_schemas.py            # Pydantic v2 clinical schema validation tests
```

---

## 🛠️ API Reference

### 1. Clinical Intake & Conversation
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/chat/init` | Generate dynamic multilingual opening greeting and starter quick-reply symptom chips |
| `POST` | `/api/v1/chat` | Process conversational intake turn, update SOCRATES/AYUSH clinical JSON, and return next clinical question |
| `POST` | `/api/v1/summarize` | Generate structured AI narrative clinical pre-consultation summary from chat + scanned documents |

### 2. Document Digitization (VLM)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/scan-document` | Upload medical document image (`.jpg`, `.png`, `.webp`, `.tiff`) for direct multimodal VLM extraction of medications, dosages, frequencies, and lab values |

### 3. Model Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/models` | List all available local Hugging Face cached and active remote AI models |
| `POST` | `/api/v1/models/select` | Dynamically switch active model for conversational intake or document OCR without server restart |

### 4. Authentication & Identity Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/patient/request-otp` | Request secure 6-digit OTP for registered Patient ABHA ID |
| `POST` | `/api/v1/auth/patient/verify-otp` | Verify Patient OTP code and issue authenticated patient session |
| `POST` | `/api/v1/auth/patient/register` | Self-register a new Patient profile with 14-digit ABHA ID & digital health card |
| `POST` | `/api/v1/auth/doctor/request-otp` | Request secure 6-digit OTP for registered Doctor HP ID |
| `POST` | `/api/v1/auth/doctor/verify-otp` | Verify Doctor OTP code and issue authenticated clinician session |
| `POST` | `/api/v1/auth/doctor/register` | Self-register a new Doctor profile with 10-digit HP ID & clinical credentials |
| `GET` | `/api/v1/auth/me` | Fetch profile information for the authenticated user (Patient or Doctor) |
| `POST` | `/api/v1/auth/request-otp` | Unified/legacy endpoint: Request OTP for ABHA ID or HP ID |
| `POST` | `/api/v1/auth/verify-otp` | Unified/legacy endpoint: Verify OTP and issue profile session |
| `POST` | `/api/v1/auth/register` | Unified/legacy endpoint: Register patient or doctor profile |

### 5. Patient Health Records
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/patient/dashboard` | Retrieve patient health dossier, active/past medications, and intake consultations (`?patient_id=...`) |
| `POST` | `/api/v1/patient/intake-session` | Save a completed clinical intake consultation with chat history, documents, and summary |
| `PUT` | `/api/v1/patient/profile` | Update demographics, allergies, chronic conditions, and emergency contacts |
| `DELETE` | `/api/v1/patient/document/{doc_id}` | Remove a stored diagnostic or prescription document |
| `DELETE` | `/api/v1/patient/intake-session/{session_id}` | Remove an intake session record |

### 6. Doctor Clinical Portal
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/doctor/patients` | Retrieve registered patient directory with optional search filtering (`?search=...`) |
| `GET` | `/api/v1/doctor/patient/{patient_id}` | Retrieve comprehensive patient dossier and clinical intake records for practitioner review |

### 7. System Health & Diagnostics
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` / `/api/v1/health` | Health check endpoint returning service and database connectivity status |
| `GET` | `/` | Root endpoint displaying project name, status, and link to interactive API docs |

---

## 🧪 Testing & Verification

Run the comprehensive pytest suite covering all 50 automated test cases:

```bash
# Run the complete test suite
pytest -v tests/

# Run multilingual test suite specifically
pytest -v tests/test_language.py

# Run VLM OCR digitization tests
pytest -v tests/test_ocr.py

# Run authentication and database tests
pytest -v tests/test_auth_and_db.py
```

Build the frontend production bundle:
```bash
cd frontend && npm run build
```

---

## 👥 Contributors & Acknowledgements
- Developed for **Smart India Hackathon (SIH 2026)**
- Designed in alignment with standards from the **Ministry of Ayush** and **National Health Authority (ABDM)**
