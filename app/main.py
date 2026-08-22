from contextlib import asynccontextmanager
import logging
from typing import AsyncGenerator

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.models.schemas import ChatRequest, ChatResponse
from app.services.llm_service import ClinicalLLMService, get_llm_service

# Setup logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("sanjivani.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting up %s...", settings.PROJECT_NAME)
    # Eagerly initialize LLM Service
    get_llm_service()
    yield
    logger.info("Shutting down %s...", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Multimodal AI clinical history-taking kiosk backend combining Allopathic (SOCRATES) "
        "and Ayurvedic (Dashavidha Pariksha, Agni, Koshtha) diagnostic models for the Ministry of Ayush."
    ),
    version="0.1.0",
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
        "version": "0.1.0",
        "docs_url": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
    }


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
    except Exception as e:
        logger.exception("Error processing clinical chat request: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Clinical intake processing failed: {str(e)}",
        )
