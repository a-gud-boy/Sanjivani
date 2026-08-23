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
    "You are an expert AI clinical data extractor and medical transcriptionist for doctor prescriptions, diagnostic laboratory reports, "
    "and Ayurvedic treatment charts. Your task is to act as an expert medical transcriptionist, carefully examining the uploaded "
    "medical document image, reading cursive or faint handwritten text with extreme precision, and directly extracting medications, "
    "lab values, and a verbatim transcription into the structured JSON schema.\n\n"
    "EXTRACTION GUIDELINES:\n"
    "1. Medications (Allopathic & Ayurvedic):\n"
    "   - Identify all drugs, capsules, tablets, syrups, drops, and Ayurvedic formulations (e.g. Vati, Churna, Bhasma, Kashayam, Asava, Arishta, Taila, Ghrita).\n"
    "   - Extract dosage strength (e.g., '500mg', '650mg', '10ml', '1 cap', '1 tsp').\n"
    "   - Infer standard clinical frequency abbreviations:\n"
    "     * OD (Once daily), BD/BID (Twice daily), TDS/TID (Thrice daily / 3x a day), QID (Four times daily), HS (At bedtime), SOS (As needed), STAT (Immediately).\n"
    "     * Expand abbreviations into clear descriptions (e.g., 'TDS / Thrice daily', 'BD / Twice daily', '3x a day').\n"
    "   - Extract duration (e.g., '7 days', '2 weeks', '1 month', 'seven days').\n"
    "2. Laboratory Investigations:\n"
    "   - Identify diagnostic parameters, lab tests, and biological markers (e.g., Hemoglobin, Fasting Blood Sugar, HbA1c, Serum Creatinine, SGPT/ALT, Platelet Count).\n"
    "   - Extract the measured quantitative value or qualitative result.\n"
    "   - Extract the measurement unit (e.g., 'g/dL', 'mg/dL', '%', 'cells/cu.mm', 'U/L').\n"
    "   - Determine is_abnormal: true if explicitly high/low/marked, false if normal, or null if unspecified.\n"
    "3. Raw Text Transcription:\n"
    "   - In the 'raw_text' field, provide a complete verbatim transcription of all readable text from the document, "
    "including patient details, doctor notes, Rx section, signature, and license numbers.\n\n"
    "You MUST output ONLY a valid JSON object conforming to the OCRStructuredResult schema. Do not output text outside the JSON."
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
        self.api_key = settings.OPENAI_API_KEY
        self.model_name = settings.OPENAI_MODEL_NAME
        self.vision_model_name = settings.OPENAI_VISION_MODEL_NAME or settings.OPENAI_MODEL_NAME
        self.base_url = settings.OPENAI_BASE_URL

        llm_kwargs: Dict[str, Any] = {
            "model": self.model_name,
            "api_key": self.api_key,
            "temperature": 0.2,
        }
        if self.base_url:
            llm_kwargs["base_url"] = self.base_url

        self._llm = ChatOpenAI(**llm_kwargs)
        self._structured_llm_chat = self._llm.with_structured_output(
            ClinicalHistoryRecord,
            method="function_calling",
        )
        self._structured_llm_ocr = self._llm.with_structured_output(
            OCRStructuredResult,
            method="function_calling",
        )
        self._direct_client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url or None,
        )
        logger.info(
            "Initialized production LLM service with model '%s' (base_url=%s).",
            self.model_name,
            self.base_url,
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
            response = await self._direct_client.chat.completions.create(
                model=self.model_name,
                messages=formatted_messages,  # type: ignore
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            raw_content = response.choices[0].message.content or "{}"
            return self._clean_and_parse_chat_json(raw_content)
        except Exception as json_err:
            logger.warning("json_object format failed (%s), retrying standard prompt.", str(json_err))
            response = await self._direct_client.chat.completions.create(
                model=self.model_name,
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
    # Phase 2: Direct Vision-Language Model (VLM) Document Parsing
    # =========================================================================

    def _clean_and_parse_ocr_json(self, raw_text: str, default_raw_text: str = "") -> OCRStructuredResult:
        cleaned = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()
        if "```" in cleaned:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
            if match:
                cleaned = match.group(1).strip()
            else:
                cleaned = re.sub(r"^```(?:json)?\n|\n```$", "", cleaned, flags=re.MULTILINE).strip()

        result = OCRStructuredResult.model_validate_json(cleaned)
        if not result.raw_text and default_raw_text:
            result.raw_text = default_raw_text
        return result

    async def parse_document_image(
        self,
        base64_image: str,
        mime_type: str = "image/jpeg",
    ) -> OCRStructuredResult:
        """
        Directly parse a medical document image (prescription, lab report) using a
        Vision-Language Model (VLM) into structured clinical entities and transcription.
        
        Args:
            base64_image: Base64-encoded string of the image file.
            mime_type: MIME type of the image (e.g. 'image/jpeg', 'image/png').
            
        Returns:
            OCRStructuredResult matching the clinical Pydantic schema.
        """
        if not base64_image or not base64_image.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image data provided.",
            )

        schema_json = json.dumps(OCRStructuredResult.model_json_schema())
        system_instruction = (
            f"{SYSTEM_PROMPT_VLM}\n\n"
            f"--- JSON SCHEMA TO MATCH ---\n"
            f"{schema_json}\n\n"
            f"Carefully analyze this prescription/lab image and extract all clinical entities matching the schema."
        )

        image_data_url = f"data:{mime_type};base64,{base64_image.strip()}"

        # Candidate VLM models: primary configured model, vision model override, and Groq fallback if applicable
        models_to_try = [self.vision_model_name]
        if self.model_name not in models_to_try:
            models_to_try.append(self.model_name)
        if self.base_url and "groq.com" in self.base_url and "qwen/qwen3.6-27b" not in models_to_try:
            models_to_try.append("qwen/qwen3.6-27b")

        last_error = None
        for model in models_to_try:
            try:
                logger.info("Attempting VLM document extraction with model '%s'...", model)
                response = await self._direct_client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_instruction},
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text",
                                    "text": "Carefully read and transcribe this medical document image, then output the structured JSON.",
                                },
                                {
                                    "type": "image_url",
                                    "image_url": {"url": image_data_url},
                                },
                            ],
                        },
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1,
                )
                raw_content = response.choices[0].message.content or "{}"
                result = self._clean_and_parse_ocr_json(raw_content)
                logger.info("VLM extraction succeeded with model '%s'.", model)
                return result
            except Exception as e:
                last_error = e
                logger.warning("VLM inference failed with model '%s': %s", model, str(e))

        # 2. Secondary Strategy: LangChain structured output
        try:
            messages = [
                SystemMessage(content=system_instruction),
                HumanMessage(
                    content=[
                        {
                            "type": "text",
                            "text": "Carefully read and transcribe this medical document image into structured entities.",
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": image_data_url},
                        },
                    ]
                ),
            ]
            result: OCRStructuredResult = await self._structured_llm_ocr.ainvoke(messages)
            return result
        except Exception as func_err:
            logger.error("Structured VLM function calling failed: %s", str(func_err))

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"VLM document entity extraction failed: {str(last_error)}",
        )

    async def parse_ocr_text(self, raw_text: str) -> OCRStructuredResult:
        """
        Legacy text-based OCR parsing interface maintained for backward compatibility.
        """
        if not raw_text or not raw_text.strip():
            return OCRStructuredResult(raw_text=raw_text)

        schema_json = json.dumps(OCRStructuredResult.model_json_schema())
        system_instruction = (
            f"{SYSTEM_PROMPT_VLM}\n\n"
            f"--- JSON SCHEMA TO MATCH ---\n"
            f"{schema_json}\n\n"
            f"Extract all medications and lab investigations from the following OCR text and map to the schema."
        )

        try:
            response = await self._direct_client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": f"--- DOCUMENT TEXT ---\n{raw_text}"},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
            )
            raw_content = response.choices[0].message.content or "{}"
            return self._clean_and_parse_ocr_json(raw_content, raw_text)
        except Exception as json_err:
            logger.error("LLM text parsing failed: %s", str(json_err))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"LLM medical entity extraction failed: {str(json_err)}",
            )


# Global singleton instance
_llm_service: Optional[ClinicalLLMService] = None


def get_llm_service() -> ClinicalLLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = ClinicalLLMService()
    return _llm_service
