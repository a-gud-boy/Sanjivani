from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class VayaAgeGroup(str, Enum):
    BALYA = "Balya"          # Childhood / Young age (up to ~16-20 years)
    MADHYAMA = "Madhyama"    # Adult / Middle age (~20-60 years)
    JIRNA = "Jirna"          # Old age / Geriatric (>60 years)


class PrakritiType(str, Enum):
    VATA = "Vata"
    PITTA = "Pitta"
    KAPHA = "Kapha"
    VATA_PITTA = "Vata-Pitta"
    PITTA_KAPHA = "Pitta-Kapha"
    VATA_KAPHA = "Vata-Kapha"
    SAMA = "Sama"            # Tridoshaja / Balanced


class KoshthaType(str, Enum):
    KRURA = "Krura"          # Hard / Constipated / Vata-predominant bowel
    MRIDU = "Mridu"          # Soft / Lax / Pitta-predominant bowel
    MADHYA = "Madhya"        # Moderate / Normal / Kapha or balanced bowel


class AgniType(str, Enum):
    VISHAMAGNI = "Vishamagni"    # Irregular digestive fire (Vata)
    TIKSHNAGNI = "Tikshnagni"    # Intense / hyperactive digestive fire (Pitta)
    MANDAGNI = "Mandagni"        # Sluggish / hypoactive digestive fire (Kapha)
    SAMAGNI = "Samagni"          # Balanced digestive fire


class PatientDemographics(BaseModel):
    vaya_age_group: Optional[VayaAgeGroup] = Field(
        default=None,
        description="Ayurvedic age group classification: Balya (childhood), Madhyama (middle age), or Jirna (elderly)."
    )
    gender: Optional[str] = Field(
        default=None,
        description="Patient's self-identified gender (e.g., Male, Female, Other)."
    )
    age_years: Optional[int] = Field(
        default=None,
        ge=0,
        le=125,
        description="Patient's chronological age in completed years."
    )
    language_preference: str = Field(
        default="en",
        description="Patient's preferred interaction language code or name (e.g., 'en' for English, 'hi' for Hindi, 'ta' for Tamil, etc.)."
    )


class ChiefComplaint(BaseModel):
    symptom: Optional[str] = Field(
        default=None,
        description="Primary presenting clinical symptom or complaint (Pradhana Vedana)."
    )
    duration: Optional[str] = Field(
        default=None,
        description="Duration of the primary symptom (e.g., '3 days', '2 weeks', '6 months')."
    )


class HpiSocrates(BaseModel):
    site: Optional[str] = Field(
        default=None,
        description="Site: Anatomical location where the symptom/pain is experienced."
    )
    onset: Optional[str] = Field(
        default=None,
        description="Onset: How the symptom started (e.g., sudden, gradual, associated trigger)."
    )
    character: Optional[str] = Field(
        default=None,
        description="Character: Nature and quality of the pain or discomfort (e.g., throbbing, sharp, dull, burning, aching)."
    )
    radiation: Optional[str] = Field(
        default=None,
        description="Radiation: Whether the symptom/pain spreads to other anatomical regions."
    )
    associations: Optional[str] = Field(
        default=None,
        description="Associations: Concomitant symptoms experienced alongside the chief complaint (e.g., nausea, dizziness, vomiting)."
    )
    time_course: Optional[str] = Field(
        default=None,
        description="Time course: Diurnal or chronological pattern (e.g., worse in mornings, episodic, constant, progressive)."
    )
    exacerbating_relieving: Optional[str] = Field(
        default=None,
        description="Exacerbating/Relieving factors: Circumstances, foods, postures, or activities that aggravate or alleviate the symptom."
    )
    severity_1_to_10: Optional[int] = Field(
        default=None,
        ge=1,
        le=10,
        description="Severity: Subjective symptom/pain severity rating on a 1 to 10 scale."
    )


class AyushDashavidhaPariksha(BaseModel):
    prakriti: Optional[PrakritiType] = Field(
        default=None,
        description="Prakriti: Physical and psychological constitution (Vata, Pitta, Kapha, Dual, Sama)."
    )
    vikriti: Optional[str] = Field(
        default=None,
        description="Vikriti: Doshic imbalance or pathological deviation from baseline constitution."
    )
    sara: Optional[str] = Field(
        default=None,
        description="Sara: Tissue excellence / Dhatu sarata (e.g., Rakta, Mamsa, Meda, Asthi, Majja, Sukra, Twak, Satva)."
    )
    samhanana: Optional[str] = Field(
        default=None,
        description="Samhanana: Compactness, symmetry, and muscular-skeletal build (Pravara, Madhyama, Avara)."
    )
    pramana: Optional[str] = Field(
        default=None,
        description="Pramana: Anthropometric bodily dimensions and physical proportions (Anjana/Sama)."
    )
    satmya: Optional[str] = Field(
        default=None,
        description="Satmya: Homologation and suitability to dietary substances, habits, and climatic conditions."
    )
    sattva: Optional[str] = Field(
        default=None,
        description="Sattva: Mental strength, emotional resilience, and psychological endurance (Pravara, Madhyama, Avara)."
    )
    ahara_shakti: Optional[str] = Field(
        default=None,
        description="Ahara Shakti: Capacity for food ingestion (Abhyavaharana Shakti) and digestion (Jarana Shakti)."
    )
    vyayama_shakti: Optional[str] = Field(
        default=None,
        description="Vyayama Shakti: Physical strength, work capacity, and exertion tolerance."
    )
    vaya: Optional[str] = Field(
        default=None,
        description="Vaya: Biological age assessment relative to chronological age and functional vitality."
    )


class AharaViharaLifestyle(BaseModel):
    koshtha_bowel: Optional[KoshthaType] = Field(
        default=None,
        description="Koshtha: Nature of bowel evacuation and gut motility (Krura, Mridu, or Madhya)."
    )
    agni_digestion: Optional[AgniType] = Field(
        default=None,
        description="Agni: State of digestive metabolic fire (Vishamagni, Tikshnagni, Mandagni, Samagni)."
    )
    sleep_pattern: Optional[str] = Field(
        default=None,
        description="Nidra: Sleep patterns, duration, ease of falling asleep, nocturnal awakenings, and daytime drowsiness."
    )
    diet_habits: Optional[str] = Field(
        default=None,
        description="Ahara: Dietary patterns, meal timings, taste preferences (Rasa), and food intolerances."
    )


class ClinicalHistoryRecord(BaseModel):
    patient_demographics: Optional[PatientDemographics] = Field(
        default=None,
        description="Patient demographic information and language preference."
    )
    chief_complaint: Optional[ChiefComplaint] = Field(
        default=None,
        description="Chief complaint and symptom duration."
    )
    hpi_socrates: Optional[HpiSocrates] = Field(
        default=None,
        description="History of Presenting Illness mapped to the Allopathic SOCRATES framework."
    )
    ayush_dashavidha_pariksha: Optional[AyushDashavidhaPariksha] = Field(
        default=None,
        description="Ayurvedic Tenfold Clinical Examination parameters (Dashavidha Pariksha)."
    )
    ahara_vihara_lifestyle: Optional[AharaViharaLifestyle] = Field(
        default=None,
        description="Ayurvedic dietary, digestive fire (Agni), bowel (Koshtha), and lifestyle parameters."
    )
    red_flag_alert: bool = Field(
        default=False,
        description="Emergency triage alert flag (set to True if chest pain, severe bleeding, sudden paralysis, or severe breathlessness is detected)."
    )
    next_question_to_ask_patient: str = Field(
        default="Namaste! Please describe what health problem brings you in today.",
        description="The localized natural language question or clinical instruction to speak to the patient next."
    )
    suggested_quick_replies: List[str] = Field(
        default_factory=list,
        description="3 to 5 dynamic, contextual quick-reply option chips tailored to the current question for the patient to tap (in the patient's language)."
    )


class ChatRequest(BaseModel):
    user_text: str = Field(
        ...,
        description="Spoken or typed response from the patient for this conversational turn."
    )
    current_json_state: Optional[ClinicalHistoryRecord] = Field(
        default=None,
        description="The existing clinical JSON state gathered up to the previous turn."
    )
    chat_history: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Complete conversational history with previous turns [{'role': 'user'|'assistant', 'content': '...'}]."
    )


class ChatResponse(BaseModel):
    status: str = Field(
        default="success",
        description="Execution status of the clinical intake processing."
    )
    data: ClinicalHistoryRecord = Field(
        ...,
        description="The updated structured clinical history record."
    )


# ============================================================================
# Phase 2: Medical Document Digitization Models
# ============================================================================

class ExtractedMedication(BaseModel):
    drug_name: Optional[str] = Field(
        default=None,
        description="The generic or brand name of the prescribed pharmaceutical medication, supplement, or Ayurvedic formulation (e.g., 'Paracetamol', 'Amoxicillin', 'Metformin', 'Ashwagandha Churna', 'Triphala Vati', 'Chyawanprash')."
    )
    dosage: Optional[str] = Field(
        default=None,
        description="The prescribed dosage strength, unit, or quantity per administration (e.g., '500 mg', '650 mg', '2 tablets', '10 ml', '1 tsp', '1 puff')."
    )
    frequency: Optional[str] = Field(
        default=None,
        description="The dosing frequency and administration timing, expanding standard medical abbreviations into clear language (e.g., 'OD / Once daily', 'BD / Twice daily', 'TDS / Thrice daily', 'QID / Four times daily', 'HS / At bedtime', 'SOS / As needed', 'AC / Before food', 'PC / After food', 'STAT / Immediately')."
    )
    duration: Optional[str] = Field(
        default=None,
        description="The total length of time or course for which the medication is prescribed (e.g., '5 days', '7 days', '2 weeks', '1 month', 'Continuous / Ongoing')."
    )


class ExtractedLabInvestigation(BaseModel):
    parameter_name: Optional[str] = Field(
        default=None,
        description="The standardized clinical name of the laboratory investigation, biomarker, or diagnostic test (e.g., 'Hemoglobin (Hb)', 'Fasting Blood Sugar (FBS)', 'Postprandial Blood Sugar (PPBS)', 'HbA1c', 'Serum Creatinine', 'Blood Urea Nitrogen (BUN)', 'Total Leukocyte Count (TLC)', 'SGPT/ALT', 'SGOT/AST', 'Serum Bilirubin', 'Total Cholesterol', 'Triglycerides', 'Uric Acid', 'TSH')."
    )
    observed_value: Optional[str] = Field(
        default=None,
        description="The measured quantitative value or qualitative result finding observed in the diagnostic report (e.g., '13.8', '165', '1.2', '8.4', '8500', 'Positive', 'Negative', 'Normal', 'Traces')."
    )
    unit: Optional[str] = Field(
        default=None,
        description="The standard biological or chemical measurement unit associated with the test result (e.g., 'g/dL', 'mg/dL', '%', 'cells/cu.mm', 'U/L', 'mmol/L', 'mcg/dL', 'mIU/L')."
    )
    is_abnormal: Optional[bool] = Field(
        default=None,
        description="True if the observed value is outside the physiological reference range or marked with High (H), Low (L), star (*), or flagged as clinically abnormal; False if strictly within normal reference range; null if reference range is not stated."
    )


class OCRStructuredResult(BaseModel):
    medications: List[ExtractedMedication] = Field(
        default_factory=list,
        description="List of all detected prescription medications and Ayurvedic remedies extracted from the document."
    )
    lab_investigations: List[ExtractedLabInvestigation] = Field(
        default_factory=list,
        description="List of all detected laboratory tests, diagnostic parameters, and biological biomarkers extracted from the document."
    )
    raw_text: Optional[str] = Field(
        default=None,
        description="The raw unformatted OCR transcribed text detected across all bounding boxes in the document image."
    )


class ScanDocumentResponse(BaseModel):
    status: str = Field(
        default="success",
        description="Status of the document scan processing."
    )
    data: OCRStructuredResult = Field(
        ...,
        description="Structured clinical entities extracted from the medical document."
    )


# ---- Model Management Schemas -----------------------------------------------

class DownloadedModelInfo(BaseModel):
    id: str = Field(..., description="Unique model identifier or repo ID (e.g. google/medgemma-1.5-4b-it).")
    name: str = Field(..., description="Human-readable model name.")
    size_on_disk: Optional[str] = Field(default=None, description="Size of the model on disk (e.g. 8.6 GB).")
    source: str = Field(default="huggingface_cache", description="Source of the model (huggingface_cache, vllm_server, custom).")
    is_active: bool = Field(default=False, description="Whether this model is currently active for inference.")
    is_vllm_loaded: bool = Field(default=False, description="Whether this model is currently served by the local vLLM instance.")


class ModelsListResponse(BaseModel):
    status: str = Field(default="success")
    active_text_model: str = Field(..., description="Currently active text/conversational model.")
    active_vision_model: str = Field(..., description="Currently active vision model.")
    models: List[DownloadedModelInfo] = Field(default_factory=list, description="List of all discovered downloaded local models.")


class ModelSwitchRequest(BaseModel):
    model_name: str = Field(..., description="Model ID to activate.")
    target: str = Field(default="both", description="Target engine: 'text', 'vision', or 'both'.")


class ModelSwitchResponse(BaseModel):
    status: str = Field(default="success")
    message: str
    active_text_model: str
    active_vision_model: str
