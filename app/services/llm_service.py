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
    "Elicit both Allopathic (SOCRATES: Site, Onset, Character, Radiation, Associated symptoms, Timing, Exacerbating/relieving, Severity 1-10) "
    "and Ayurvedic data (Dashavidha Pariksha, Agni, Koshtha). "
    "Never ask more than one or two simple questions at once. "
    "If the patient mentions chest pain, severe bleeding, sudden paralysis, or breathlessness, set red_flag_alert to true. "
    "In the next_question_to_ask_patient field, write the exact localized empathetic question for the voice assistant to speak next. "
    "Output ONLY a valid JSON object matching the blueprint."
)

JSON_BLUEPRINT_CHAT = """{
  "patient_demographics": { "name": null, "age_years": null, "gender": null, "language_preference": "en" },
  "chief_complaint": { "symptom": "...", "duration": "..." },
  "hpi_socrates": { "site": "...", "onset": "...", "character": "...", "radiation": null, "associations": null, "time_course": null, "exacerbating_relieving": null, "severity_1_to_10": null },
  "ayush_dashavidha_pariksha": { "prakriti": null, "vikriti": null, "agni": null, "koshtha": null },
  "ahara_vihara_lifestyle": { "diet_habits": null, "sleep_pattern": null, "koshtha_bowel": null, "agni_digestion": null },
  "red_flag_alert": false,
  "next_question_to_ask_patient": "..."
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
        current_state_json = (
            current_state.model_dump_json(exclude_none=True)
            if current_state
            else "{}"
        )
        return (
            f"{SYSTEM_PROMPT_CHAT}\n\n"
            f"--- JSON BLUEPRINT FORMAT ---\n"
            f"{JSON_BLUEPRINT_CHAT}\n\n"
            f"--- CURRENT STRUCTURED CLINICAL STATE ---\n"
            f"{current_state_json}\n\n"
            f"Integrate any newly reported symptoms into the JSON state while preserving prior fields. "
            f"Set 'next_question_to_ask_patient' to an empathetic, targeted follow-up question in the patient's language. "
            f"Output ONLY the valid JSON object."
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

    def _clean_and_parse_chat_json(self, raw_text: str, user_text: str = "") -> ClinicalHistoryRecord:
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
                data = json.loads(cleaned[brace_start : brace_end + 1])
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

        # 2. Normalize chief complaint & SOCRATES from flat or nested 'allopathic_history'
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
        elif not cc and user_text:
            data["chief_complaint"] = {"symptom": user_text}

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

        # 3. Normalize next question
        nq = (
            data.get("next_question_to_ask_patient")
            or data.get("next_question")
            or data.get("question")
            or data.get("response")
            or data.get("reply")
        )
        if nq and isinstance(nq, str) and len(nq.strip()) > 5:
            data["next_question_to_ask_patient"] = nq.strip()
        else:
            symptom = (
                (data.get("chief_complaint") or {}).get("primary_symptom")
                or user_text
                or "your symptoms"
            )
            data["next_question_to_ask_patient"] = (
                f"Could you please describe where the {symptom} is located, when it started, and how severe it feels (1 to 10)?"
            )

        # 4. Red flag detection
        if self._check_red_flags(user_text) or data.get("red_flag_alert") is True:
            data["red_flag_alert"] = True

        return ClinicalHistoryRecord.model_validate(data)

    async def _direct_json_chat_completion(
        self,
        user_text: str,
        current_state: Optional[ClinicalHistoryRecord],
        chat_history: List[Dict[str, Any]],
    ) -> ClinicalHistoryRecord:
        system_content = self._build_chat_system_prompt(current_state)
        formatted_messages = [{"role": "system", "content": system_content}]

        recent_history = chat_history[-10:] if chat_history else []
        for msg in recent_history:
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
            return self._clean_and_parse_chat_json(raw_content, user_text)
        except Exception as json_err:
            logger.warning("json_object format failed (%s), retrying standard prompt.", str(json_err))
            response = await self._direct_chat_client.chat.completions.create(
                model=self.text_model_name,
                messages=formatted_messages,  # type: ignore
                temperature=0.2,
            )
            raw_content = response.choices[0].message.content or "{}"
            return self._clean_and_parse_chat_json(raw_content, user_text)

    async def process_chat(self, request: ChatRequest) -> ClinicalHistoryRecord:
        """
        Process a conversational clinical intake turn using actual model inference.
        Uses fast direct JSON completion as primary strategy with LangChain as fallback.
        """
        # 1. Primary Strategy: Direct JSON completion
        try:
            result = await self._direct_json_chat_completion(
                user_text=request.user_text,
                current_state=request.current_json_state,
                chat_history=request.chat_history,
            )
            return self._apply_emergency_guardrail(result, request.user_text)
        except Exception as direct_err:
            logger.warning(
                "Direct JSON chat completion failed (%s). Attempting LangChain structured fallback...",
                str(direct_err),
            )

        # 2. Secondary Strategy: LangChain structured output with function_calling
        try:
            messages = self._build_chat_messages(
                user_text=request.user_text,
                current_state=request.current_json_state,
                chat_history=request.chat_history,
            )
            result = await self._structured_llm_chat.ainvoke(messages)
            return self._apply_emergency_guardrail(result, request.user_text)
        except Exception as func_err:
            logger.error("LLM chat processing failed completely: %s", str(func_err))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"LLM clinical intake inference failed: {str(func_err)}",
            )

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
            "You are an expert medical transcriptionist. "
            "Transcribe all text from this medical prescription or diagnostic laboratory report image exactly as written. "
            "Include doctor details, patient details, diagnosis, and all prescribed medicines (Rx, dosage, frequency). "
            "Output ONLY the transcribed text."
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
                    temperature=0.2,
                    max_tokens=2048,
                    extra_body={"presence_penalty": 0.3, "frequency_penalty": 0.3},
                )
                raw_text = response.choices[0].message.content or ""
                # Clean thinking trace / special tokens if present
                raw_text = re.sub(r"<unused94>thought.*?<unused95>", "", raw_text, flags=re.DOTALL)
                raw_text = re.sub(r"<unused94>thought.*", "", raw_text, flags=re.DOTALL)
                if "</think>" in raw_text:
                    raw_text = raw_text.split("</think>")[-1].strip()
                elif "<think>" in raw_text:
                    raw_text = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()

                raw_text = raw_text.replace("<end_of_turn>", "").strip()

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
        if not raw_text or not raw_text.strip():
            return OCRStructuredResult(raw_text="")

        system_instruction = (
            "You are an expert AI clinical data interpreter and pharmacist.\n"
            "Analyze the transcribed medical prescription or diagnostic laboratory report text.\n\n"
            "Rules for Extraction:\n"
            "1. 'medications': Extract all prescribed drugs, tinctures, solutions, tablets, syrups, or compounding formulas (e.g. Tr Belladonna, Amphenol, Amoxicillin 500mg).\n"
            "   - drug_name: standard medication or formulation name\n"
            "   - dosage: strength/quantity/volume (e.g. '500mg', '5ml', or null if unspecified)\n"
            "   - frequency: dosing schedule (e.g. '5ml thrice daily before meals (t.d. ac.)', '1 cap 3x a day', 'TDS')\n"
            "   - duration: duration of course (e.g. '7 days' or null)\n"
            "2. 'lab_investigations': Extract ONLY genuine diagnostic laboratory biomarkers (e.g. Hemoglobin, Glucose, WBC, Platelets, Creatinine, TSH).\n"
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
                temperature=0.1,
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



# Global singleton instance
_llm_service: Optional[ClinicalLLMService] = None


def get_llm_service() -> ClinicalLLMService:
    global _llm_service
    if _llm_service is None:
        _llm_service = ClinicalLLMService()
    return _llm_service
