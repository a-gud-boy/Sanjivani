import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import (
    AharaViharaLifestyle,
    AyushDashavidhaPariksha,
    ChiefComplaint,
    ClinicalHistoryRecord,
    HpiSocrates,
    PatientDemographics,
    ScannedDocumentSummary,
    SummarizeRequest,
)
from app.services.llm_service import CLINICAL_SUMMARY_I18N, ClinicalLLMService

client = TestClient(app)

LANGUAGES = ["en", "hi", "bn", "ta", "te", "mr", "gu"]


def _make_clinical_record():
    return ClinicalHistoryRecord(
        patient_demographics=PatientDemographics(
            age_years=35,
            gender="male",
            language_preference="hi",
        ),
        chief_complaint=ChiefComplaint(
            symptom="Severe headache",
            duration="3 days",
        ),
        hpi_socrates=HpiSocrates(
            site="Forehead",
            onset="Sudden",
            character="Throbbing",
            radiation="Neck",
            severity_1_to_10=8,
            associations="Nausea",
            time_course="Worse in morning",
            exacerbating_relieving="Dark room relieves",
        ),
        ahara_vihara_lifestyle=AharaViharaLifestyle(
            sleep_pattern="Disturbed",
            diet_habits="Vegetarian",
            koshtha_bowel="Constipated",
            agni_digestion="Manda",
        ),
        ayush_dashavidha_pariksha=AyushDashavidhaPariksha(
            prakriti="Vata-Pitta",
            vikriti="Pitta",
            agni="Tikshna",
            koshtha="Krura",
        ),
        red_flag_alert=True,
    )


def _make_scan_results():
    return [
        ScannedDocumentSummary(
            document_label="Prescription",
            medications=[
                {"drug_name": "Paracetamol", "dosage": "650mg", "frequency": "TDS", "duration": "5 days"},
            ],
            lab_investigations=[
                {"parameter_name": "Hemoglobin", "observed_value": "13.5", "unit": "g/dL", "is_abnormal": False},
                {"parameter_name": "Blood Sugar (F)", "observed_value": "180", "unit": "mg/dL", "is_abnormal": True},
            ],
        )
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize("lang", LANGUAGES)
async def test_generate_clinical_summary_all_languages(lang: str):
    """Verify that summary generated for each language uses strictly localized headers and labels."""
    service = ClinicalLLMService()
    i18n = CLINICAL_SUMMARY_I18N[lang]

    req = SummarizeRequest(
        language=lang,
        chat_history=[
            {"role": "user", "content": "I have severe headache for 3 days and feel nauseous."},
        ],
        clinical_record=_make_clinical_record(),
        scan_results=_make_scan_results(),
    )

    # Mock the LLM to return a localized response
    mock_llm_response = (
        f"The patient reported throbbing headache and nausea for three days.\n\n"
        f"{i18n['recommendations_header']}:\n1. Hydration\n2. Neurological evaluation"
    )

    mock_llm = AsyncMock()
    mock_llm.ainvoke = AsyncMock(return_value=AsyncMock(content=mock_llm_response))

    with patch.object(service, "_llm", mock_llm):
        res = await service.generate_clinical_summary(req)

        assert res.status == "success"
        assert res.summary_text is not None

        # Verify expected localized headers are present
        assert f"{i18n['patient_info_header']}:" in res.summary_text
        assert f"{i18n['chief_complaint_header']}:" in res.summary_text
        assert f"{i18n['history_header']}:" in res.summary_text
        assert f"{i18n['clinical_narrative_header']}:" in res.summary_text
        assert f"{i18n['documents_header']}:" in res.summary_text
        assert f"{i18n['ayush_header']}:" in res.summary_text
        assert f"{i18n['red_flags_header']}:" in res.summary_text
        assert f"{i18n['recommendations_header']}:" in res.summary_text

        # For non-English languages, verify English headers do NOT leak
        if lang != "en":
            assert "PATIENT INFO:" not in res.summary_text
            assert "CHIEF COMPLAINT:" not in res.summary_text
            assert "HISTORY OF PRESENTING ILLNESS:" not in res.summary_text
            assert "CLINICAL NARRATIVE:" not in res.summary_text
            assert "DOCUMENTS & INVESTIGATIONS:" not in res.summary_text
            assert "AYUSH ASSESSMENT:" not in res.summary_text
            assert "RED FLAGS:" not in res.summary_text

        # Verify red flag emergency string is localized
        assert i18n["emergency_alert"] in res.summary_text
        assert res.summary_sections.red_flags == i18n["emergency_alert"]


@pytest.mark.asyncio
@pytest.mark.parametrize("lang", LANGUAGES)
async def test_summary_empty_state_localization(lang: str):
    """Verify empty summary fallback is localized to the chosen language."""
    service = ClinicalLLMService()
    i18n = CLINICAL_SUMMARY_I18N[lang]

    req = SummarizeRequest(
        language=lang,
        chat_history=[],
        clinical_record=None,
        scan_results=[],
    )

    res = await service.generate_clinical_summary(req)
    assert res.status == "success"
    assert res.summary_text == i18n["empty_data_fallback"]


def test_summarize_api_endpoint():
    """Verify /api/v1/summarize endpoint accepts language and returns localized summary."""
    payload = {
        "language": "hi",
        "chat_history": [
            {"role": "user", "content": "मुझे सिरदर्द है।"}
        ],
        "clinical_record": {
            "chief_complaint": {
                "symptom": "सिरदर्द",
                "duration": "2 दिन"
            }
        },
        "scan_results": []
    }

    res = client.post("/api/v1/summarize", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "मुख्य समस्या:" in data["summary_text"]
    assert "CHIEF COMPLAINT:" not in data["summary_text"]
