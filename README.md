# Sanjivani (संजीवनी) - AI Clinical History-Taking Assistant

**Ministry of Ayush | Smart India Hackathon**

Sanjivani is an intelligent, multimodal conversational clinical intake kiosk backend. It bridges modern evidence-based medicine (**Allopathic SOCRATES framework**) with traditional Indian medicine (**Ayurvedic Dashavidha Pariksha, Agni, and Koshtha**) into a unified clinical JSON representation.

---

## Key Features

- **Unified Clinical Schema**: Seamlessly captures patient demographics, chief complaints, Allopathic SOCRATES pain/symptom history, Ayurvedic Dashavidha Pariksha (tenfold examination), and Ahara-Vihara (dietary, digestive fire, bowel habits).
- **Pydantic v2 Resilient Model (`Field(default=None)`)**: Engineered with explicit defaults for all optional fields to prevent fatal schema validation errors during progressive LLM field population.
- **Conversational State Injection**: Injects conversational history (`chat_history`) directly into the prompt so the LLM retains exact linguistic nuances, intent, and context across multiple turns.
- **Dynamic Branching & Emergency Red-Flag Triage**: Automatically flags life-threatening symptoms (e.g., crushing chest pain, breathlessness, sudden paralysis, severe bleeding) to provide immediate emergency instructions.
- **Multilingual Support**: Generates the voice assistant's response (`next_question_to_ask_patient`) in the patient's preferred language (e.g., Hindi, English, Tamil, Telugu, etc.) while structuring all internal clinical database values in standardized English.
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
│   │   └── schemas.py             # Allopathic & Ayush Pydantic v2 schemas & contracts
│   └── services/
│       ├── __init__.py
│       └── llm_service.py         # LangChain OpenAI structured output engine
├── tests/
│   ├── __init__.py
│   ├── test_schemas.py            # Unit tests for clinical schemas & validations
│   └── test_api.py                # Integration tests for FastAPI /api/v1/chat endpoint
├── .env.example                   # Environment variable template
├── .gitignore
├── requirements.txt               # Pinned Python dependencies
└── README.md                      # Documentation
```

---

## Clinical Schema Overview

### 1. Patient Demographics (`patient_demographics`)
- `vaya_age_group`: `Balya` (Childhood), `Madhyama` (Adult/Middle), `Jirna` (Elderly)
- `gender`: Male, Female, Other
- `age_years`: Completed years (0-125)
- `language_preference`: ISO code or name (e.g., `en`, `hi`, `ta`)

### 2. Chief Complaint (`chief_complaint`)
- `symptom`: Primary presenting complaint
- `duration`: Time course (e.g., `3 days`, `2 weeks`)

### 3. Allopathic SOCRATES (`hpi_socrates`)
- `site`: Anatomical location
- `onset`: Sudden, gradual, triggers
- `character`: Sharp, dull, throbbing, burning, aching
- `radiation`: Anatomical spread
- `associations`: Nausea, dizziness, vomiting, fever
- `time_course`: Diurnal/temporal pattern
- `exacerbating_relieving`: Aggravating & relieving factors
- `severity_1_to_10`: Severity rating (1 to 10)

### 4. Ayurvedic Dashavidha Pariksha (`ayush_dashavidha_pariksha`)
- `prakriti`: `Vata`, `Pitta`, `Kapha`, `Vata-Pitta`, `Pitta-Kapha`, `Vata-Kapha`, `Sama`
- `vikriti`: Current doshic imbalance state
- `sara`: Tissue excellence (Dhatu Sarata)
- `samhanana`: Body build / compactness
- `pramana`: Bodily dimensions / proportions
- `satmya`: Homologation and adaptability
- `sattva`: Mental resilience (`Pravara`, `Madhyama`, `Avara`)
- `ahara_shakti`: Digestion power (`Abhyavaharana` & `Jarana Shakti`)
- `vyayama_shakti`: Physical endurance
- `vaya`: Age factor assessment

### 5. Ahara-Vihara & Lifestyle (`ahara_vihara_lifestyle`)
- `koshtha_bowel`: `Krura` (Hard/Vata), `Mridu` (Soft/Pitta), `Madhya` (Moderate)
- `agni_digestion`: `Vishamagni` (Vata), `Tikshnagni` (Pitta), `Mandagni` (Kapha), `Samagni` (Balanced)
- `sleep_pattern`: Duration, quality, awakenings (Nidra)
- `diet_habits`: Food habits, taste preferences, meal timings (Ahara Vidhi)

---

## Quick Start

### 1. Using DevContainer (Recommended)
Open this repository in VS Code and select **"Reopen in Container"**. The container will build automatically with Python 3.11, Ruff, Pylance, and all required dependencies.

### 2. Local Environment Setup
```bash
# 1. Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env and supply your OPENAI_API_KEY if testing live LLM inference
```

### 3. Run the Development Server
```bash
uvicorn app.main:app --reload --port 8000
```
Interactive Swagger API documentation will be available at: **`http://localhost:8000/docs`**

---

## API Usage Example

### `POST /api/v1/chat`

#### Request Payload:
```json
{
  "user_text": "I have had severe burning in my stomach after meals for 3 weeks.",
  "current_json_state": null,
  "chat_history": []
}
```

#### Response:
```json
{
  "status": "success",
  "data": {
    "patient_demographics": {
      "vaya_age_group": null,
      "gender": null,
      "age_years": null,
      "language_preference": "en"
    },
    "chief_complaint": {
      "symptom": "Severe burning in stomach after meals",
      "duration": "3 weeks"
    },
    "hpi_socrates": {
      "site": "Epigastrium / Stomach",
      "onset": "Gradual",
      "character": "Burning",
      "radiation": null,
      "associations": null,
      "time_course": "Post-prandial",
      "exacerbating_relieving": "Worse after meals",
      "severity_1_to_10": null
    },
    "ayush_dashavidha_pariksha": {
      "prakriti": null,
      "vikriti": "Pitta Vriddhi / Amlapitta",
      "sara": null,
      "samhanana": null,
      "pramana": null,
      "satmya": null,
      "sattva": null,
      "ahara_shakti": null,
      "vyayama_shakti": null,
      "vaya": null
    },
    "ahara_vihara_lifestyle": {
      "koshtha_bowel": null,
      "agni_digestion": "Tikshnagni",
      "sleep_pattern": null,
      "diet_habits": null
    },
    "red_flag_alert": false,
    "next_question_to_ask_patient": "Do you experience any sour belching, nausea, or does the pain radiate anywhere else?"
  }
}
```

---

## Running Tests

Execute unit and integration tests with `pytest`:
```bash
pytest -v tests/
```
