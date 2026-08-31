import glob
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

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
    DownloadedModelInfo,
    ModelsListResponse,
    OCRStructuredResult,
    ScannedDocumentSummary,
    SummarizeRequest,
    SummarizeResponse,
    SummarySections,
)

logger = logging.getLogger("sanjivani.llm_service")

SYSTEM_PROMPT_CHAT = (
    "You are Sanjivani (संजीवनी), a compassionate, professional AI medical clinician and clinical intake assistant for the Ministry of Ayush.\n\n"
    "CLINICAL CONSULTATION PRINCIPLES:\n"
    "1. REAL CLINICAL EXPERTISE: Act like a real doctor. Listen attentively, understand the user's situation in context, and converse naturally and empathetically.\n"
    "   - General Checkup / Wellness: If the patient wants a general checkup or has no specific complaints, ask about their overall energy levels, sleep patterns, digestion, chronic illnesses (like diabetes or hypertension), or family medical history.\n"
    "   - Specific Symptoms: If the patient reports pain, fever, cough, skin lesions, or digestive issues, naturally ask relevant follow-up questions to understand the condition (location, duration, quality, triggers) and Ayurvedic digestion/lifestyle factors.\n"
    "   - Greetings / Casual remarks: Warmly greet back, introduce yourself, and ask how you can assist their health today.\n"
    "2. CONVERSATIONAL PROGRESSION: In 'next_question_to_ask_patient', formulate ONE clear, polite, and clinically appropriate question or response to advance the consultation in the patient's language.\n"
    "3. RELEVANT QUICK REPLIES: In 'suggested_quick_replies', generate 3 to 5 natural, short reply chips (2-4 words each) specifically relevant to the question you just asked.\n"
    "4. STRUCTURED DATA: Incrementally update the clinical record JSON with accurate entities (demographics, chief complaint, SOCRATES details, Ayush Agni/Koshtha parameters) based on what the patient actually shared.\n"
    "5. EMERGENCY RED FLAGS: If acute life-threatening symptoms (e.g. crushing chest pain with radiation, severe breathlessness, sudden paralysis, heavy bleeding) are described, set 'red_flag_alert': true and advise immediate emergency hospital care.\n\n"
    "Output ONLY a single valid JSON object matching the blueprint."
)

JSON_BLUEPRINT_CHAT = """{
  "patient_demographics": { "name": null, "age_years": null, "gender": null, "language_preference": "en" },
  "chief_complaint": { "symptom": null, "duration": null },
  "hpi_socrates": { "site": null, "onset": null, "character": null, "radiation": null, "associations": null, "time_course": null, "exacerbating_relieving": null, "severity_1_to_10": null },
  "ayush_dashavidha_pariksha": { "prakriti": null, "vikriti": null, "agni": null, "koshtha": null },
  "ahara_vihara_lifestyle": { "diet_habits": null, "sleep_pattern": null, "koshtha_bowel": null, "agni_digestion": null },
  "red_flag_alert": false,
  "next_question_to_ask_patient": "Empathetic, intelligent doctor next question here",
  "suggested_quick_replies": ["Relevant option 1", "Relevant option 2", "Relevant option 3"]
}"""

SYSTEM_PROMPT_VLM = (
    "You are an expert AI clinical data extractor for medical prescriptions (Allopathic & Ayurvedic) and lab reports. "
    "Carefully examine the medical document image or text, transcribe all text verbatim in 'raw_text', and extract structured entities:\n"
    "1. Medications: drug_name, dosage, frequency (e.g. 1 cap 3x a day / TDS / BD), and duration (e.g. 7 days).\n"
    "2. Lab Investigations: parameter_name, observed_value, unit, is_abnormal (true/false/null).\n"
    "Output ONLY a single valid JSON object."
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

GREETINGS_PATTERN = re.compile(
    r"^(hi|hello|hey|hola|namaste|namaskar|pranam|vanakkam|namaskaram|sasriyakaal|adaab|"
    r"good\s+(morning|afternoon|evening|day|night)|how\s+are\s+you|who\s+are\s+you|"
    r"what\s+can\s+you\s+do|test|testing|ok|okay|k|help|thanks|thank\s+you|bye|goodbye|"
    r"sup|yo|wassup|start|begin|hlo|hii+|heyy+|namaskaar)[\s\.\!\?,]*$",
    re.IGNORECASE,
)

OFFTOPIC_KEYWORDS = [
    "weather", "joke", "poem", "song", "who is the prime minister", "president",
    "cricket", "football", "movie", "cinema", "politics", "recipe", "capital of"
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

        # Direct OpenAI-compatible Async Clients (primary)
        self._direct_chat_client = AsyncOpenAI(
            api_key=self.text_api_key,
            base_url=self.text_base_url or None,
        )
        self._direct_vision_client = AsyncOpenAI(
            api_key=self.vision_api_key,
            base_url=self.vision_base_url or None,
        )
        self._direct_client = self._direct_chat_client  # backward-compat

        # Secondary Structured Chat LLM (fallback for OpenAI cloud with function calling)
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
        state_info = ""
        if current_state:
            state_dict = current_state.model_dump(exclude_none=True)
            state_dict.pop("next_question_to_ask_patient", None)
            state_dict.pop("suggested_quick_replies", None)
            if state_dict:
                state_info = f"\n\nCURRENT CLINICAL RECORD EXTRACTED SO FAR:\n{json.dumps(state_dict, indent=2)}"

        return (
            "You are Sanjivani (संजीवनी), a compassionate, professional AI medical clinician for the Ministry of Ayush.\n"
            "Your role is to conduct a natural, intelligent patient intake consultation just like an experienced clinical doctor.\n"
            "Converse empathetically with the patient, listen to their concerns (symptoms, general wellness check, lifestyle, questions), and ask relevant medical follow-up questions.\n\n"
            "STRICT CLINICAL EXTRACTION RULES:\n"
            "1. In the JSON state, ONLY populate fields with facts that the patient has EXPLICITLY mentioned in the conversation.\n"
            "2. If a detail (e.g. onset, timing, severity, radiation, character, Ayush Prakriti/Agni) has NOT been explicitly stated by the patient, you MUST set it to null. NEVER guess, assume, or default to values like 'intermittent', 'acute', or 'moderate' unless the patient explicitly said so.\n"
            "3. If the patient answers your question with a brief phrase (e.g., 'Upper right'), only update the relevant field (e.g., site: 'Upper right'). Do not fabricate answers to your other questions.\n\n"
            "OUTPUT INSTRUCTION:\n"
            "Respond by outputting ONLY a single JSON object containing:\n"
            "- \"next_question_to_ask_patient\": Your empathetic, contextual clinical question or reply to the patient (in the patient's language).\n"
            "- \"suggested_quick_replies\": A list of 3 to 4 short, realistic quick-reply options (2-4 words each) relevant to your question.\n"
            "- \"chief_complaint\": {\"symptom\": string or null, \"duration\": string or null}\n"
            "- \"hpi_socrates\": {\"site\": string or null, \"onset\": string or null, \"character\": string or null, \"radiation\": string or null, \"associations\": string or null, \"time_course\": string or null, \"exacerbating_relieving\": string or null, \"severity_1_to_10\": number or string or null}\n"
            "- \"ayush_dashavidha_pariksha\": {\"prakriti\": string or null, \"vikriti\": string or null, \"agni\": string or null, \"koshtha\": string or null}\n"
            "- \"ahara_vihara_lifestyle\": {\"diet_habits\": string or null, \"sleep_pattern\": string or null, \"koshtha_bowel\": string or null, \"agni_digestion\": string or null}\n"
            "- \"red_flag_alert\": boolean (true if emergency symptoms like acute chest pain, stroke signs, or severe respiratory distress are reported, otherwise false)"
            f"{state_info}"
        )

    def _build_chat_messages(
        self,
        user_text: str,
        current_state: Optional[ClinicalHistoryRecord],
        chat_history: List[Dict[str, Any]],
    ) -> List[BaseMessage]:
        messages: List[BaseMessage] = []
        messages.append(SystemMessage(content=self._build_chat_system_prompt(current_state)))

        # Conversational State Injection (keep recent history window)
        recent_history = chat_history[-10:] if chat_history else []
        for msg in recent_history:
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

    def _is_greeting_or_non_symptom(self, text: Optional[str]) -> bool:
        if not text:
            return True
        cleaned = text.strip().lower()
        if not cleaned:
            return True
        if GREETINGS_PATTERN.match(cleaned):
            return True
        pure_words = re.findall(r'[a-zA-Z\u0900-\u097F]+', cleaned)
        if len(pure_words) <= 3 and all(w in {
            "hi", "hello", "hey", "namaste", "namaskar", "pranam", "sanjivani",
            "sir", "madam", "doctor", "doc", "good", "morning", "afternoon",
            "evening", "there", "friend", "bot", "ai", "aap", "kaise", "ho", "kya", "hal", "hai"
        } for w in pure_words):
            return True
        if any(k in cleaned for k in OFFTOPIC_KEYWORDS):
            return True
        return False

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

            current_q = (record.next_question_to_ask_patient or "").lower()
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

    @staticmethod
    def _sanitize_json_entities(obj: Any) -> Any:
        if isinstance(obj, dict):
            cleaned = {}
            for k, v in obj.items():
                val = ClinicalLLMService._sanitize_json_entities(v)
                if k in ("symptom", "site", "onset", "character", "radiation", "associations", "time_course", "exacerbating_relieving", "duration"):
                    if isinstance(val, list):
                        val = ", ".join(str(x) for x in val if x)
                elif k in ("prakriti", "vikriti", "agni", "koshtha", "koshtha_bowel", "agni_digestion", "vaya_age_group"):
                    if isinstance(val, str):
                        s_lower = val.lower().strip()
                        if any(w in s_lower for w in ("none mentioned", "none reported", "not specified", "unspecified", "normal", "healthy", "balanced", "n/a", "none")):
                            val = None
                cleaned[k] = val
            return cleaned
        elif isinstance(obj, list):
            return [ClinicalLLMService._sanitize_json_entities(item) for item in obj]
        elif isinstance(obj, str):
            s = obj.strip()
            s_lower = s.lower()
            if s_lower in ("...", "…", "null", "none", "n/a", "not specified", "none mentioned", "none reported", "unknown", "unspecified"):
                return None
            return s
        return obj

    def _clean_and_parse_chat_json(
        self,
        raw_text: str,
        user_text: str = "",
        prior_question: str = "",
        language: str = "en",
    ) -> ClinicalHistoryRecord:
        cleaned = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()
        if "```" in cleaned:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
            if match:
                cleaned = match.group(1).strip()
            else:
                cleaned = re.sub(r"^```(?:json)?\n|\n```$", "", cleaned, flags=re.MULTILINE).strip()

        # Locate outer JSON object { ... }
        brace_start = cleaned.find("{")
        brace_end = cleaned.rfind("}")
        data: Dict[str, Any] = {}
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            try:
                parsed = json.loads(cleaned[brace_start : brace_end + 1])
                if isinstance(parsed, dict):
                    data = self._sanitize_json_entities(parsed)
            except Exception:
                data = {}

        # 1. Normalize demographics
        if not data.get("patient_demographics") or not isinstance(data.get("patient_demographics"), dict):
            demo: Dict[str, Any] = {}
            if "patient_name" in data or "name" in data:
                demo["name"] = str(data.get("patient_name") or data.get("name"))
            if "age_years" in data and isinstance(data["age_years"], (int, float)):
                demo["age_years"] = int(data["age_years"])
            elif "age" in data and isinstance(data["age"], (int, float)):
                demo["age_years"] = int(data["age"])
            if "gender" in data:
                demo["gender"] = str(data["gender"])
            if "language_preference" in data:
                demo["language_preference"] = str(data["language_preference"])
            if demo:
                data["patient_demographics"] = demo

        # 2. Normalize chief complaint & SOCRATES
        allo = data.get("allopathic_history") if isinstance(data.get("allopathic_history"), dict) else {}

        # Chief complaint
        cc = data.get("chief_complaint")
        if isinstance(cc, str):
            data["chief_complaint"] = {"symptom": cc}
        elif isinstance(cc, dict):
            if "primary_symptom" in cc and "symptom" not in cc:
                cc["symptom"] = cc.pop("primary_symptom")
        elif not cc and allo.get("chief_complaint"):
            data["chief_complaint"] = {
                "symptom": str(allo.get("chief_complaint")),
                "duration": str(allo.get("duration")) if allo.get("duration") else None,
            }

        # HPI SOCRATES
        hpi = data.get("hpi_socrates")
        if isinstance(hpi, dict):
            if "associated_symptoms" in hpi and "associations" not in hpi:
                assoc = hpi.pop("associated_symptoms")
                hpi["associations"] = ", ".join(assoc) if isinstance(assoc, list) else str(assoc)
            if "timing" in hpi and "time_course" not in hpi:
                hpi["time_course"] = str(hpi.pop("timing"))
            if "severity" in hpi and "severity_1_to_10" not in hpi:
                sev = hpi.pop("severity")
                if isinstance(sev, int):
                    hpi["severity_1_to_10"] = sev
        elif not hpi and allo:
            hpi_dict: Dict[str, Any] = {}
            if "location" in allo:
                hpi_dict["site"] = str(allo["location"])
            if "onset" in allo:
                hpi_dict["onset"] = str(allo["onset"])
            if "character" in allo:
                hpi_dict["character"] = str(allo["character"])
            if "radiation" in allo and allo["radiation"] != "Not specified":
                hpi_dict["radiation"] = str(allo["radiation"])
            if "associated_symptoms" in allo:
                assoc = allo["associated_symptoms"]
                hpi_dict["associations"] = ", ".join(assoc) if isinstance(assoc, list) else str(assoc)
            if "timing" in allo:
                hpi_dict["time_course"] = str(allo["timing"])
            if hpi_dict:
                data["hpi_socrates"] = hpi_dict

        # 3. Extract and normalize model's suggested quick replies
        qr_raw = (
            data.get("suggested_quick_replies")
            or data.get("quick_replies")
            or data.get("suggestions")
            or data.get("suggested_replies")
            or data.get("options")
            or []
        )
        normalized_qr: List[str] = []
        if isinstance(qr_raw, list):
            for item in qr_raw:
                if isinstance(item, str) and item.strip():
                    cleaned_item = item.strip().strip('"').strip("'")
                    if 1 < len(cleaned_item) <= 45:
                        normalized_qr.append(cleaned_item)
                elif isinstance(item, dict):
                    val = item.get("text") or item.get("label") or item.get("option")
                    if val and isinstance(val, str) and 1 < len(val.strip()) <= 45:
                        normalized_qr.append(val.strip())

        # 4. Extract and preserve model's next conversational question
        nq = (
            data.get("next_question_to_ask_patient")
            or data.get("next_question")
            or data.get("question")
            or data.get("response")
            or data.get("reply")
        )

        lang = (language or "en").lower()[:2]
        if nq and isinstance(nq, str) and len(nq.strip()) >= 5:
            data["next_question_to_ask_patient"] = nq.strip()
        else:
            if lang == "hi":
                data["next_question_to_ask_patient"] = "कृपया अपने स्वास्थ्य या लक्षणों के बारे में थोड़ा और बताएं।"
            else:
                data["next_question_to_ask_patient"] = "Could you please tell me more about what you are experiencing?"

        if normalized_qr:
            data["suggested_quick_replies"] = normalized_qr[:5]
        else:
            if lang == "hi":
                data["suggested_quick_replies"] = ["हाँ", "नहीं", "मुझे निश्चित नहीं", "और बताएं"]
            else:
                data["suggested_quick_replies"] = ["Yes", "No", "Not sure", "Tell me more"]

        # 5. Red flag detection
        if self._check_red_flags(user_text) or data.get("red_flag_alert") is True:
            data["red_flag_alert"] = True

        return ClinicalHistoryRecord.model_validate(data)

    def _format_alternating_messages(
        self,
        system_content: str,
        chat_history: List[Dict[str, Any]],
        user_text: str,
    ) -> List[Dict[str, str]]:
        """
        Formats a sequence of messages conforming strictly to the alternating
        [system] -> user -> assistant -> user -> assistant -> user format
        required by Gemma, LLaMA, and OpenAI chat templates.
        """
        raw_dialogue: List[Dict[str, str]] = []

        # Process chat history window
        recent_history = chat_history[-10:] if chat_history else []
        for msg in recent_history:
            raw_role = str(msg.get("role", "user")).lower().strip()
            content = str(msg.get("content", "")).strip()
            if not content:
                continue
            role = "assistant" if raw_role in ("assistant", "ai", "bot") else "user"
            raw_dialogue.append({"role": role, "content": content})

        # Append current user utterance
        if user_text and user_text.strip():
            raw_dialogue.append({"role": "user", "content": user_text.strip()})

        # If empty, provide a default user trigger
        if not raw_dialogue:
            raw_dialogue.append({"role": "user", "content": "Hello, please start my clinical consultation."})

        # If dialogue starts with assistant (e.g. initial AI greeting), prepend user consultation starter
        if raw_dialogue[0]["role"] == "assistant":
            raw_dialogue.insert(0, {"role": "user", "content": "Hello, I am ready to begin my clinical consultation."})

        # Merge consecutive messages with the same role to enforce strict alternation
        alternating_dialogue: List[Dict[str, str]] = []
        for m in raw_dialogue:
            if alternating_dialogue and alternating_dialogue[-1]["role"] == m["role"]:
                alternating_dialogue[-1]["content"] += "\n" + m["content"]
            else:
                alternating_dialogue.append({"role": m["role"], "content": m["content"]})

        # Ensure the conversation starts with 'user'
        if alternating_dialogue and alternating_dialogue[0]["role"] != "user":
            alternating_dialogue.insert(0, {"role": "user", "content": "Hello, I am ready to begin my clinical consultation."})

        # Ensure the conversation ends with 'user'
        if alternating_dialogue and alternating_dialogue[-1]["role"] != "user":
            alternating_dialogue.append({"role": "user", "content": user_text.strip() or "Please assess my symptoms."})

        final_messages: List[Dict[str, str]] = []
        if system_content:
            final_messages.append({"role": "system", "content": system_content})
        final_messages.extend(alternating_dialogue)
        return final_messages

    async def _direct_json_chat_completion(
        self,
        user_text: str,
        current_state: Optional[ClinicalHistoryRecord],
        chat_history: List[Dict[str, Any]],
        language: str = "en",
    ) -> ClinicalHistoryRecord:
        system_content = self._build_chat_system_prompt(current_state)
        formatted_messages = self._format_alternating_messages(
            system_content=system_content,
            chat_history=chat_history,
            user_text=user_text,
        )

        prior_q = current_state.next_question_to_ask_patient if current_state else ""

        try:
            response = await self._direct_chat_client.chat.completions.create(
                model=self.text_model_name,
                messages=formatted_messages,  # type: ignore
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            raw_content = response.choices[0].message.content or "{}"
            return self._clean_and_parse_chat_json(raw_content, user_text, prior_q, language)
        except Exception as json_err:
            logger.warning("json_object format failed (%s), retrying standard prompt.", str(json_err))
            response = await self._direct_chat_client.chat.completions.create(
                model=self.text_model_name,
                messages=formatted_messages,  # type: ignore
                temperature=0.2,
            )
            raw_content = response.choices[0].message.content or "{}"
            return self._clean_and_parse_chat_json(raw_content, user_text, prior_q, language)

    async def process_chat(self, request: ChatRequest) -> ClinicalHistoryRecord:
        """
        Process a conversational clinical intake turn using actual model inference.
        Uses fast direct JSON completion as primary strategy with resilient fallback.
        """
        # Determine language preference
        lang = "en"
        if request.current_json_state and request.current_json_state.patient_demographics and request.current_json_state.patient_demographics.language_preference:
            lang = request.current_json_state.patient_demographics.language_preference

        # 1. Primary Strategy: Direct JSON completion with Gemma alternating message formatting
        try:
            result = await self._direct_json_chat_completion(
                user_text=request.user_text,
                current_state=request.current_json_state,
                chat_history=request.chat_history,
                language=lang,
            )
            return self._apply_emergency_guardrail(result, request.user_text)
        except Exception as direct_err:
            logger.warning(
                "Direct JSON chat completion failed: %s. Attempting resilient clinical fallback...",
                str(direct_err),
            )

        # 2. Secondary Strategy: Resilient clinical synthesis with emergency guardrails
        try:
            record = self._clean_and_parse_chat_json(
                raw_text="{}",
                user_text=request.user_text,
                prior_question=request.current_json_state.next_question_to_ask_patient if request.current_json_state else "",
                language=lang,
            )
            return self._apply_emergency_guardrail(record, request.user_text)
        except Exception as synth_err:
            logger.error("Clinical fallback processing failed: %s", str(synth_err))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"LLM clinical intake inference failed: {str(synth_err)}",
            )

    async def generate_initial_greeting(
        self,
        language: str = "en",
        patient_name: Optional[str] = None,
    ) -> Tuple[str, List[str]]:
        """
        Dynamically generates a warm, localized opening clinical greeting message and
        initial category chips from the LLM, with a randomized fallback pool.
        """
        lang = (language or "en").lower()[:2]
        patient_context_str = f" Patient name is {patient_name}." if patient_name else ""

        prompt = (
            f"You are Sanjivani (संजीवनी), an empathetic AI clinical intake assistant for the Ministry of Ayush.{patient_context_str} "
            f"A patient has just opened a new clinical consultation in language '{language}'. "
            f"Generate a warm, natural, and compassionate opening greeting introducing yourself and asking what health issue, symptom, or discomfort they are experiencing today. "
            f"Make your opening sentence natural and varied. "
            f"Also generate 4 varied starter quick-reply chips representing common initial symptom categories (e.g. pain/headache, fever/cold, digestion/stomach, general checkup) in the same language ({language}). "
            f"Output ONLY a valid JSON object matching:\n"
            f'{{"greeting": "...", "suggested_quick_replies": ["...", "...", "...", "..."]}}'
        )

        try:
            response = await self._direct_chat_client.chat.completions.create(
                model=self.text_model_name,
                messages=[
                    {"role": "system", "content": "You are Sanjivani AI Clinical Intake Assistant. Output valid JSON only."},
                    {"role": "user", "content": prompt},
                ],  # type: ignore
                response_format={"type": "json_object"},
                temperature=0.7,
            )
            raw_content = response.choices[0].message.content or "{}"
            cleaned = re.sub(r"<think>.*?</think>", "", raw_content, flags=re.DOTALL).strip()
            brace_start = cleaned.find("{")
            brace_end = cleaned.rfind("}")
            if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
                parsed = json.loads(cleaned[brace_start : brace_end + 1])
                greeting = parsed.get("greeting")
                replies = parsed.get("suggested_quick_replies")
                if greeting and isinstance(greeting, str) and len(greeting.strip()) > 10:
                    valid_replies = [r for r in replies if isinstance(r, str) and r.strip()] if isinstance(replies, list) else []
                    if len(valid_replies) >= 2:
                        return (greeting.strip(), valid_replies[:5])
        except Exception as e:
            logger.warning("LLM dynamic greeting generation fell back to randomized pool: %s", str(e))

        # Diverse randomized fallback greeting pool (varies on every invocation)
        import random
        FALLBACK_GREETINGS: Dict[str, List[Tuple[str, List[str]]]] = {
            "en": [
                (
                    "Hello! I am Sanjivani, your AI clinical intake assistant. How are you feeling today, and what symptoms can I help document for the doctor?",
                    ["Headache / Body Ache", "Fever, Cold or Cough", "Stomach or Digestion issue", "Skin rash or allergy", "General Health Checkup"]
                ),
                (
                    "Welcome to Sanjivani Clinical Intake. I am here to help gather your medical history. What health problem or discomfort brings you in today?",
                    ["Severe Pain / Ache", "Cough, Sore Throat & Fever", "Acidity / Abdominal Pain", "Fatigue / Weakness", "Routine Consultation"]
                ),
                (
                    "Namaste! I am Sanjivani, your clinical assistant. Please take your time and describe any symptoms or health concerns you are currently experiencing.",
                    ["Back / Joint Pain", "Fever & Chills", "Stomach Cramps / Nausea", "Dizziness / Headache", "General Checkup"]
                ),
                (
                    "Good day! I am here to assist with your medical intake before you see the physician. What primary symptom or issue would you like to discuss?",
                    ["Body Pain / Discomfort", "Respiratory / Flu Symptoms", "Digestive / Bowel Concern", "General Wellness Check"]
                ),
            ],
            "hi": [
                (
                    "नमस्ते! मैं संजीवनी, आपकी क्लिनिकल इनटेक सहायक हूँ। आज आपको क्या स्वास्थ्य समस्या या लक्षण महसूस हो रहे हैं?",
                    ["सिरदर्द / बदन दर्द", "बुखार, सर्दी या खांसी", "पेट या पाचन की समस्या", "त्वचा संबंधी समस्या", "सामान्य स्वास्थ्य जांच"]
                ),
                (
                    "संजीवनी क्लिनिकल इनटेक में आपका स्वागत है। मैं आपकी स्वास्थ्य संबंधी जानकारी दर्ज करने में मदद करूंगी। कृपया बताएं कि आपको क्या तकलीफ है?",
                    ["जोड़ों / कमर का दर्द", "तेज बुखार व जुकाम", "एसिडिटी / पेट दर्द", "कमजोरी व थकान", "नियमित स्वास्थ्य जांच"]
                ),
                (
                    "नमस्ते! कृपया बिना किसी संकोच के बताएं कि आज आपको क्या शारीरिक समस्या या बेचैनी महसूस हो रही है?",
                    ["गले में खराश व खांसी", "पेट फूलना / गैस", "सिर में भारीपन", "थकावट व बुखार"]
                ),
            ],
            "ta": [
                (
                    "வணக்கம்! நான் சஞ்சீவனி, உங்கள் மருத்துவ உதவி AI. இன்று உங்களுக்கு என்ன உடல்நல பிரச்சனை அல்லது அறிகுறிகள் உள்ளன?",
                    ["தலைவலி / உடல் வலி", "காய்ச்சல் / சளி / இருமல்", "வயிற்று வலி / செரிமான பிரச்சனை", "பொதுவான உடல் பரிசோதனை"]
                ),
            ],
            "te": [
                (
                    "నమస్కారం! నేను సంజీవని, మీ క్లినికల్ ఇన్‌టేక్ అసిస్టెంట్‌ని. ఈ రోజు మీకు ఏ విధమైన అనారోగ్య సమస్య లేదా లక్షణాలు ఉన్నాయి?",
                    ["తలనొప్పి / ఒంటి నొప్పులు", "జ్వరం / జలుబు / దగ్గు", "కడుపు నొప్పి / జీర్ణ సమస్య", "సాధారణ ఆరోగ్య పరీక్ష"]
                ),
            ],
            "bn": [
                (
                    "নমস্কার! আমি সঞ্জীবনী, আপনার ক্লিনিকাল ইনটেক সহকারী। আজ আপনার কী ধরনের স্বাস্থ্য সমস্যা বা শারীরিক অস্বস্তি হচ্ছে?",
                    ["মাথাব্যথা / গায়ে ব্যথা", "জ্বর, সর্দি বা কাশি", "পেটের বা হজমের समस्या", "সাধারণ স্বাস্থ্য পরীক্ষা"]
                ),
            ],
            "mr": [
                (
                    "नमस्कार! मी संजीवनी, तुमची क्लिनिकल इनटेक सहाय्यक आहे. आज तुम्हाला काय त्रास किंवा लक्षणे जाणवत आहेत?",
                    ["डोकेदुखी / अंगदुखी", "ताप, सर्दी किंवा खोकला", "पोटाची किंवा पचनाची समस्या", "सामान्य आरोग्य तपासणी"]
                ),
            ],
            "gu": [
                (
                    "નમસ્તે! હું સંજીવની, તમારી ક્લિનિકલ ઇનટેક સહાયક છું. આજે તમને શું સ્વાસ્થ્ય સમસ્યા કે લક્ષણો જણાય છે?",
                    ["માથાનો દુખાવો / શરીરનો દુખાવો", "તાવ, શરદી અથવા ઉધરસ", "પેટ અથવા પાચનની તકલીફ", "સામાન્ય સ્વાસ્થ્ય તપાસ"]
                ),
            ],
        }
        pool = FALLBACK_GREETINGS.get(lang, FALLBACK_GREETINGS["en"])
        return random.choice(pool)

    # =========================================================================
    # Phase 2: 2-Stage Medical Document Digitization Pipeline
    #   Stage 1: Pure Vision Model OCR (reads/transcribes the image to text)
    #   Stage 2: Clinical Interpretation LLM (structures into medications & lab tests)
    # =========================================================================

    def _extract_medications_regex(self, text: str) -> List[Dict[str, Any]]:
        meds: List[Dict[str, Any]] = []
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        METADATA_EXCLUSIONS = {
            'name', 'address', 'age', 'sex', 'gender', 'date', 'rx', 'r', 'gm or ml', 'sig', 'seg',
            'physician', 'doctor', 'dr', 'dr.', 'lic', 'ptr', 's2', 'tel', 'phone', 'exp', 'exp date',
            'lot', 'lot no', 'b number', 'batch', 'mfd', 'filled by', 'edition', 'facility',
            'medical', 'u.s.s.', 'hospital', 'clinic', 'directions', 'signature'
        }
        DOCTOR_SIGNATURE_TITLES = {'dr', 'dr.', 'doctor', 'physician', 'md', 'mbbs', 'bams', 'bhms', 'lcdr', 'usnr', 'usn', 'consultant', 'signature'}

        # 1. Global Sig / Direction search
        global_sig = None
        global_dur = None
        for line in lines:
            sig_match = re.search(r'^(?:Sig|Seg|Directions?|Instruction)\s*[:=\-]?\s*(.+)', line, re.IGNORECASE)
            if sig_match:
                global_sig = sig_match.group(1).strip()
                dur_match = re.search(
                    r'\b(?:for\s+)?(\d+\s*(?:days?|weeks?|months?)|seven\s*days?|five\s*days?|three\s*days?|ten\s*days?|two\s*weeks?)\b',
                    global_sig,
                    re.IGNORECASE,
                )
                if dur_match:
                    global_dur = dur_match.group(1).strip()

        # 2. Extract medications (drug + strength OR formula items in Rx section)
        in_rx_section = False
        for i, line_clean in enumerate(lines):
            line_lower = line_clean.lower()

            if re.match(r'^(?:Rx|R|Prescription)\b', line_clean, re.IGNORECASE):
                in_rx_section = True
                continue

            words = set(re.findall(r'[a-zA-Z]+', line_lower))
            if words.intersection(DOCTOR_SIGNATURE_TITLES) or any(line_lower.startswith(x) for x in ('exp date', 'filled by', 'mfd', 'lot', 'b number', 'edition', 'lic no', 'ptr no')):
                in_rx_section = False

            # Match drug + dosage (e.g. Amoxicillin 500mg, Paracetamol 650 mg)
            dosage_pattern = r'\b([A-Za-z\s\.\&\-]+?)\s+(\d+\s*(?:mg|g|ml|mcg|IU|tab|cap|capsule|tablet))\b'
            d_match = re.search(dosage_pattern, line_clean, re.IGNORECASE)
            if d_match:
                drug = d_match.group(1).strip()
                dosage = d_match.group(2).strip()
                if drug.lower() not in METADATA_EXCLUSIONS and len(drug) > 2:
                    context = " ".join(lines[i : min(i + 4, len(lines))])
                    freq = global_sig
                    dur = global_dur
                    freq_match = re.search(
                        r'\b(OD|BD|BID|TDS|TID|QID|HS|SOS|STAT|\d+\s*(?:cap|tab)?\s*(?:\d+x\s*a\s*day|\bthrice daily\b|\btwice daily\b|\bonce daily\b|\bdaily\b))\b',
                        context,
                        re.IGNORECASE,
                    )
                    if freq_match:
                        freq = freq_match.group(1).strip()
                    meds.append({"drug_name": drug, "dosage": dosage, "frequency": freq, "duration": dur})
                    continue

            # Match formula lines in Rx section (e.g. Tr Belladonna, Amphenol qsd, W & FT Solution)
            if in_rx_section:
                if line_lower not in METADATA_EXCLUSIONS and not re.match(r'^(?:gm or ml|sig|seg)', line_lower):
                    drug_cand = re.sub(r'\b(?:qsd|qs|q\.s\.d\.|q\.s\.)\b', '', line_clean, flags=re.IGNORECASE).strip()
                    if len(drug_cand) > 2 and drug_cand.lower() not in METADATA_EXCLUSIONS:
                        meds.append({
                            "drug_name": drug_cand,
                            "dosage": None,
                            "frequency": global_sig,
                            "duration": global_dur,
                        })

        return meds

    def _extract_labs_regex(self, text: str) -> List[Dict[str, Any]]:
        labs: List[Dict[str, Any]] = []
        METADATA_EXCLUSION_WORDS = {
            'exp date', 'expiry', 'exp', 'lot no', 'lot', 'b number', 'batch', 's/n', 'serial',
            'edition', 'lic no', 'lic', 'ptr no', 'ptr', 'reg no', 'tel', 'phone', 'fax',
            'p.o. box', 'sig', 'seg', 'rx', 'r', 'mfd', 'filled by', 'name', 'age', 'sex', 'gender',
            'date', 'page', 'dr', 'doctor', 'physician', 'hospital', 'facility', 'clinic', 'address'
        }
        KNOWN_LAB_TERMS = {
            'hemoglobin', 'hb', 'glucose', 'blood sugar', 'fbs', 'ppbs', 'rbs', 'wbc', 'rbc',
            'platelets', 'platelet count', 'creatinine', 'urea', 'uric acid', 'cholesterol',
            'triglycerides', 'hdl', 'ldl', 'vldl', 'bilirubin', 'sgot', 'sgpt', 'alt', 'ast',
            'alp', 'tsh', 't3', 't4', 'esr', 'hba1c', 'calcium', 'sodium', 'potassium',
            'chloride', 'protein', 'albumin', 'globulin', 'neutrophils', 'lymphocytes',
            'eosinophils', 'monocytes', 'basophils', 'pcr', 'crp', 'vitamin d', 'vitamin b12'
        }

        pattern = r'\b([A-Za-z0-9\s\-\/\(\)]+?)\s*[:=\-]\s*([\d\.]+)\s*([a-zA-Z\/\%\^]+)?\b'
        for line in text.split('\n'):
            match = re.search(pattern, line.strip())
            if match:
                param = match.group(1).strip()
                val = match.group(2).strip()
                unit = match.group(3).strip() if match.group(3) else None
                param_lower = param.lower().strip()
                if any(param_lower == excl or param_lower.startswith(excl) for excl in METADATA_EXCLUSION_WORDS):
                    continue
                is_known = any(k in param_lower for k in KNOWN_LAB_TERMS)
                has_medical_unit = unit and unit.lower() in ('mg/dl', 'g/dl', 'mmol/l', 'ul', '/ul', 'cells/cumm', 'iu/l', 'ng/ml', 'meq/l', 'pg/ml', 'umol/l', '%')
                if is_known or has_medical_unit:
                    labs.append({
                        "parameter_name": param,
                        "observed_value": val,
                        "unit": unit,
                        "is_abnormal": None,
                    })
        return labs

    def _clean_and_parse_ocr_json(self, raw_text: str, default_raw_text: str = "") -> OCRStructuredResult:
        cleaned = raw_text.strip()

        # 1. Clean thinking tags
        if "</think>" in cleaned:
            cleaned = cleaned.split("</think>")[-1].strip()
        elif "<think>" in cleaned:
            cleaned = re.sub(r"<think>.*?</think>", "", cleaned, flags=re.DOTALL).strip()

        # 2. Extract JSON markdown block
        if "```" in cleaned:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
            if match:
                cleaned = match.group(1).strip()
            else:
                cleaned = re.sub(r"^```(?:json)?\n|\n```$", "", cleaned, flags=re.MULTILINE).strip()

        # 3. Locate outer JSON object { ... }
        brace_start = cleaned.find("{")
        brace_end = cleaned.rfind("}")
        data: Dict[str, Any] = {}
        if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
            try:
                data = json.loads(cleaned[brace_start : brace_end + 1])
            except Exception:
                data = {}

        # Filter out administrative keywords from lab tests if model mistakenly included them
        METADATA_DISALLOW = {'exp date', 'expiry', 'exp', 'lot no', 'lot', 'b number', 'batch', 's/n', 'serial', 'edition', 'lic no', 'ptr no', 'sig', 'seg', 'rx'}

        # Normalize medications
        meds_raw = (
            data.get("medications")
            or data.get("drugs")
            or data.get("prescriptions")
            or data.get("medicines")
            or []
        )
        normalized_meds: List[Dict[str, Any]] = []
        if isinstance(meds_raw, list):
            for m in meds_raw:
                if isinstance(m, dict):
                    drug = m.get("drug_name") or m.get("name") or m.get("drug")
                    if drug and str(drug).lower().strip() not in METADATA_DISALLOW:
                        normalized_meds.append({
                            "drug_name": str(drug),
                            "dosage": str(m.get("dosage") or m.get("strength") or "") or None,
                            "frequency": str(m.get("frequency") or m.get("sig") or "") or None,
                            "duration": str(m.get("duration") or "") or None,
                        })

        # Normalize labs
        labs_raw = (
            data.get("lab_investigations")
            or data.get("labs")
            or data.get("investigations")
            or data.get("tests")
            or []
        )
        normalized_labs: List[Dict[str, Any]] = []
        if isinstance(labs_raw, list):
            for l in labs_raw:
                if isinstance(l, dict):
                    param = str(l.get("parameter_name") or l.get("name") or l.get("test") or "")
                    param_lower = param.lower().strip()
                    # Filter out metadata erroneously classified as labs
                    if param and not any(param_lower == d or param_lower.startswith(d) for d in METADATA_DISALLOW):
                        normalized_labs.append({
                            "parameter_name": param,
                            "observed_value": str(l.get("observed_value") or l.get("value") or "") or None,
                            "unit": str(l.get("unit") or "") or None,
                            "is_abnormal": l.get("is_abnormal") if isinstance(l.get("is_abnormal"), bool) else None,
                        })

        # Fallback to regex extraction if either list is empty
        source_text = default_raw_text or raw_text
        if not normalized_meds and source_text:
            normalized_meds = self._extract_medications_regex(source_text)

        if not normalized_labs and source_text:
            normalized_labs = self._extract_labs_regex(source_text)

        result_dict = {
            "medications": normalized_meds,
            "lab_investigations": normalized_labs,
            "raw_text": default_raw_text or raw_text,
        }
        return OCRStructuredResult.model_validate(result_dict)

    async def transcribe_image(
        self,
        base64_image: str,
        mime_type: str = "image/jpeg",
    ) -> str:
        """
        Stage 1: Pure Vision OCR Transcription.
        Uses the Vision Model (e.g. Qwen 3.6 VLM / MedGemma) to read the medical document
        image and return a clean, verbatim text transcription.
        """
        if not base64_image or not base64_image.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty image data provided.",
            )

        image_data_url = f"data:{mime_type};base64,{base64_image.strip()}"

        vision_prompt = (
            "Transcribe all text from this medical prescription or laboratory report image exactly as written.\n"
            "Include patient details, clinical findings, and all prescribed medicines (Rx, dosage, frequency).\n"
            "If this image does NOT contain a medical document or readable text, reply ONLY: NO_DOCUMENT_TEXT_FOUND"
        )

        # Build candidate vision models (excluding text-only models)
        TEXT_ONLY_MODELS = {"openai/gpt-oss-120b", "gpt-oss-120b", "openai/gpt-oss-20b", "gpt-oss-20b"}
        vision_models: list[str] = []
        if self.vision_model_name and self.vision_model_name not in TEXT_ONLY_MODELS:
            vision_models.append(self.vision_model_name)
        if self.vision_base_url and "groq.com" in self.vision_base_url and "qwen/qwen3.6-27b" not in vision_models:
            vision_models.append("qwen/qwen3.6-27b")

        if not vision_models:
            vision_models = ["google/medgemma-1.5-4b-it"]

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
                    temperature=0.15,
                    max_tokens=2048,
                    extra_body={"presence_penalty": 0.3, "frequency_penalty": 0.3},
                )
                raw_text = response.choices[0].message.content or ""

                # Robust thought token cleaner (handles models with chain-of-thought tokens)
                if "<unused95>" in raw_text:
                    after_thought = raw_text.split("<unused95>")[-1].strip()
                    if len(after_thought) > 10:
                        raw_text = after_thought
                elif "</think>" in raw_text:
                    after_thought = raw_text.split("</think>")[-1].strip()
                    if len(after_thought) > 10:
                        raw_text = after_thought

                # Strip residual markers
                raw_text = re.sub(r"<unused94>thought\s*", "", raw_text)
                raw_text = re.sub(r"<think>\s*", "", raw_text)
                raw_text = raw_text.replace("<unused95>", "").replace("</think>", "").replace("<end_of_turn>", "").strip()

                if "NO_DOCUMENT_TEXT_FOUND" in raw_text.upper():
                    logger.info("Stage 1: Non-document image detected by model '%s'.", model)
                    return "NO_DOCUMENT_TEXT_FOUND"

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
        Stage 2: Clinical Entity Structuring & Interpretation.
        Takes the transcribed raw text and extracts standardized medications,
        lab investigations, and full verbatim text into OCRStructuredResult.
        """
        if not raw_text or not raw_text.strip() or "NO_DOCUMENT_TEXT_FOUND" in raw_text.upper():
            return OCRStructuredResult(
                medications=[],
                lab_investigations=[],
                raw_text="No document text detected in this image. Please upload a clear photo or scan of a prescription or laboratory report.",
            )

        # Check for non-document descriptions
        lower_raw = raw_text.lower().strip()
        non_doc_indicators = (
            "photo of a person", "photograph of a person", "photo of a man",
            "photo of a woman", "portrait of", "picture of a person",
            "picture of a man", "picture of a woman", "this image shows a person",
            "this image shows a man", "this image shows a woman", "no text found",
            "no text is visible", "not a medical document", "not a prescription",
            "no text present", "a man with", "a woman with", "a person with",
        )
        if any(ind in lower_raw for ind in non_doc_indicators) and "mg" not in lower_raw and "tablet" not in lower_raw and "rx" not in lower_raw:
            return OCRStructuredResult(
                medications=[],
                lab_investigations=[],
                raw_text="Uploaded image does not appear to be a medical document. No clinical entities extracted.",
            )

        system_instruction = (
            "You are an expert AI clinical data interpreter and pharmacist.\n"
            "Analyze the transcribed medical prescription or diagnostic laboratory report text.\n\n"
            "STRICT EXTRACTION RULES:\n"
            "1. ONLY extract medications or lab investigations that are EXPLICITLY and CLEARLY written in the text.\n"
            "2. If the text does NOT contain prescribed medications or laboratory test results, return empty lists: 'medications': [], 'lab_investigations': [].\n"
            "3. NEVER invent, simulate, or hallucinate medications (like Paracetamol or Montelukast) if they are not in the text.\n"
            "4. 'medications': Extract all prescribed drugs, tinctures, solutions, tablets, syrups, or compounding formulas.\n"
            "   - drug_name: standard medication or formulation name\n"
            "   - dosage: strength/quantity/volume (e.g. '500mg', '5ml', or null if unspecified)\n"
            "   - frequency: dosing schedule (e.g. '5ml thrice daily before meals (t.d. ac.)', '1 cap 3x a day', 'TDS')\n"
            "   - duration: duration of course (e.g. '7 days' or null)\n"
            "5. 'lab_investigations': Extract ONLY genuine diagnostic laboratory biomarkers (e.g. Hemoglobin, Glucose, WBC, Platelets, Creatinine, TSH).\n"
            "   - STRICTLY EXCLUDE administrative numbers (EXP DATE, LOT NO, B NUMBER, S/N, Sig, Lic No, PTR No, Phone, Dates) from lab investigations.\n"
            "   - If no diagnostic lab tests are present in the document, return 'lab_investigations': [].\n\n"
            "Output strictly valid JSON matching:\n"
            "{\n"
            '  "medications": [\n'
            '    {"drug_name": "...", "dosage": "...", "frequency": "...", "duration": null}\n'
            "  ],\n"
            '  "lab_investigations": [],\n'
            '  "raw_text": "..."\n'
            "}"
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
                temperature=0.0,
            )
            raw_content = response.choices[0].message.content or "{}"
            result = self._clean_and_parse_ocr_json(raw_content, raw_text)
            logger.info("Stage 2 structuring succeeded (%d meds, %d labs).", len(result.medications), len(result.lab_investigations))
            return result
        except Exception as direct_err:
            logger.warning("Stage 2 direct text parsing failed (%s), running fallback extraction.", str(direct_err))

        # 2. Fallback: deterministic regex extraction
        return self._clean_and_parse_ocr_json("{}", raw_text)

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

    # =========================================================================
    # Phase 3: Dynamic Model Discovery & Switching (Multimodal Text+Vision)
    # =========================================================================

    MULTIMODAL_MODEL_TYPES = {
        "gemma3", "gemma3_vl", "gemma_3", "qwen2_vl", "qwen2_5_vl", "qwen_vl",
        "llava", "llava_next", "llava_onevision", "mllama", "chameleon",
        "paligemma", "paligemma2", "pixtral", "florence2", "phi3_v", "phi3small_v",
        "internvl", "internvl2", "idefics", "idefics2", "idefics3", "minicpmv",
        "minicpm_v", "blip-2", "instructblip", "molmo", "aria", "aquila_vl",
    }

    MULTIMODAL_ARCHITECTURES = {
        "Gemma3ForConditionalGeneration", "Qwen2VLForConditionalGeneration",
        "Qwen2_5_VLForConditionalGeneration", "LlavaForConditionalGeneration",
        "LlavaNextForConditionalGeneration", "MllamaForConditionalGeneration",
        "ChameleonForConditionalGeneration", "PaliGemmaForConditionalGeneration",
        "PixtralForConditionalGeneration", "Phi3VForCausalLM", "InternVLChatModel",
        "IdeficsForVisionText2Text", "Idefics3ForConditionalGeneration",
        "MiniCPMV", "Florence2ForConditionalGeneration",
    }

    MULTIMODAL_NAME_KEYWORDS = (
        "medgemma", "qwen2-vl", "qwen2.5-vl", "llama-3.2-11b-vision", "llama-3.2-90b-vision",
        "paligemma", "pixtral", "llava", "florence-2", "phi-3-vision", "phi-3.5-vision",
        "minicpm-v", "internvl", "gemma-3", "-vl-", "-vl", "vision", "multimodal", "vlm",
    )

    EXCLUDED_PREFIXES = (
        "sentence-transformers/", "PaddlePaddle/", "BAAI/", "intfloat/", "facebook/dpr",
        "cross-encoder/", "nomic-ai/",
    )

    def _is_multimodal_model(self, model_id: str, repo_snapshot_path: Optional[str] = None) -> bool:
        """
        Determine whether a model supports BOTH text and image inputs (Multimodal VLM).
        Filters out text-only LLMs, embedding models, and single-task OCR weights.
        """
        # 1. Check exclusions
        if any(model_id.startswith(prefix) for prefix in self.EXCLUDED_PREFIXES):
            return False

        # 2. Check active system models
        if model_id == self.text_model_name or model_id == self.vision_model_name:
            if any(k in model_id.lower() for k in ("medgemma", "gemma-4", "gemma-3", "vision", "vl", "multimodal")):
                return True

        # 3. Check name keywords
        lower_id = model_id.lower()
        if any(kw in lower_id for kw in self.MULTIMODAL_NAME_KEYWORDS):
            return True

        # 4. Check config.json in HF cache snapshots
        import glob
        snapshot_dirs = []
        if repo_snapshot_path and os.path.exists(repo_snapshot_path):
            snapshot_dirs.append(repo_snapshot_path)
        else:
            hf_dir_name = "models--" + model_id.replace("/", "--")
            hub_path = os.path.expanduser(f"~/.cache/huggingface/hub/{hf_dir_name}")
            if os.path.exists(hub_path):
                snapshot_dirs.append(hub_path)

        for s_dir in snapshot_dirs:
            configs = glob.glob(os.path.join(s_dir, "snapshots", "*", "config.json"))
            for cfg_file in configs:
                try:
                    with open(cfg_file) as f:
                        cfg = json.load(f)
                        mtype = str(cfg.get("model_type", "")).lower()
                        if mtype in self.MULTIMODAL_MODEL_TYPES:
                            return True
                        archs = cfg.get("architectures", [])
                        if any(a in self.MULTIMODAL_ARCHITECTURES for a in archs):
                            return True
                        if any(k in cfg for k in ("vision_config", "vision_encoder", "image_token_index", "visual", "image_seq_length", "is_multimodal")):
                            return True
                except Exception:
                    pass

        return False

    def _format_model_name(self, model_id: str) -> str:
        parts = model_id.split("/")
        org = parts[0] if len(parts) > 1 else ""
        base = parts[-1]
        readable = base.replace("-", " ").replace("_", " ").title()
        if org and org.lower() not in ("models", "paddlepaddle"):
            return f"{readable} ({org.capitalize()})"
        return readable

    async def get_available_models(self) -> ModelsListResponse:
        """
        Scan local Hugging Face hub cache and query active vLLM instance
        to discover all downloaded models that support BOTH text and image inputs (Multimodal).
        """
        discovered: Dict[str, DownloadedModelInfo] = {}
        vllm_loaded_ids = set()

        # 1. Query live vLLM model endpoint
        try:
            models_res = await self._direct_chat_client.models.list()
            for m in models_res.data:
                vllm_loaded_ids.add(m.id)
                if self._is_multimodal_model(m.id):
                    discovered[m.id] = DownloadedModelInfo(
                        id=m.id,
                        name=self._format_model_name(m.id),
                        size_on_disk="Active in VRAM",
                        source="vllm_server",
                        is_active=(m.id == self.text_model_name or m.id == self.vision_model_name),
                        is_vllm_loaded=True,
                        supports_vision=True,
                        multimodal_capabilities=["text", "image"],
                    )
        except Exception as e:
            logger.debug("vLLM live models query skipped: %s", str(e))

        # 2. Scan Hugging Face cache using huggingface_hub
        try:
            from huggingface_hub import scan_cache_dir
            cache_info = scan_cache_dir()
            for repo in cache_info.repos:
                if repo.repo_type == "model":
                    repo_id = repo.repo_id
                    if self._is_multimodal_model(repo_id, str(repo.repo_path)):
                        is_active = (repo_id == self.text_model_name or repo_id == self.vision_model_name)
                        is_vllm = repo_id in vllm_loaded_ids
                        discovered[repo_id] = DownloadedModelInfo(
                            id=repo_id,
                            name=self._format_model_name(repo_id),
                            size_on_disk=repo.size_on_disk_str,
                            source="huggingface_cache",
                            is_active=is_active,
                            is_vllm_loaded=is_vllm,
                            supports_vision=True,
                            multimodal_capabilities=["text", "image"],
                        )
        except Exception as e:
            logger.debug("huggingface_hub cache scan skipped: %s", str(e))

        # 3. Fallback filesystem scan of ~/.cache/huggingface/hub
        import os
        hf_hub = os.path.expanduser("~/.cache/huggingface/hub")
        if os.path.exists(hf_hub):
            for d in os.listdir(hf_hub):
                if d.startswith("models--"):
                    repo_id = d.replace("models--", "").replace("--", "/")
                    full_model_dir = os.path.join(hf_hub, d)
                    if repo_id not in discovered and self._is_multimodal_model(repo_id, full_model_dir):
                        discovered[repo_id] = DownloadedModelInfo(
                            id=repo_id,
                            name=self._format_model_name(repo_id),
                            source="huggingface_cache",
                            is_active=(repo_id == self.text_model_name or repo_id == self.vision_model_name),
                            is_vllm_loaded=(repo_id in vllm_loaded_ids),
                            supports_vision=True,
                            multimodal_capabilities=["text", "image"],
                        )

        # 4. Always ensure configured active models are present if multimodal
        for active_id in (self.text_model_name, self.vision_model_name):
            if active_id and active_id not in discovered and self._is_multimodal_model(active_id):
                discovered[active_id] = DownloadedModelInfo(
                    id=active_id,
                    name=self._format_model_name(active_id),
                    source="configured",
                    is_active=True,
                    is_vllm_loaded=(active_id in vllm_loaded_ids),
                    supports_vision=True,
                    multimodal_capabilities=["text", "image"],
                )

        model_list = list(discovered.values())
        # Sort: active first, then vLLM loaded, then alphabetically
        model_list.sort(key=lambda m: (not m.is_active, not m.is_vllm_loaded, m.name))

        return ModelsListResponse(
            status="success",
            active_text_model=self.text_model_name,
            active_vision_model=self.vision_model_name,
            models=model_list,
        )

    def switch_model(self, model_name: str, target: str = "both") -> Tuple[str, str]:
        target_lower = target.lower()
        if target_lower in ("text", "both"):
            self.text_model_name = model_name
            chat_kwargs: Dict[str, Any] = {
                "model": self.text_model_name,
                "api_key": self.text_api_key,
                "temperature": 0.2,
            }
            if self.text_base_url:
                chat_kwargs["base_url"] = self.text_base_url
            self._llm = ChatOpenAI(**chat_kwargs)
            self._structured_llm_chat = self._llm.with_structured_output(
                ClinicalHistoryRecord,
                method="function_calling",
            )

        if target_lower in ("vision", "both"):
            self.vision_model_name = model_name
            vision_kwargs: Dict[str, Any] = {
                "model": self.vision_model_name,
                "api_key": self.vision_api_key,
                "temperature": 0.1,
            }
            if self.vision_base_url:
                vision_kwargs["base_url"] = self.vision_base_url
            self._vision_llm = ChatOpenAI(**vision_kwargs)
            self._structured_llm_ocr = self._vision_llm.with_structured_output(
                OCRStructuredResult,
                method="function_calling",
            )

        logger.info(
            "Switched model: text='%s', vision='%s' (target=%s)",
            self.text_model_name,
            self.vision_model_name,
            target,
        )
        return (self.text_model_name, self.vision_model_name)

    # ──────────────────────────────────────────────────────────────────────────
    # Clinical Summary Generation
    # ──────────────────────────────────────────────────────────────────────────

    async def generate_clinical_summary(self, request: SummarizeRequest) -> SummarizeResponse:
        """
        Generate a structured clinical summary.

        Strategy:
        - Structured fields (patient info, symptoms, HPI, medications, labs) are assembled
          DETERMINISTICALLY in Python — zero hallucination risk.
        - Only the conversational narrative section (what the patient said in chat) is sent
          to the LLM for natural-language synthesis, with a very tight instruction to NOT add
          anything that isn't in the transcript.
        - All sections are merged at the end into a SummarizeResponse.
        """
        lang = request.language or "en"

        # ══════════════════════════════════════════════════════════════════════
        # 1. DETERMINISTIC SECTIONS (never touch the LLM)
        # ══════════════════════════════════════════════════════════════════════

        def _get(obj: Any, key: str, default: Any = None) -> Any:
            if obj is None:
                return default
            if isinstance(obj, dict):
                return obj.get(key, default)
            return getattr(obj, key, default)

        # ── Patient info ──────────────────────────────────────────────────────
        patient_info_parts: list[str] = []
        if request.clinical_record:
            demo = _get(request.clinical_record, "patient_demographics")
            if demo:
                age = _get(demo, "age_years")
                gender = _get(demo, "gender")
                lang_pref = _get(demo, "language_preference")
                if age:
                    patient_info_parts.append(f"Age {age} years")
                if gender:
                    patient_info_parts.append(f"Gender: {gender}")
                if lang_pref:
                    patient_info_parts.append(f"Language: {str(lang_pref).upper()}")
        patient_info = ", ".join(patient_info_parts) if patient_info_parts else None

        # ── Chief complaint ───────────────────────────────────────────────────
        chief_complaint: Optional[str] = None
        if request.clinical_record:
            cc = _get(request.clinical_record, "chief_complaint")
            if cc:
                symp = _get(cc, "symptom")
                dur = _get(cc, "duration")
                if symp:
                    chief_complaint = str(symp).strip()
                    if dur:
                        dur_str = str(dur).strip()
                        qualitative = {"intermittent", "constant", "sudden", "gradual", "none", "null", "unknown", "unspecified"}
                        if dur_str.lower() not in qualitative:
                            chief_complaint += f" ({dur_str})"

        # ── History of presenting illness ─────────────────────────────────────
        hpi_parts: list[str] = []
        if request.clinical_record:
            hpi = _get(request.clinical_record, "hpi_socrates")
            if hpi:
                site = _get(hpi, "site")
                onset = _get(hpi, "onset")
                character = _get(hpi, "character")
                radiation = _get(hpi, "radiation")
                severity = _get(hpi, "severity_1_to_10")
                associations = _get(hpi, "associations")
                time_course = _get(hpi, "time_course")
                exacerbating_relieving = _get(hpi, "exacerbating_relieving")

                if site:
                    hpi_parts.append(f"Location: {site}")
                if onset:
                    hpi_parts.append(f"Pattern: {onset}")
                if character:
                    hpi_parts.append(f"Character: {character}")
                if radiation:
                    hpi_parts.append(f"Radiation: {radiation}")
                if severity:
                    hpi_parts.append(f"Severity: {severity}/10")
                if associations:
                    hpi_parts.append(f"Associated symptoms: {associations}")
                if time_course and (not onset or str(time_course).strip().lower() != str(onset).strip().lower()):
                    hpi_parts.append(f"Timing: {time_course}")
                if exacerbating_relieving:
                    hpi_parts.append(f"Aggravating/relieving: {exacerbating_relieving}")

            lifestyle = _get(request.clinical_record, "ahara_vihara_lifestyle")
            if lifestyle:
                sleep = _get(lifestyle, "sleep_pattern")
                diet = _get(lifestyle, "diet_habits")
                bowel = _get(lifestyle, "koshtha_bowel")
                agni = _get(lifestyle, "agni_digestion")

                if sleep:
                    hpi_parts.append(f"Sleep: {sleep}")
                if diet:
                    hpi_parts.append(f"Diet: {diet}")
                if bowel:
                    hpi_parts.append(f"Bowel habit: {bowel}")
                if agni:
                    hpi_parts.append(f"Digestion: {agni}")

        hpi_text = " | ".join(hpi_parts) if hpi_parts else None

        # ── Ayush assessment ──────────────────────────────────────────────────
        ayush_parts: list[str] = []
        if request.clinical_record:
            ayush = _get(request.clinical_record, "ayush_dashavidha_pariksha")
            if ayush:
                prakriti = _get(ayush, "prakriti")
                vikriti = _get(ayush, "vikriti")
                agni = _get(ayush, "agni")
                koshtha = _get(ayush, "koshtha")

                if prakriti:
                    ayush_parts.append(f"Prakriti: {prakriti}")
                if vikriti:
                    ayush_parts.append(f"Vikriti: {vikriti}")
                if agni:
                    ayush_parts.append(f"Agni: {agni}")
                if koshtha:
                    ayush_parts.append(f"Koshtha: {koshtha}")
        ayush_text = " | ".join(ayush_parts) if ayush_parts else None

        # ── Red flags ─────────────────────────────────────────────────────────
        red_flags: Optional[str] = None
        if request.clinical_record and _get(request.clinical_record, "red_flag_alert"):
            red_flags = "⚠️ EMERGENCY: Patient has reported acute life-threatening symptoms. Immediate hospital referral required."

        # ── Documents & Investigations ────────────────────────────────────────
        doc_lines: list[str] = []
        for i, doc in enumerate(request.scan_results, 1):
            label = _get(doc, "document_label") or f"Document {i}"
            doc_lines.append(f"📄 {label}")

            meds = _get(doc, "medications") or []
            if meds:
                doc_lines.append("  Medications:")
                for m in meds:
                    drug_name = _get(m, "drug_name")
                    if not drug_name:
                        continue
                    med_line = f"    • {drug_name}"
                    details: list[str] = []
                    dosage = _get(m, "dosage")
                    freq = _get(m, "frequency")
                    duration = _get(m, "duration")
                    if dosage:
                        details.append(str(dosage))
                    if freq:
                        details.append(str(freq))
                    if duration:
                        details.append(f"for {duration}")
                    if details:
                        med_line += " — " + ", ".join(details)
                    doc_lines.append(med_line)

            labs = _get(doc, "lab_investigations") or []
            if labs:
                doc_lines.append("  Lab Investigations:")
                for lab in labs:
                    param_name = _get(lab, "parameter_name")
                    if not param_name:
                        continue
                    is_abn = _get(lab, "is_abnormal")
                    obs_val = _get(lab, "observed_value")
                    unit = _get(lab, "unit")
                    status_flag = " [ABNORMAL]" if is_abn else ""
                    value_str = str(obs_val) if obs_val is not None else "?"
                    unit_str = f" {unit}" if unit else ""
                    doc_lines.append(f"    • {param_name}: {value_str}{unit_str}{status_flag}")

            raw_txt = _get(doc, "raw_text")
            if not meds and not labs:
                if raw_txt:
                    doc_lines.append("  Raw OCR Text:")
                    doc_lines.append(f"    {str(raw_txt)[:300]}...")

            doc_lines.append("")  # Blank line between documents

        documents_text = "\n".join(doc_lines).strip() if doc_lines else None


        # ══════════════════════════════════════════════════════════════════════
        # 2. LLM SECTION: Narrative from patient chat only
        # ══════════════════════════════════════════════════════════════════════
        llm_narrative: Optional[str] = None
        llm_recommendations: Optional[str] = None

        patient_utterances = [
            entry["content"]
            for entry in request.chat_history
            if entry.get("role") == "user" and entry.get("content")
        ]

        if patient_utterances:
            chat_block = "\n".join(f"- {u}" for u in patient_utterances)

            lang_instruction = (
                "Respond in Hindi (Devanagari script)." if lang.startswith("hi")
                else "Respond in English."
            )

            system_prompt = (
                "You are a clinical scribe writing a brief intake note for a physician. "
                f"{lang_instruction}\n\n"
                "STRICT RULES:\n"
                "1. ONLY summarize what the patient said in the consultation. NEVER invent, assume, or hallucinate symptoms.\n"
                "2. If a patient's statement is a short phrase (e.g. 'Gas', 'Upper abdomen'), accurately state that the patient reported these symptoms.\n"
                "3. Write a concise clinical paragraph (2-4 sentences).\n"
                "4. Do NOT repeat document or lab data.\n"
                "5. End with 'RECOMMENDATIONS:' followed by 2-3 logical clinical next steps."
            )

            user_prompt = (
                "Patient statements during intake:\n"
                f"{chat_block}\n\n"
                "Write the clinical narrative and RECOMMENDATIONS."
            )

            try:
                messages = self._format_alternating_messages(
                    system_content=system_prompt,
                    chat_history=[],
                    user_text=user_prompt,
                )
                response = await self._llm.ainvoke(messages)
                raw_llm = response.content if hasattr(response, "content") else str(response)

                # Clean special tokens and internal reasoning traces
                clean_llm = raw_llm
                if "<unused" in clean_llm:
                    parts = re.split(r"<unused\d+>", clean_llm)
                    clean_llm = parts[-1].strip()
                clean_llm = re.sub(r"<thought>.*?</thought>", "", clean_llm, flags=re.DOTALL).strip()

                # Split out RECOMMENDATIONS line safely
                rec_match = re.search(r"(?:^|\n)\s*RECOMMENDATIONS\s*:\s*", clean_llm, flags=re.IGNORECASE)
                if rec_match:
                    llm_narrative = clean_llm[:rec_match.start()].strip()
                    llm_recommendations = clean_llm[rec_match.end():].strip()
                else:
                    llm_narrative = clean_llm.strip()

            except Exception as e:
                logger.exception("Summary LLM narrative call failed: %s", e)
                llm_narrative = None

        # ══════════════════════════════════════════════════════════════════════
        # 3. ASSEMBLE FINAL RESPONSE
        # ══════════════════════════════════════════════════════════════════════
        sections = SummarySections(
            patient_info=patient_info,
            chief_complaint=chief_complaint,
            history=hpi_text,
            clinical_narrative=llm_narrative,
            documents=documents_text,
            ayush_assessment=ayush_text,
            red_flags=red_flags,
            recommendations=llm_recommendations,
        )

        # Build full narrative text for display
        narrative_parts: list[str] = []
        if patient_info:
            narrative_parts.append(f"PATIENT INFO: {patient_info}")
        if chief_complaint:
            narrative_parts.append(f"CHIEF COMPLAINT: {chief_complaint}")
        if hpi_text:
            narrative_parts.append(f"HISTORY OF PRESENTING ILLNESS: {hpi_text}")
        if llm_narrative:
            narrative_parts.append(f"CLINICAL NARRATIVE:\n{llm_narrative}")
        if documents_text:
            narrative_parts.append(f"DOCUMENTS & INVESTIGATIONS:\n{documents_text}")
        if ayush_text:
            narrative_parts.append(f"AYUSH ASSESSMENT: {ayush_text}")
        if red_flags:
            narrative_parts.append(f"RED FLAGS: {red_flags}")
        if llm_recommendations:
            narrative_parts.append(f"RECOMMENDATIONS:\n{llm_recommendations}")

        narrative = "\n\n".join(narrative_parts) if narrative_parts else "No clinical data collected yet. Start a conversation or scan a document."

        return SummarizeResponse(
            status="success",
            summary_text=narrative,
            summary_sections=sections,
        )



# Global singleton instance
_llm_service: Optional[ClinicalLLMService] = None


def get_llm_service() -> ClinicalLLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = ClinicalLLMService()
    return _llm_service
