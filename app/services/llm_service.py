import json
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_openai import ChatOpenAI
from openai import AsyncOpenAI

from app.core.config import settings
from app.models.schemas import (
    ChatRequest,
    ClinicalHistoryRecord,
    OCRStructuredResult,
)

logger = logging.getLogger("sanjivani.llm_service")

SYSTEM_PROMPT_CHAT = (
    "You are an expert AI clinical intake assistant for the Ministry of Ayush. "
    "Your job is to elicit a comprehensive medical history from a patient using a conversational approach. "
    "Elicit both Allopathic (SOCRATES framework) and Ayurvedic data (Dashavidha Pariksha, Agni, Koshtha). "
    "Never ask more than one or two simple questions at once. "
    "Branch dynamically based on user symptoms. "
    "If the user mentions chest pain, severe bleeding, sudden paralysis, or breathlessness, set red_flag_alert to true "
    "and ensure next_question_to_ask_patient provides immediate urgent emergency medical advice. "
    "You MUST output ONLY valid JSON using the provided schema. "
    "Update the JSON with the information gathered so far. "
    "In the next_question_to_ask_patient field, write the exact localized text you want the voice assistant to speak next. "
    "The next_question_to_ask_patient must always be generated in the language specified by the language_preference field, "
    "while the rest of the JSON values must remain in English. "
    "Do not output conversational filler outside the JSON."
)

SYSTEM_PROMPT_VLM = (
    "You are an expert AI clinical data extractor for medical prescriptions (Allopathic & Ayurvedic) and lab reports. "
    "Carefully examine the medical document image, transcribe all text verbatim in 'raw_text', and extract structured entities:\n"
    "1. Medications: drug_name, dosage, frequency (expand standard abbreviations like OD, BD, TDS, 3x a day), and duration.\n"
    "2. Lab Investigations: parameter_name, observed_value, unit, is_abnormal (true/false/null).\n"
    "Output ONLY a valid JSON object."
)

RED_FLAG_KEYWORDS = [
    "chest pain",
    "severe bleeding",
    "heavy bleeding",
    "sudden paralysis",
    "cannot move arm",
    "cannot move leg",
    "facial droop",
    "breathlessness",
    "shortness of breath",
    "cannot breathe",
    "unconscious",
]


class ClinicalLLMService:
    def __init__(self) -> None:
        # 1. Text / Conversational Intake LLM Configuration
        self.text_api_key = settings.effective_text_api_key
        self.text_model_name = settings.effective_text_model_name
        self.text_base_url = settings.effective_text_base_url

        # 2. Vision / Document Scanner VLM Configuration
        self.vision_api_key = settings.effective_vision_api_key
        self.vision_model_name = settings.effective_vision_model_name
        self.vision_base_url = settings.effective_vision_base_url

        # Backward compatibility aliases
        self.api_key = self.text_api_key
        self.model_name = self.text_model_name
        self.base_url = self.text_base_url

        # Structured Chat LLM
        chat_llm_kwargs: Dict[str, Any] = {
            "model": self.text_model_name,
            "api_key": self.text_api_key,
            "temperature": 0.2,
        }
        if self.text_base_url:
            chat_llm_kwargs["base_url"] = self.text_base_url

        self._llm = ChatOpenAI(**chat_llm_kwargs)
        self._structured_llm_chat = self._llm.with_structured_output(
            ClinicalHistoryRecord,
            method="function_calling",
        )
        self._direct_chat_client = AsyncOpenAI(
            api_key=self.text_api_key,
            base_url=self.text_base_url or None,
        )

        # Structured Vision VLM
        vision_llm_kwargs: Dict[str, Any] = {
            "model": self.vision_model_name,
            "api_key": self.vision_api_key,
            "temperature": 0.1,
        }
        if self.vision_base_url:
            vision_llm_kwargs["base_url"] = self.vision_base_url

        self._vision_llm = ChatOpenAI(**vision_llm_kwargs)
        self._structured_llm_ocr = self._vision_llm.with_structured_output(
            OCRStructuredResult,
            method="function_calling",
        )
        self._direct_vision_client = AsyncOpenAI(
            api_key=self.vision_api_key,
            base_url=self.vision_base_url or None,
        )
        self._direct_client = self._direct_chat_client  # backward-compat

        logger.info(
            "Initialized production LLM service: chat_model='%s' (base_url=%s), vision_model='%s' (base_url=%s).",
            self.text_model_name,
            self.text_base_url,
            self.vision_model_name,
            self.vision_base_url,
        )

    # =========================================================================
    # Phase 1: Conversational Chat Intake
    # =========================================================================

    def _build_chat_system_prompt(self, current_state: Optional[ClinicalHistoryRecord]) -> str:
        current_state_json = (
            current_state.model_dump_json(exclude_none=True)
            if current_state
            else "{}"
        )
        schema_json = json.dumps(ClinicalHistoryRecord.model_json_schema())
        return (
            f"{SYSTEM_PROMPT_CHAT}\n\n"
            f"--- JSON SCHEMA TO MATCH ---\n"
            f"{schema_json}\n\n"
            f"--- CURRENT STRUCTURED CLINICAL STATE (JSON) ---\n"
            f"{current_state_json}\n\n"
            f"Integrate any new information from the patient's statement into this state while preserving prior validated fields. "
            f"Output a valid JSON object matching the ClinicalHistoryRecord schema."
        )

    def _build_chat_messages(
        self,
        user_text: str,
        current_state: Optional[ClinicalHistoryRecord],
        chat_history: List[Dict[str, Any]],
    ) -> List[BaseMessage]:
        messages: List[BaseMessage] = []
        messages.append(SystemMessage(content=self._build_chat_system_prompt(current_state)))

        # Conversational State Injection
        for msg in chat_history:
            role = msg.get("role", "").lower()
            content = str(msg.get("content", ""))
            if not content:
                continue

            if role in ("user", "human", "patient"):
                messages.append(HumanMessage(content=content))
            elif role in ("assistant", "ai", "bot"):
                messages.append(AIMessage(content=content))
            elif role in ("system",):
                messages.append(SystemMessage(content=content))
            else:
                messages.append(HumanMessage(content=content))

        # Current User Turn
        messages.append(HumanMessage(content=user_text))
        return messages

    def _check_red_flags(self, text: str) -> bool:
        lower_text = text.lower()
        return any(keyword in lower_text for keyword in RED_FLAG_KEYWORDS)

    def _apply_emergency_guardrail(
        self,
        record: ClinicalHistoryRecord,
        user_text: str,
    ) -> ClinicalHistoryRecord:
        is_red_flag = record.red_flag_alert or self._check_red_flags(user_text)
        if is_red_flag:
            record.red_flag_alert = True
            lang = "en"
            if record.patient_demographics and record.patient_demographics.language_preference:
                lang = record.patient_demographics.language_preference.lower()

            current_q = record.next_question_to_ask_patient.lower()
            if not any(w in current_q for w in ["emergency", "urgent", "hospital", "108", "आपातकालीन", "तुरंत"]):
                if lang.startswith("hi"):
                    record.next_question_to_ask_patient = (
                        "यह एक गंभीर आपातकालीन स्थिति हो सकती है। कृपया तुरंत निकटतम अस्पताल जाएं या आपातकालीन सेवा (108) को कॉल करें।"
                    )
                else:
                    record.next_question_to_ask_patient = (
                        "EMERGENCY WARNING: Your symptoms indicate an urgent medical condition. Please proceed immediately to the nearest emergency department or call emergency services."
                    )
        return record

    def _clean_and_parse_chat_json(self, raw_text: str) -> ClinicalHistoryRecord:
        cleaned = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()
        if "```" in cleaned:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
            if match:
                cleaned = match.group(1).strip()
            else:
                cleaned = re.sub(r"^```(?:json)?\n|\n```$", "", cleaned, flags=re.MULTILINE).strip()

        return ClinicalHistoryRecord.model_validate_json(cleaned)

    async def _direct_json_chat_completion(
        self,
        user_text: str,
        current_state: Optional[ClinicalHistoryRecord],
        chat_history: List[Dict[str, Any]],
    ) -> ClinicalHistoryRecord:
        system_content = self._build_chat_system_prompt(current_state)
        formatted_messages = [{"role": "system", "content": system_content}]

        for msg in chat_history:
            role = msg.get("role", "user")
            content = str(msg.get("content", ""))
            if content:
                if role in ("patient", "human"):
                    role = "user"
                elif role in ("bot", "ai"):
                    role = "assistant"
                formatted_messages.append({"role": role, "content": content})

        formatted_messages.append({"role": "user", "content": user_text})

        try:
            response = await self._direct_chat_client.chat.completions.create(
                model=self.text_model_name,
                messages=formatted_messages,  # type: ignore
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            raw_content = response.choices[0].message.content or "{}"
            return self._clean_and_parse_chat_json(raw_content)
        except Exception as json_err:
            logger.warning("json_object format failed (%s), retrying standard prompt.", str(json_err))
            response = await self._direct_chat_client.chat.completions.create(
                model=self.text_model_name,
                messages=formatted_messages,  # type: ignore
                temperature=0.2,
            )
            raw_content = response.choices[0].message.content or "{}"
            return self._clean_and_parse_chat_json(raw_content)

    async def process_chat(self, request: ChatRequest) -> ClinicalHistoryRecord:
        """
        Process a conversational clinical intake turn using actual model inference.
        Throws HTTPException if the underlying LLM provider fails.
        """
        # 1. Primary Strategy: LangChain structured output with function_calling
        try:
            messages = self._build_chat_messages(
                user_text=request.user_text,
                current_state=request.current_json_state,
                chat_history=request.chat_history,
            )
            result: ClinicalHistoryRecord = await self._structured_llm_chat.ainvoke(messages)
            return self._apply_emergency_guardrail(result, request.user_text)
        except Exception as func_err:
            logger.warning(
                "Structured function_calling failed (%s). Attempting direct JSON completion...",
                str(func_err),
            )

        # 2. Secondary Strategy: Direct JSON completion
        try:
            result = await self._direct_json_chat_completion(
                user_text=request.user_text,
                current_state=request.current_json_state,
                chat_history=request.chat_history,
            )
            return self._apply_emergency_guardrail(result, request.user_text)
        except Exception as json_err:
            logger.error("LLM chat processing failed completely: %s", str(json_err))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"LLM clinical intake inference failed: {str(json_err)}",
            )

    # =========================================================================
    # Phase 2: 2-Stage Medical Document Digitization Pipeline
    #   Stage 1: Vision Model (Qwen 3.6 VLM) reads/transcribes the image to text
    #   Stage 2: Text LLM (GPT-OSS-120B) structures the text into clean clinical JSON
    # =========================================================================

    def _clean_and_parse_ocr_json(self, raw_text: str, default_raw_text: str = "") -> OCRStructuredResult:
        cleaned = raw_text.strip()

        # 1. If thinking tags are present, extract the payload strictly AFTER </think>
        if "</think>" in cleaned:
            cleaned = cleaned.split("</think>")[-1].strip()
        elif "<think>" in cleaned:
            # Model response was cut off before finishing thinking
            raise ValueError(
                f"Model response was cut off inside <think> reasoning trace. Raw snippet: {raw_text[:150]!r}"
            )

        # 2. Extract JSON from markdown code block ```json ... ``` if present
        if "```" in cleaned:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
            if match:
                cleaned = match.group(1).strip()
            else:
                cleaned = re.sub(r"^```(?:json)?\n|\n```$", "", cleaned, flags=re.MULTILINE).strip()

        # 3. Locate outer JSON object { ... }
        brace_start = cleaned.find("{")
        brace_end = cleaned.rfind("}")
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            cleaned = cleaned[brace_start : brace_end + 1]
        else:
            raise ValueError(
                f"No valid JSON object found in model output. Raw snippet: {raw_text[:200]!r}"
            )

        result = OCRStructuredResult.model_validate_json(cleaned)
        if not result.raw_text and default_raw_text:
            result.raw_text = default_raw_text
        return result

    async def transcribe_image(
        self,
        base64_image: str,
        mime_type: str = "image/jpeg",
    ) -> str:
        """
        Stage 1: Pure Vision OCR Transcription.
        Uses the Vision Model (e.g. Qwen 3.6 VLM) to read the medical document
        image and return a clean, verbatim text transcription.
        """
        if not base64_image or not base64_image.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image data provided.",
            )

        image_data_url = f"data:{mime_type};base64,{base64_image.strip()}"

        vision_prompt = (
            "Transcribe all readable text from this medical prescription or diagnostic laboratory report image verbatim. "
            "Include doctor/hospital header, patient info, date, Rx medications, strengths, dosages, instructions, "
            "diagnostic lab parameters, and doctor signatures. "
            "Output ONLY the plain transcribed text."
        )

        # Build candidate vision models (excluding text-only models)
        TEXT_ONLY_MODELS = {"openai/gpt-oss-120b", "gpt-oss-120b", "openai/gpt-oss-20b", "gpt-oss-20b"}
        vision_models: list[str] = []
        if self.vision_model_name and self.vision_model_name not in TEXT_ONLY_MODELS:
            vision_models.append(self.vision_model_name)
        if self.vision_base_url and "groq.com" in self.vision_base_url and "qwen/qwen3.6-27b" not in vision_models:
            vision_models.append("qwen/qwen3.6-27b")

        if not vision_models:
            vision_models = ["qwen/qwen3.6-27b"]

        last_error: Exception | None = None
        for model in vision_models:
            try:
                logger.info("Stage 1: Transcribing image with vision model '%s'...", model)
                response = await self._direct_vision_client.chat.completions.create(
                    model=model,
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": vision_prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": image_data_url},
                                },
                            ],
                        },
                    ],
                    temperature=0.1,
                    max_tokens=2048,
                )
                raw_text = response.choices[0].message.content or ""
                # Clean thinking trace if present
                if "</think>" in raw_text:
                    raw_text = raw_text.split("</think>")[-1].strip()
                elif "<think>" in raw_text:
                    raw_text = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()

                if raw_text.strip():
                    logger.info("Stage 1 transcription succeeded with model '%s' (%d chars).", model, len(raw_text))
                    return raw_text.strip()
            except Exception as e:
                last_error = e
                logger.warning("Stage 1 vision transcription failed with model '%s': %s", model, str(e))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vision document transcription failed: {str(last_error)}",
        )

    async def parse_ocr_text(self, raw_text: str) -> OCRStructuredResult:
        """
        Stage 2: Clinical Entity Structuring & Normalization.
        Takes the transcribed raw text and uses the Text LLM (GPT-OSS-120B) with
        native JSON mode / function calling to extract standardized medications,
        lab investigations, and full verbatim text into OCRStructuredResult.
        """
        if not raw_text or not raw_text.strip():
            return OCRStructuredResult(raw_text="")

        schema_json = json.dumps(OCRStructuredResult.model_json_schema())
        system_instruction = (
            f"{SYSTEM_PROMPT_VLM}\n\n"
            f"--- TARGET JSON SCHEMA ---\n"
            f"{schema_json}\n\n"
            "You are an expert AI clinical data extractor for doctor prescriptions and laboratory reports. "
            "Extract all medications (standardize frequencies e.g. TDS -> Thrice daily / 3x a day), "
            "lab investigations, and retain the verbatim raw_text. "
            "Output a single valid JSON object matching the schema."
        )

        # 1. Primary Strategy: Direct text LLM with native json_object mode
        try:
            logger.info("Stage 2: Structuring clinical text with text model '%s'...", self.text_model_name)
            response = await self._direct_chat_client.chat.completions.create(
                model=self.text_model_name,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": f"Extract clinical entities from this prescription/lab document text:\n\n{raw_text}"},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            raw_content = response.choices[0].message.content or "{}"
            result = self._clean_and_parse_ocr_json(raw_content, raw_text)
            logger.info("Stage 2 structuring succeeded (%d meds, %d labs).", len(result.medications), len(result.lab_investigations))
            return result
        except Exception as direct_err:
            logger.warning("Stage 2 direct text parsing failed (%s), trying secondary LangChain structured output.", str(direct_err))

        # 2. Secondary Strategy: LangChain structured output
        try:
            messages = [
                SystemMessage(content=system_instruction),
                HumanMessage(content=f"Extract clinical entities from this prescription/lab text:\n\n{raw_text}"),
            ]
            result: OCRStructuredResult = await self._structured_llm_ocr.ainvoke(messages)
            if not result.raw_text:
                result.raw_text = raw_text
            return result
        except Exception as func_err:
            logger.error("Structured text function calling failed: %s", str(func_err))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Clinical text entity extraction failed: {str(direct_err)}",
        )

    async def parse_document_image(
        self,
        base64_image: str,
        mime_type: str = "image/jpeg",
    ) -> OCRStructuredResult:
        """
        2-Stage Document Processing Pipeline:
        Stage 1: Vision Model (Qwen 3.6 VLM) transcribes the image to raw text.
        Stage 2: Text LLM (GPT-OSS-120B) parses the raw text into structured clinical JSON.
        """
        # Stage 1: Transcribe image to raw text
        raw_text = await self.transcribe_image(
            base64_image=base64_image,
            mime_type=mime_type,
        )

        # Stage 2: Structure raw text into medications & lab investigations
        result = await self.parse_ocr_text(raw_text=raw_text)
        return result



# Global singleton instance
_llm_service: Optional[ClinicalLLMService] = None


def get_llm_service() -> ClinicalLLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = ClinicalLLMService()
    return _llm_service
