import json
import logging
from typing import Any, Dict, List, Optional

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_openai import ChatOpenAI

from app.core.config import settings
from app.models.schemas import (
    AgniType,
    AharaViharaLifestyle,
    AyushDashavidhaPariksha,
    ChatRequest,
    ChiefComplaint,
    ClinicalHistoryRecord,
    HpiSocrates,
    KoshthaType,
    PatientDemographics,
    PrakritiType,
    VayaAgeGroup,
)

logger = logging.getLogger("sanjivani.llm_service")

SYSTEM_PROMPT = (
    "You are an expert AI clinical intake assistant for the Ministry of Ayush. "
    "Your job is to elicit a comprehensive medical history from a patient using a conversational approach. "
    "Elicit both Allopathic (SOCRATES framework) and Ayurvedic data (Dashavidha Pariksha, Agni, Koshtha). "
    "Never ask more than one or two simple questions at once. "
    "Branch dynamically based on user symptoms. "
    "If the user mentions chest pain, severe bleeding, sudden paralysis, or breathlessness, set red_flag_alert to true. "
    "You MUST output ONLY valid JSON using the provided schema. "
    "Update the JSON with the information gathered so far. "
    "In the next_question_to_ask_patient field, write the exact localized text you want the voice assistant to speak next. "
    "The next_question_to_ask_patient must always be generated in the language specified by the language_preference field, "
    "while the rest of the JSON values must remain in English. "
    "Do not output conversational filler outside the JSON."
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
        self.base_url = settings.OPENAI_BASE_URL
        self._llm = None
        self._structured_llm = None

        if self.api_key:
            try:
                llm_kwargs: Dict[str, Any] = {
                    "model": self.model_name,
                    "api_key": self.api_key,
                    "temperature": 0.2,
                }
                if self.base_url:
                    llm_kwargs["base_url"] = self.base_url

                self._llm = ChatOpenAI(**llm_kwargs)
                self._structured_llm = self._llm.with_structured_output(
                    ClinicalHistoryRecord
                )
                logger.info("Initialized OpenAI Chat model %s with structured output.", self.model_name)
            except Exception as e:
                logger.error("Failed to initialize LangChain ChatOpenAI: %s", str(e))

    def _build_messages(
        self,
        user_text: str,
        current_state: Optional[ClinicalHistoryRecord],
        chat_history: List[Dict[str, Any]],
    ) -> List[BaseMessage]:
        messages: List[BaseMessage] = []

        # 1. System Prompt with current clinical state injection
        current_state_json = (
            current_state.model_dump_json(exclude_none=True)
            if current_state
            else "{}"
        )
        system_instruction = (
            f"{SYSTEM_PROMPT}\n\n"
            f"--- CURRENT STRUCTURED CLINICAL STATE (JSON) ---\n"
            f"{current_state_json}\n\n"
            f"Integrate any new information from the patient's statement into this state while preserving prior validated fields."
        )
        messages.append(SystemMessage(content=system_instruction))

        # 2. Conversational State Injection (Past turns)
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

        # 3. Current User Turn
        messages.append(HumanMessage(content=user_text))
        return messages

    def _check_red_flags(self, text: str) -> bool:
        lower_text = text.lower()
        return any(keyword in lower_text for keyword in RED_FLAG_KEYWORDS)

    def _mock_process(
        self,
        user_text: str,
        current_state: Optional[ClinicalHistoryRecord],
    ) -> ClinicalHistoryRecord:
        """Deterministic fallback processor when running in offline/testing mode without API keys."""
        state = current_state.model_copy(deep=True) if current_state else ClinicalHistoryRecord()

        # Check red flags
        is_emergency = self._check_red_flags(user_text) or state.red_flag_alert
        state.red_flag_alert = is_emergency

        # Extract language preference if present in demographics
        lang = "en"
        if state.patient_demographics and state.patient_demographics.language_preference:
            lang = state.patient_demographics.language_preference.lower()

        lower_input = user_text.lower()

        # Update Chief Complaint if not set
        if not state.chief_complaint:
            state.chief_complaint = ChiefComplaint()
        if not state.chief_complaint.symptom:
            state.chief_complaint.symptom = user_text.strip()

        # Update Demographics if mentioned
        if not state.patient_demographics:
            state.patient_demographics = PatientDemographics(language_preference=lang)

        # Update HPI Socrates
        if not state.hpi_socrates:
            state.hpi_socrates = HpiSocrates()

        if "pain" in lower_input or "ache" in lower_input or "stiffness" in lower_input:
            if "back" in lower_input:
                state.hpi_socrates.site = "Lower back"
            elif "stomach" in lower_input or "abdomen" in lower_input:
                state.hpi_socrates.site = "Abdomen"
            elif "head" in lower_input:
                state.hpi_socrates.site = "Head"

        # Update Ayush Dashavidha & Ahara/Vihara
        if not state.ayush_dashavidha_pariksha:
            state.ayush_dashavidha_pariksha = AyushDashavidhaPariksha()
        if not state.ahara_vihara_lifestyle:
            state.ahara_vihara_lifestyle = AharaViharaLifestyle()

        if "constipat" in lower_input or "hard stool" in lower_input:
            state.ahara_vihara_lifestyle.koshtha_bowel = KoshthaType.KRURA
        elif "loose" in lower_input or "diarrhea" in lower_input:
            state.ahara_vihara_lifestyle.koshtha_bowel = KoshthaType.MRIDU

        if "gas" in lower_input or "bloat" in lower_input or "irregular hunger" in lower_input:
            state.ahara_vihara_lifestyle.agni_digestion = AgniType.VISHAMAGNI
        elif "burning" in lower_input or "acidity" in lower_input:
            state.ahara_vihara_lifestyle.agni_digestion = AgniType.TIKSHNAGNI

        # Formulate next question based on state and language
        if is_emergency:
            if lang.startswith("hi"):
                state.next_question_to_ask_patient = "यह एक आपातकालीन स्थिति हो सकती है। कृपया तुरंत निकटतम आपातकालीन चिकित्सा कक्ष में जाएं या 108 पर कॉल करें।"
            else:
                state.next_question_to_ask_patient = "EMERGENCY: Your symptoms indicate an urgent medical situation. Please proceed immediately to the nearest emergency room or call for emergency assistance."
        else:
            if not state.chief_complaint.duration:
                if lang.startswith("hi"):
                    state.next_question_to_ask_patient = "यह समस्या आपको कितने समय से हो रही है?"
                else:
                    state.next_question_to_ask_patient = "How long have you been experiencing this symptom?"
            elif not state.hpi_socrates.character:
                if lang.startswith("hi"):
                    state.next_question_to_ask_patient = "क्या आप इस दर्द या तकलीफ का प्रकार बता सकते हैं? क्या यह तेज, हल्का, या जलन जैसा है?"
                else:
                    state.next_question_to_ask_patient = "Can you describe the nature of this discomfort (e.g., sharp, dull, throbbing, or burning)?"
            elif not state.ahara_vihara_lifestyle.agni_digestion:
                if lang.startswith("hi"):
                    state.next_question_to_ask_patient = "आपकी भूख और पाचन क्रिया कैसी रहती है?"
                else:
                    state.next_question_to_ask_patient = "How is your appetite and digestion throughout the day?"
            else:
                if lang.startswith("hi"):
                    state.next_question_to_ask_patient = "आपकी नींद कैसी है, और क्या कोई अन्य लक्षण महसूस हो रहा है?"
                else:
                    state.next_question_to_ask_patient = "How is your sleep quality, and are there any other associated symptoms you notice?"

        return state

    async def process_chat(self, request: ChatRequest) -> ClinicalHistoryRecord:
        """
        Process a conversational turn using LangChain ChatOpenAI with structured output.
        Falls back safely to local processing if LLM is unconfigured or encounters an error.
        """
        if self._structured_llm is not None:
            try:
                messages = self._build_messages(
                    user_text=request.user_text,
                    current_state=request.current_json_state,
                    chat_history=request.chat_history,
                )

                # Invoke LangChain structured output
                result: ClinicalHistoryRecord = await self._structured_llm.ainvoke(messages)

                # Safety guardrail check
                if self._check_red_flags(request.user_text):
                    result.red_flag_alert = True

                return result
            except Exception as e:
                logger.error("LLM execution error: %s. Falling back to deterministic processor.", str(e))
                return self._mock_process(
                    user_text=request.user_text,
                    current_state=request.current_json_state,
                )

        # Fallback if no OpenAI API key is configured
        return self._mock_process(
            user_text=request.user_text,
            current_state=request.current_json_state,
        )


# Global singleton instance
_llm_service: Optional[ClinicalLLMService] = None


def get_llm_service() -> ClinicalLLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = ClinicalLLMService()
    return _llm_service
