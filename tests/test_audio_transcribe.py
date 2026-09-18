from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.llm_service import ClinicalLLMService

client = TestClient(app)


def test_transcribe_audio_empty_file_rejected():
    """Verify /api/v1/chat/transcribe-audio rejects empty audio upload with HTTP 400."""
    response = client.post(
        "/api/v1/chat/transcribe-audio",
        files={"audio": ("empty.webm", b"", "audio/webm")},
        data={"language": "hi"},
    )
    assert response.status_code == 400
    assert "Empty audio" in response.json()["detail"]


def test_transcribe_audio_success_mocked():
    """Verify /api/v1/chat/transcribe-audio successfully returns transcribed clinical intake text."""
    dummy_audio = b"\x1a\x45\xdf\xa3WebM_audio_mock_stream_data_bytes"
    with patch.object(ClinicalLLMService, "transcribe_audio", new_callable=AsyncMock) as mock_transcribe:
        mock_transcribe.return_value = "मुझे पिछले तीन दिनों से तेज सिरदर्द और बुखार है"
        response = client.post(
            "/api/v1/chat/transcribe-audio",
            files={"audio": ("voice.webm", dummy_audio, "audio/webm")},
            data={"language": "hi"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "success"
        assert body["transcript"] == "मुझे पिछले तीन दिनों से तेज सिरदर्द और बुखार है"
        assert body["language"] == "hi"
        mock_transcribe.assert_awaited_once()


def test_transcribe_audio_service_error_500():
    """Verify /api/v1/chat/transcribe-audio handles internal service errors gracefully with HTTP 500."""
    dummy_audio = b"\x1a\x45\xdf\xa3WebM_audio_mock_stream_data_bytes"
    with patch.object(ClinicalLLMService, "transcribe_audio", new_callable=AsyncMock) as mock_transcribe:
        mock_transcribe.side_effect = RuntimeError("Speech recognition engine timeout")
        response = client.post(
            "/api/v1/chat/transcribe-audio",
            files={"audio": ("voice.webm", dummy_audio, "audio/webm")},
            data={"language": "en"},
        )
        assert response.status_code == 500
        assert "Speech transcription failed" in response.json()["detail"]
