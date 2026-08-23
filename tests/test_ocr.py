import io
from unittest.mock import AsyncMock, patch
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.models.schemas import (
    ExtractedLabInvestigation,
    ExtractedMedication,
    OCRStructuredResult,
    ScanDocumentResponse,
)
from app.services.llm_service import ClinicalLLMService
from app.services.ocr_service import OCRService

client = TestClient(app)


def _create_sample_image_bytes() -> bytes:
    """Create a minimal valid PNG image in memory for testing."""
    img = Image.new("RGB", (200, 100), color=(255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_ocr_schemas():
    """Verify OCR Pydantic models instantiate cleanly with defaults."""
    med = ExtractedMedication(
        drug_name="Amoxicillin",
        dosage="500 mg",
        frequency="TDS / Thrice daily",
        duration="5 days",
    )
    assert med.drug_name == "Amoxicillin"
    assert med.dosage == "500 mg"
    assert med.frequency == "TDS / Thrice daily"
    assert med.duration == "5 days"

    lab = ExtractedLabInvestigation(
        parameter_name="Fasting Blood Sugar",
        observed_value="142",
        unit="mg/dL",
        is_abnormal=True,
    )
    assert lab.parameter_name == "Fasting Blood Sugar"
    assert lab.observed_value == "142"
    assert lab.is_abnormal is True

    result = OCRStructuredResult(
        medications=[med],
        lab_investigations=[lab],
        raw_text="Sample raw OCR text",
    )
    assert len(result.medications) == 1
    assert len(result.lab_investigations) == 1
    assert result.raw_text == "Sample raw OCR text"

    resp = ScanDocumentResponse(status="success", data=result)
    assert resp.status == "success"
    assert resp.data.medications[0].drug_name == "Amoxicillin"


def test_ocr_service_empty_and_valid_encoding():
    """Verify OCRService base64 encoding and validation."""
    service = OCRService()

    with pytest.raises(ValueError, match="empty"):
        service.encode_image(b"")

    sample_bytes = _create_sample_image_bytes()
    encoded = service.encode_image(sample_bytes)
    assert isinstance(encoded, str)
    assert len(encoded) > 0


def test_scan_document_endpoint_success():
    """Test POST /api/v1/scan-document with a valid image upload and mocked 2-stage VLM pipeline."""
    mock_extracted_text = "Tab Paracetamol 650mg TDS x 5 days\nFBS: 140 mg/dL"
    mock_parsed_result = OCRStructuredResult(
        medications=[
            ExtractedMedication(
                drug_name="Paracetamol",
                dosage="650 mg",
                frequency="TDS / Thrice daily",
                duration="5 days",
            )
        ],
        lab_investigations=[
            ExtractedLabInvestigation(
                parameter_name="Fasting Blood Sugar (FBS)",
                observed_value="140",
                unit="mg/dL",
                is_abnormal=True,
            )
        ],
        raw_text=mock_extracted_text,
    )

    img_bytes = _create_sample_image_bytes()
    files = {"file": ("prescription.png", img_bytes, "image/png")}

    with patch.object(ClinicalLLMService, "parse_document_image", new_callable=AsyncMock) as mock_vlm:
        mock_vlm.return_value = mock_parsed_result

        response = client.post("/api/v1/scan-document", files=files)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "success"
    data = body["data"]

    assert len(data["medications"]) == 1
    assert data["medications"][0]["drug_name"] == "Paracetamol"
    assert len(data["lab_investigations"]) == 1
    assert data["lab_investigations"][0]["parameter_name"] == "Fasting Blood Sugar (FBS)"


@pytest.mark.asyncio
async def test_two_stage_pipeline_execution():
    """Verify that parse_document_image invokes transcribe_image and then parse_ocr_text."""
    service = ClinicalLLMService()
    
    mock_raw_transcription = "Rx Amoxicillin 500mg TDS x 7 days"
    mock_structured = OCRStructuredResult(
        medications=[
            ExtractedMedication(
                drug_name="Amoxicillin",
                dosage="500mg",
                frequency="TDS / Thrice daily",
                duration="7 days",
            )
        ],
        lab_investigations=[],
        raw_text=mock_raw_transcription,
    )

    with patch.object(service, "transcribe_image", new_callable=AsyncMock) as mock_transcribe, \
         patch.object(service, "parse_ocr_text", new_callable=AsyncMock) as mock_parse:
        
        mock_transcribe.return_value = mock_raw_transcription
        mock_parse.return_value = mock_structured

        result = await service.parse_document_image(base64_image="mock_b64", mime_type="image/jpeg")

        mock_transcribe.assert_awaited_once_with(base64_image="mock_b64", mime_type="image/jpeg")
        mock_parse.assert_awaited_once_with(raw_text=mock_raw_transcription)
        assert result.medications[0].drug_name == "Amoxicillin"


def test_scan_document_endpoint_invalid_file_type():
    """Test POST /api/v1/scan-document rejects invalid non-image file types with 400."""
    files = {"file": ("notes.txt", b"plain text content", "text/plain")}

    response = client.post("/api/v1/scan-document", files=files)
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]


def test_scan_document_endpoint_empty_file():
    """Test POST /api/v1/scan-document rejects empty image files with 400."""
    files = {"file": ("empty.png", b"", "image/png")}

    response = client.post("/api/v1/scan-document", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_scan_document_endpoint_image_encoding_failure():
    """Verify that an image encoding failure propagates a clean error."""
    img_bytes = _create_sample_image_bytes()
    files = {"file": ("prescription.png", img_bytes, "image/png")}

    with patch.object(OCRService, "encode_image") as mock_encode:
        mock_encode.side_effect = HTTPException(
            status_code=500,
            detail="Image processing failed: Corrupted buffer.",
        )
        response = client.post("/api/v1/scan-document", files=files)

    assert response.status_code == 500
    assert "Image processing failed" in response.json()["detail"]


def test_scan_document_endpoint_vlm_failure_propagation():
    """Verify that a VLM parsing failure propagates a clean 500 error."""
    img_bytes = _create_sample_image_bytes()
    files = {"file": ("prescription.png", img_bytes, "image/png")}

    with patch.object(ClinicalLLMService, "parse_document_image", new_callable=AsyncMock) as mock_vlm:
        mock_vlm.side_effect = HTTPException(
            status_code=500,
            detail="Vision document transcription failed: Upstream connection timeout.",
        )
        response = client.post("/api/v1/scan-document", files=files)

    assert response.status_code == 500
    assert "Vision document transcription failed" in response.json()["detail"]
