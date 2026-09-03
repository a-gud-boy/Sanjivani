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

**Sanjivani** is a patient-facing clinical intake and medical document digitization kiosk system designed for Primary Health Centers (PHCs), district hospitals, and AYUSH clinics across India.

It bridges modern allopathic medicine with traditional Indian healthcare systems (**Ayurveda, Yoga, Unani, Siddha, Homeopathy**) while offering seamless integration with India's **Ayushman Bharat Digital Mission (ABDM)** ecosystem.

---

## 🌟 Key Capabilities

### 1. Dual Allopathic & AYUSH Clinical Reasoning
- **Allopathic Triage (SOCRATES framework)**: In-depth symptom investigation across Site, Onset, Character, Radiation, Associations, Timing, Exacerbating/relieving factors, and Severity (0–10).
- **Ayurvedic Dashavidha Pariksha**: Tenfold examination covering *Prakriti* (constitution), *Vikriti* (morbidity), *Sara* (tissue essence), *Samhanana* (compactness), *Pramana* (body proportions), *Satmya* (adaptability), *Satva* (mental strength), *Ahara-shakti* (food intake & digestion), *Vyayama-shakti* (work capacity), and *Vaya* (age).
- **Ahara-Vihara & Agni Analysis**: Detailed assessment of digestive fire (*Manda*, *Tikshna*, *Vishama*, *Sama*), bowel habits (*Koshtha*), dietary habits, sleep quality, and daily routine.

### 2. Full Multilingual AI & UI (7 Indian Languages)
- **Zero-Latency Language Switching**: Switch languages instantaneously at any time — before login, in the patient dashboard, or mid-intake consultation.
- **7 Supported Languages**: **English (`en`)**, **Hindi (`hi` - हिन्दी)**, **Bengali (`bn` - বাংলা)**, **Tamil (`ta` - தமிழ்)**, **Telugu (`te` - తెలుగు)**, **Marathi (`mr` - मराठी)**, and **Gujarati (`gu` - ગુજરાતી)**.
- **Bilingual Clinical Intelligence**: The AI speaks to the patient in their native tongue and provides 1-tap localized quick-reply choices, while strictly persisting clinical data in standardized English for doctor review.
- **Persistent Preferences**: Language selections are saved in local storage and persist seamlessly across logins and page reloads.

### 3. ABHA Identity & Role-Based Access Control
- **ABDM Compliance**: Fast authentication via 14-digit ABHA ID (e.g. `14-1234-5678-9012`) with simulated SMS OTP verification.
- **Patient Dashboard**: View verified health records, active/past medications, diagnostic lab reports, and past intake sessions.
- **Doctor Portal**: Specialized clinical review interface allowing doctors to inspect AI intake summaries, review uploaded lab records, and update prescriptions.
- **Self-Registration**: Built-in modal for new patients and healthcare practitioners to register ABHA profiles.

### 4. Direct VLM Prescription & Report Digitization
- **Vision-Language Model (VLM)**: Direct multimodal parsing using models such as `google/medgemma-1.5-4b-it`, `qwen/qwen3.6-27b`, or Gemini Flash.
- **Cursive Handwriting Deciphering**: Transcribes doctors' handwriting, extracting drug names, dosage formulations (*Churna*, *Vati*, *Kashayam*, *Capsule*), frequencies (`OD`, `BD`, `TDS`, `QID`, `HS`, `SOS`, `AC`, `PC`), and durations.
- **Lab Investigation Extraction**: Extracts quantitative biomarkers (`HbA1c`, `FBS`, `Serum Creatinine`, `Hemoglobin`, etc.) with reference ranges and abnormal flags.

### 5. Emergency Red-Flag Triage
- Automated real-time rule engine detecting life-threatening symptoms (e.g., acute chest pain radiating to the left arm, acute breathlessness, sudden facial droop or unilateral weakness, severe hemorrhaging).
- Triggers instant full-screen visual and auditory emergency alerts instructing the patient to visit casualty or call **108 / 102**.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python 3.12+** (configured in virtual environment `sihvenv312` or `.venv`)
- **Node.js 18+ & npm**
- *(Optional)* CUDA-compatible GPU if running local vLLM model server

---

### Option A: Using the Bash Launcher (Linux / macOS)
```bash
# Default: Starts database migration, backend (:8000), and frontend (:5173)
./start.sh

# Start without local vLLM (uses cloud AI / resilient fallback)
./start.sh --no-vllm

# Reset & re-seed database
./start.sh --reset-db
```

### Option B: Using the Cross-Platform Python Runner (Windows / Linux / macOS)
```bash
# Default launcher
python run.py

# Skip local vLLM
python run.py --no-vllm

# Reset & re-seed database
python run.py --reset-db
```

---

## 🌐 Service URLs & Ports

| Service | Address | Description |
| :--- | :--- | :--- |
| **Frontend UI (Kiosk & Web)** | [http://localhost:5173](http://localhost:5173) | React 18 + Vite responsive interface |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI asynchronous application |
| **Interactive Swagger Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | OpenAPI interactive documentation |
| **vLLM Inference Server** | [http://localhost:8001/v1](http://localhost:8001/v1) | Local OpenAI-compatible LLM/VLM endpoint |

---

## 🔑 One-Click Demo Test Accounts

The database is pre-seeded with test profiles for instant evaluation:

| Role | Name | ABHA ID | OTP (Sandbox) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Patient** | Ramesh Sharma (38y, M) | `14-1234-5678-9012` | `123456` | Has hypertension, active prescriptions & intake records |
| **Doctor** | Dr. Priya Nair (MD, Ayush) | `14-9988-7766-5544` | `654321` | Clinical practitioner with patient review access |

*Quick test accounts can also be auto-filled directly from the login page via the "One-Click Test Accounts" buttons.*

---

## 📁 Repository Structure

```
Sanjivani/
├── start.sh                       # Unified launcher script (Bash)
├── run.py                         # Cross-platform runner with auto-venv & DB sync (Python)
├── requirements.txt               # Backend dependencies (FastAPI, SQLAlchemy, Pydantic v2)
├── sanjivani.db                   # SQLite database (auto-created and seeded)
├── .devcontainer/
│   └── devcontainer.json          # Pre-configured Python 3.12 + Node.js LTS container
│
├── app/                           # FastAPI Clinical Backend
│   ├── main.py                    # App entrypoint, CORS, routers & exception handlers
│   ├── core/
│   │   ├── config.py              # Pydantic Settings (.env configuration)
│   │   └── database.py            # Async SQLAlchemy engine & session factory
│   ├── models/
│   │   ├── db_models.py           # Relational DB models (Users, Documents, Intakes, Meds)
│   │   └── schemas.py             # Pydantic v2 validation models & clinical schemas
│   └── services/
│       ├── auth_service.py        # ABHA validation, OTP generation & verification
│       ├── doctor_service.py      # Doctor clinical dashboards & intake session views
│       ├── patient_service.py     # Patient records, medication history & document storage
│       ├── llm_service.py         # Multilingual prompt engine, clinical fallback & LLM logic
│       └── ocr_service.py         # Image preprocessing & VLM payload orchestration
│
├── frontend/                      # React 18 + Vite Frontend Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Auth/              # LoginPage, RegisterModal
│   │   │   ├── Dashboard/         # PatientDashboard, DoctorPortal, PatientProfile
│   │   │   ├── Chat/              # ChatInterface, ChatBubble, QuickReplyChips, ChatEndOverlay
│   │   │   ├── Scanner/           # DocumentScanner, CameraCapture, PrescriptionViewer
│   │   │   ├── ClinicalSummary/   # SummaryModal, SOCRATES & AYUSH clinical report views
│   │   │   ├── Header.tsx         # Top bar with ABHA status & summary actions
│   │   │   ├── LanguageSelector.tsx # Reusable multilingual dropdown component
│   │   │   └── RedFlagAlert.tsx   # Visual & auditory emergency alert banner
│   │   ├── i18n/
│   │   │   └── translations.ts    # Comprehensive dictionary for all 7 Indian languages
│   │   ├── services/
│   │   │   └── api.ts             # Axios client for auth, dashboard, chat, and OCR APIs
│   │   └── types/                 # TypeScript type definitions & interfaces
│   ├── package.json
│   └── vite.config.ts
│
└── tests/                         # Pytest Automated Test Suite
    ├── test_api.py                # Chat API endpoint & CORS tests
    ├── test_auth_and_db.py        # ABHA verification, OTP & database session tests
    ├── test_config.py             # Application settings & environment tests
    ├── test_doctor.py             # Doctor portal endpoints & clinical summary tests
    ├── test_language.py           # Multilingual greeting, prompt injection & chat tests
    ├── test_ocr.py                # VLM document digitization tests
    └── test_schemas.py            # Pydantic v2 clinical schema validation tests
```

---

## 🛠️ API Reference

### 1. Multilingual Chat Intake
**`POST /api/v1/chat`**
```json
{
  "user_text": "मुझे पिछले 3 दिनों से सिरदर्द और तेज बुखार है",
  "language": "hi",
  "current_json_state": null,
  "chat_history": []
}
```

### 2. Direct VLM Document Scanning
**`POST /api/v1/scan-document`**
Accepts `multipart/form-data` with an image file (`.jpg`, `.png`, `.webp`, `.pdf`).
Returns structured medication objects, dosage, frequency, and quantitative lab biomarkers.

### 3. ABHA Authentication
- **`POST /api/v1/auth/request-otp`**: Request 6-digit OTP for ABHA ID.
- **`POST /api/v1/auth/verify-otp`**: Verify OTP and receive authenticated session.
- **`POST /api/v1/auth/register`**: Create new patient or practitioner profile.

### 4. Patient Health Record Management
- **`GET /api/v1/patient/{patient_id}/dashboard`**: Retrieve active medications, lab records, and consultations.
- **`PUT /api/v1/patient/{patient_id}/profile`**: Update personal health baseline, allergies, and contacts.
- **`POST /api/v1/patient/{patient_id}/intake-session`**: Save completed AI clinical intake consultation.

---

## 🧪 Testing & Verification

Run the comprehensive pytest suite:
```bash
# Run all 48 automated test cases
pytest -v tests/

# Run multilingual test suite specifically
pytest -v tests/test_language.py
```

Build the frontend production bundle:
```bash
cd frontend && npm run build
```

---

## 👥 Contributors & Acknowledgements
- Developed for **Smart India Hackathon (SIH 2026)**
- In accordance with standards from the **Ministry of Ayush** and **National Health Authority (ABDM)**
