# Sanjivani (संजीवनी) - AI Clinical History-Taking & Medical Document Digitization Kiosk

**Ministry of Ayush | Smart India Hackathon**

Sanjivani is an intelligent, multimodal clinical intake and medical document digitization kiosk backend. It combines:
1. **Conversational Clinical History Intake**: Bridges evidence-based **Allopathic medicine (SOCRATES framework)** with traditional Indian medicine (**Ayurvedic Dashavidha Pariksha, Agni, and Koshtha**) into a unified clinical JSON representation.
2. **Direct Vision-Language Model (VLM) Document Digitization**: Directly processes prescription and laboratory test report images using advanced Multimodal VLMs (`openai/gpt-oss-120b`, `qwen/qwen3.6-27b`) to transcribe doctors' cursive handwriting and extract structured clinical medication and biomarker entities.

---

## Key Features

- **Unified Clinical Schema**: Seamlessly captures patient demographics, chief complaints, Allopathic SOCRATES pain/symptom history, Ayurvedic Dashavidha Pariksha (tenfold examination), and Ahara-Vihara (dietary, digestive fire, bowel habits).
- **Pydantic v2 Resilient Model (`Field(default=None)`)**: Engineered with explicit defaults and descriptive tags for all optional fields to prevent fatal schema validation errors during progressive LLM field population.
- **Conversational State Injection**: Injects conversational history (`chat_history`) directly into the prompt so the LLM retains exact linguistic nuances, intent, and context across multiple turns.
- **Dynamic Branching & Emergency Red-Flag Triage**: Automatically flags life-threatening symptoms (e.g., crushing chest pain, breathlessness, sudden paralysis, severe bleeding) to provide immediate emergency instructions.
- **Multilingual Support**: Generates the voice assistant's response (`next_question_to_ask_patient`) in the patient's preferred language (e.g., Hindi, English, Tamil, Telugu, etc.) while structuring all internal clinical database values in standardized English.
- **Direct VLM Document Digitization**:
  - Direct end-to-end multimodal perception bypassing brittle legacy OCR engines.
  - Exceptionally accurate at deciphering doctor cursive handwriting, dosages, frequency notations, and durations.
  - Automatically resolves doctor prescription abbreviations (e.g., `OD`, `BD`, `TDS`, `QID`, `HS`, `SOS`, `AC`, `PC`).
  - Extracts quantitative laboratory biomarkers, units, and flags abnormal readings (e.g., `FBS`, `PPBS`, `HbA1c`, `Serum Creatinine`, `Hemoglobin`).
  - Captures Ayurvedic formulations (e.g., `Churna`, `Vati`, `Kashayam`, `Asava`).
- **Production Ready**: Built on FastAPI with asynchronous lifespan management, CORS support, interactive Swagger docs, and DevContainer configuration.

---

## Project Structure

```
Sanjivani/
├── .devcontainer/
│   └── devcontainer.json          # VS Code DevContainer setup for isolated dev
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI application, CORS, routers & lifespans
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py              # Pydantic Settings & environment configuration
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py             # Allopathic, Ayush & OCR Pydantic v2 schemas
│   └── services/
│       ├── __init__.py
│       ├── llm_service.py         # Structured LLM chat & Direct VLM document parser
│       └── ocr_service.py         # Base64 image encoding and payload preparation
├── tests/
│   ├── __init__.py
│   ├── test_schemas.py            # Unit tests for clinical schemas & validations
│   ├── test_api.py                # Integration tests for FastAPI /api/v1/chat endpoint
│   └── test_ocr.py                # Tests for VLM document scanning endpoint
├── .env.example                   # Environment variable template
├── .gitignore
├── requirements.txt               # Pinned Python dependencies
└── README.md                      # Documentation
```

---

## API Endpoints Overview

### 1. `POST /api/v1/chat` (Conversational Intake)

#### Request Payload:
```json
{
  "user_text": "I have had severe burning in my stomach after meals for 3 weeks.",
  "current_json_state": null,
  "chat_history": []
}
```

---

### 2. `POST /api/v1/scan-document` (Direct VLM Document Digitization)

Accepts `multipart/form-data` with an image file under the key `file` (JPEG, PNG, WebP, TIFF, BMP).

#### Sample Response:
```json
{
  "status": "success",
  "data": {
    "medications": [
      {
        "drug_name": "Amoxicillin (Timox)",
        "dosage": "500mg Cap",
        "frequency": "3x a day / Thrice daily",
        "duration": "seven days"
      }
    ],
    "lab_investigations": [],
    "raw_text": "Name: Armando Coquia\nAddress: West Rimbo, Makati City\nAge: 29 Sex: M Date: 12-03-90\nRx\n(Timox)\nAmoxicillin 500mg Cap #21\nSig: 1 cap 3x a day for seven days.\nPhysician's Sig. (dela Cruz)\nLic. No. 123457\nPTR No. 1234567\nS2 No."
  }
}
```

---

## Running Tests

Execute the complete test suite with `pytest`:
```bash
pytest -v tests/
```
