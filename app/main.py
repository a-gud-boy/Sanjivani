from contextlib import asynccontextmanager
import logging
from typing import AsyncGenerator

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.models.schemas import (
    ChatInitResponse,
    ChatRequest,
    ChatResponse,
    ModelsListResponse,
    ModelSwitchRequest,
    ModelSwitchResponse,
    OCRStructuredResult,
    ScanDocumentResponse,
    SummarizeRequest,
    SummarizeResponse,
)
from app.services.llm_service import ClinicalLLMService, get_llm_service
from app.services.ocr_service import OCRService, get_ocr_service

# Setup logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("sanjivani.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting up %s...", settings.PROJECT_NAME)
    # Eagerly initialize LLM and OCR services
    get_llm_service()
    get_ocr_service()
    yield
    logger.info("Shutting down %s...", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Multimodal AI clinical history-taking kiosk backend combining Allopathic (SOCRATES), "
        "Ayurvedic (Dashavidha Pariksha, Agni, Koshtha) diagnostic models, and direct "
        "Vision-Language Model (VLM) medical document digitization for the Ministry of Ayush."
    ),
    version="0.3.0",
    lifespan=lifespan,
)

# CORS Middleware for kiosk / frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health"])
async def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "version": "0.3.0",
        "docs_url": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
    }


@app.get(
    f"{settings.API_V1_PREFIX}/chat/init",
    response_model=ChatInitResponse,
    status_code=status.HTTP_200_OK,
    tags=["Clinical Intake"],
    summary="Generate dynamic AI clinical opening greeting and starter quick-reply chips",
    description=(
        "Generates a warm, natural, non-hardcoded opening greeting in the requested language "
        "prompting the patient to explain what health issue or symptom brought them in today."
    ),
)
async def chat_init_endpoint(
    language: str = "en",
    patient_name: str = "",
    llm_service: ClinicalLLMService = Depends(get_llm_service),
) -> ChatInitResponse:
    try:
        greeting, chips = await llm_service.generate_initial_greeting(
            language=language,
            patient_name=patient_name or None,
        )
        return ChatInitResponse(
            status="success",
            greeting=greeting,
            suggested_quick_replies=chips,
        )
    except Exception as e:
        logger.exception("Error generating dynamic initial greeting: %s", str(e))
        return ChatInitResponse(
            status="success",
            greeting="Hello! I am Sanjivani, your AI clinical intake assistant. What health problem or symptoms can I help you document today?",
            suggested_quick_replies=["Headache / Body Ache", "Fever, Cold or Cough", "Stomach or Digestion issue", "General Health Checkup"],
        )


@app.post(
    f"{settings.API_V1_PREFIX}/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    tags=["Clinical Intake"],
    summary="Process conversational intake turn and update unified clinical JSON",
    description=(
        "Accepts patient's text utterance, conversational history, and previous JSON state. "
        "Extracts and validates Allopathic (SOCRATES) and Ayurvedic (Dashavidha Pariksha, Agni, Koshtha) "
        "parameters, checks emergency red flags, and returns the next dynamic intake question in the user's preferred language."
    ),
)
async def chat_endpoint(
    request: ChatRequest,
    llm_service: ClinicalLLMService = Depends(get_llm_service),
) -> ChatResponse:
    try:
        updated_state = await llm_service.process_chat(request)
        return ChatResponse(status="success", data=updated_state)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error processing clinical chat request: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Clinical intake processing failed: {str(e)}",
        )


@app.post(
    f"{settings.API_V1_PREFIX}/scan-document",
    response_model=ScanDocumentResponse,
    status_code=status.HTTP_200_OK,
    tags=["Document Digitization"],
    summary="Direct VLM digitization of medical prescriptions and lab reports",
    description=(
        "Upload a medical document image (prescription, lab report, Ayurvedic chart). "
        "The endpoint processes the image directly via a multimodal Vision-Language Model (VLM) "
        "to transcribe cursive handwriting, dosages, frequencies, and diagnostic parameters into structured clinical entities."
    ),
)
async def scan_document_endpoint(
    file: UploadFile = File(..., description="Prescription or diagnostic lab report image (JPEG, PNG, WebP, TIFF)."),
    ocr_service: OCRService = Depends(get_ocr_service),
    llm_service: ClinicalLLMService = Depends(get_llm_service),
) -> ScanDocumentResponse:
    # 1. Validate MIME type if provided
    allowed_content_types = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/webp",
        "image/bmp",
        "image/tiff",
        "application/octet-stream",
    ]
    content_type = (file.content_type or "").lower()
    if content_type and content_type not in allowed_content_types and not file.filename.lower().endswith(
        (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff")
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type '{file.content_type}'. Please upload an image file (JPEG, PNG, WebP, TIFF).",
        )

    # 2. Read file bytes
    try:
        file_bytes = await file.read()
    except Exception as read_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read uploaded file: {str(read_err)}",
        )

    if not file_bytes or len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty. Please provide a valid medical document image.",
        )

    mime_type = content_type if content_type.startswith("image/") else "image/png"

    # 3. Encode image bytes to base64
    try:
        base64_image = ocr_service.encode_image(file_bytes)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unreadable image file: {str(val_err)}",
        )
    except HTTPException:
        raise
    except Exception as enc_err:
        logger.exception("Image encoding failed: %s", str(enc_err))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Image processing failed: {str(enc_err)}",
        )

    # 4. Directly parse medical image via Multimodal VLM
    try:
        structured_entities: OCRStructuredResult = await llm_service.parse_document_image(
            base64_image=base64_image,
            mime_type=mime_type,
        )
        return ScanDocumentResponse(status="success", data=structured_entities)
    except HTTPException:
        raise
    except Exception as parse_err:
        logger.exception("VLM document parsing failed: %s", str(parse_err))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Medical document entity parsing failed: {str(parse_err)}",
        )


# ---- Model Management Endpoints ---------------------------------------------

@app.post(
    f"{settings.API_V1_PREFIX}/summarize",
    response_model=SummarizeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Clinical Intake"],
    summary="Generate AI narrative clinical summary from chat + all scanned documents",
    description=(
        "Accepts the full chat history, accumulated clinical record, and all scanned document payloads. "
        "Calls MedGemma to produce a structured pre-consultation summary suitable for physician review."
    ),
)
async def summarize_endpoint(
    request: SummarizeRequest,
    llm_service: ClinicalLLMService = Depends(get_llm_service),
) -> SummarizeResponse:
    try:
        return await llm_service.generate_clinical_summary(request)
    except Exception as e:
        logger.exception("Summary generation failed: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Summary generation failed: {str(e)}",
        )


# ---- Model Management Endpoints (continued) ---------------------------------

@app.get(
    f"{settings.API_V1_PREFIX}/models",
    response_model=ModelsListResponse,
    status_code=status.HTTP_200_OK,
    tags=["Model Management"],
    summary="List all downloaded and active local/remote AI models",
    description="Scans the local Hugging Face model cache and queries active vLLM instances to return available models.",
)
async def list_models_endpoint(
    llm_service: ClinicalLLMService = Depends(get_llm_service),
) -> ModelsListResponse:
    return await llm_service.get_available_models()


@app.post(
    f"{settings.API_V1_PREFIX}/models/select",
    response_model=ModelSwitchResponse,
    status_code=status.HTTP_200_OK,
    tags=["Model Management"],
    summary="Switch active model for conversational intake or document OCR",
    description="Dynamically changes the active inference model on the backend.",
)
async def select_model_endpoint(
    request: ModelSwitchRequest,
    llm_service: ClinicalLLMService = Depends(get_llm_service),
) -> ModelSwitchResponse:
    active_text, active_vision = llm_service.switch_model(
        model_name=request.model_name,
        target=request.target,
    )
    return ModelSwitchResponse(
        status="success",
        message=f"Active model successfully switched to '{request.model_name}'.",
        active_text_model=active_text,
        active_vision_model=active_vision,
    )
