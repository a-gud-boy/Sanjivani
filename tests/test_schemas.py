import pytest
from pydantic import ValidationError

from app.models.schemas import (
    AgniType,
    AharaViharaLifestyle,
    AyushDashavidhaPariksha,
    ChatRequest,
    ChatResponse,
    ChiefComplaint,
    ClinicalHistoryRecord,
    HpiSocrates,
    KoshthaType,
    PatientDemographics,
    PrakritiType,
    VayaAgeGroup,
)


def test_empty_instantiation_field_default_none_fix():
    """Verify that all models can be instantiated without arguments (Field(default=None) fix)."""
    demographics = PatientDemographics()
    assert demographics.vaya_age_group is None
    assert demographics.gender is None
    assert demographics.age_years is None
    assert demographics.language_preference == "en"

    chief = ChiefComplaint()
    assert chief.symptom is None
    assert chief.duration is None

    hpi = HpiSocrates()
    assert hpi.site is None
    assert hpi.onset is None
    assert hpi.character is None
    assert hpi.radiation is None
    assert hpi.associations is None
    assert hpi.time_course is None
    assert hpi.exacerbating_relieving is None
    assert hpi.severity_1_to_10 is None

    dashavidha = AyushDashavidhaPariksha()
    assert dashavidha.prakriti is None
    assert dashavidha.vikriti is None
    assert dashavidha.sara is None
    assert dashavidha.samhanana is None
    assert dashavidha.pramana is None
    assert dashavidha.satmya is None
    assert dashavidha.sattva is None
    assert dashavidha.ahara_shakti is None
    assert dashavidha.vyayama_shakti is None
    assert dashavidha.vaya is None

    ahara = AharaViharaLifestyle()
    assert ahara.koshtha_bowel is None
    assert ahara.agni_digestion is None
    assert ahara.sleep_pattern is None
    assert ahara.diet_habits is None

    record = ClinicalHistoryRecord()
    assert record.patient_demographics is None
    assert record.chief_complaint is None
    assert record.hpi_socrates is None
    assert record.ayush_dashavidha_pariksha is None
    assert record.ahara_vihara_lifestyle is None
    assert record.red_flag_alert is False
    assert isinstance(record.next_question_to_ask_patient, str)


def test_full_clinical_history_record_population():
    """Verify full data structure serializes and validates cleanly."""
    record = ClinicalHistoryRecord(
        patient_demographics=PatientDemographics(
            vaya_age_group=VayaAgeGroup.MADHYAMA,
            gender="Female",
            age_years=35,
            language_preference="hi",
        ),
        chief_complaint=ChiefComplaint(
            symptom="Severe lower back pain with morning stiffness",
            duration="3 weeks",
        ),
        hpi_socrates=HpiSocrates(
            site="Lumbar spine",
            onset="Gradual",
            character="Aching with intermittent spasm",
            radiation="Left buttock",
            associations="Mild morning fatigue",
            time_course="Worse upon waking, eases with movement",
            exacerbating_relieving="Cold weather aggravates; hot fomentation relieves",
            severity_1_to_10=6,
        ),
        ayush_dashavidha_pariksha=AyushDashavidhaPariksha(
            prakriti=PrakritiType.VATA_PITTA,
            vikriti="Vata Vriddhi with Asthi-Majjagata pathology",
            sara="Madhyama Sara",
            samhanana="Madhyama",
            pramana="Sama",
            satmya="Madhyama",
            sattva="Pravara",
            ahara_shakti="Madhyama Jarana Shakti",
            vyayama_shakti="Avara",
            vaya="Madhyama Vaya",
        ),
        ahara_vihara_lifestyle=AharaViharaLifestyle(
            koshtha_bowel=KoshthaType.KRURA,
            agni_digestion=AgniType.VISHAMAGNI,
            sleep_pattern="Disturbed, 5-6 hours with frequent awakenings",
            diet_habits="Irregular meal times, prefers warm and spiced food",
        ),
        red_flag_alert=False,
        next_question_to_ask_patient="क्या आप बता सकते हैं कि क्या दर्द झुकने पर बढ़ जाता है?",
    )

    dumped = record.model_dump()
    assert dumped["patient_demographics"]["vaya_age_group"] == "Madhyama"
    assert dumped["patient_demographics"]["language_preference"] == "hi"
    assert dumped["hpi_socrates"]["severity_1_to_10"] == 6
    assert dumped["ahara_vihara_lifestyle"]["koshtha_bowel"] == "Krura"
    assert dumped["ahara_vihara_lifestyle"]["agni_digestion"] == "Vishamagni"


def test_severity_validation_bounds():
    """Verify HpiSocrates severity is bounded between 1 and 10."""
    with pytest.raises(ValidationError):
        HpiSocrates(severity_1_to_10=0)

    with pytest.raises(ValidationError):
        HpiSocrates(severity_1_to_10=11)

    valid_hpi = HpiSocrates(severity_1_to_10=10)
    assert valid_hpi.severity_1_to_10 == 10


def test_chat_request_with_history():
    """Verify ChatRequest accepts chat_history and current_json_state."""
    req = ChatRequest(
        user_text="I have had abdominal discomfort for 4 days.",
        chat_history=[
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Namaste! What health concern brings you in?"},
        ],
    )
    assert len(req.chat_history) == 2
    assert req.user_text == "I have had abdominal discomfort for 4 days."
    assert req.current_json_state is None
