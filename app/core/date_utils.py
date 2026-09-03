import re
from datetime import date, datetime, timedelta, timezone
from typing import Optional

MONTH_NAMES = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
}

WORD_TO_NUM = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "fourteen": 14, "fifteen": 15, "thirty": 30
}


def normalize_year(y: int) -> int:
    """Normalize 2-digit years to 4-digit years."""
    if y < 50:
        return 2000 + y
    elif y < 100:
        return 1900 + y
    return y


def extract_prescription_date_from_text(raw_text: Optional[str]) -> Optional[date]:
    """
    Extracts the explicit prescription or visit date written on the prescription slip.
    Handles:
    - Multiline or labeled dates (e.g., 'DATE\n23 JAN 99', 'Date: 12-03-90', 'Dated: 15-Aug-2024')
    - Two-digit and four-digit years (90 -> 1990, 99 -> 1999, 24 -> 2024)
    - Slash/dash/dot separators (12/03/90, 12-03-90, 12.03.90)
    - Ignores administrative expiry dates (EXP DATE), manufacturing dates (MFD), and form editions.
    """
    if not raw_text:
        return None

    cleaned_lines = []
    for line in str(raw_text).splitlines():
        line_l = line.lower().strip()
        # Exclude administrative expiry/manufacturing lines
        if any(line_l.startswith(p) for p in ("exp date", "expiry", "exp:", "mfd", "edition of")):
            continue
        cleaned_lines.append(line)
    clean_text = "\n".join(cleaned_lines)

    # Priority 1: Labeled date with Month Name (e.g. 'DATE\n23 JAN 99', 'Date: 15 Aug 2024')
    m1 = re.search(
        r"(?:prescription\s*date|visit\s*date|\bdate\b|\bdated\b|\bdt\b)[:\s]*\n*[:\s]*(\d{1,2})[-\s]+([A-Za-z]{3,9})[-\s,]+(\d{2,4})\b",
        clean_text,
        re.IGNORECASE,
    )
    if m1:
        d = int(m1.group(1))
        m_str = m1.group(2).lower()[:3]
        y = normalize_year(int(m1.group(3)))
        if m_str in MONTH_NAMES:
            try:
                return date(y, MONTH_NAMES[m_str], d)
            except Exception:
                pass

    # Priority 2: Labeled numeric date (e.g. 'Date: 12-03-90', 'Date: 15/08/2023')
    m2 = re.search(
        r"(?:prescription\s*date|visit\s*date|\bdate\b|\bdated\b|\bdt\b)[:\s]*\n*[:\s]*(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b",
        clean_text,
        re.IGNORECASE,
    )
    if m2:
        val1 = int(m2.group(1))
        val2 = int(m2.group(2))
        y = normalize_year(int(m2.group(3)))
        if 1 <= val2 <= 12 and 1 <= val1 <= 31:
            d, m = val1, val2
        elif 1 <= val1 <= 12 and 1 <= val2 <= 31:
            m, d = val1, val2
        else:
            d, m = val1, val2
        try:
            return date(y, m, d)
        except Exception:
            pass

    # Priority 3: Explicit 'DD-Mon-YYYY' or 'DD Mon YYYY' anywhere in text
    m3 = re.search(
        r"\b(\d{1,2})[-\s]+([A-Za-z]{3,9})[-\s,]+(\d{2,4})\b",
        clean_text,
        re.IGNORECASE,
    )
    if m3:
        d = int(m3.group(1))
        m_str = m3.group(2).lower()[:3]
        y = normalize_year(int(m3.group(3)))
        if m_str in MONTH_NAMES:
            try:
                return date(y, MONTH_NAMES[m_str], d)
            except Exception:
                pass

    # Priority 4: Standalone YYYY-MM-DD
    m4 = re.search(r"\b(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})\b", clean_text)
    if m4:
        y, m, d = int(m4.group(1)), int(m4.group(2)), int(m4.group(3))
        try:
            return date(y, m, d)
        except Exception:
            pass

    # Priority 5: Standalone DD/MM/YYYY or DD-MM-YY
    m5 = re.search(r"\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b", clean_text)
    if m5:
        d, m = int(m5.group(1)), int(m5.group(2))
        y = normalize_year(int(m5.group(3)))
        try:
            return date(y, m, d)
        except Exception:
            pass

    return None


def parse_duration_to_days(duration_str: Optional[str]) -> int:
    """
    Parses natural language duration strings (e.g., '3 days', '2 weeks', '1 month', 'ongoing', 'seven days')
    into an integer number of days.
    """
    if not duration_str:
        return 7  # Standard default acute prescription duration
    s = str(duration_str).lower().strip()

    # Ongoing / chronic maintenance keywords
    if any(k in s for k in ("ongoing", "continue", "continuous", "regular", "chronic", "daily", "long term", "lifetime")):
        return 365
    if any(k in s for k in ("sos", "as needed", "prn")):
        return 30

    m_days = re.search(r"(\d+)\s*(?:days?|d\b)", s)
    if m_days:
        return int(m_days.group(1))

    m_weeks = re.search(r"(\d+)\s*(?:weeks?|w\b)", s)
    if m_weeks:
        return int(m_weeks.group(1)) * 7

    m_months = re.search(r"(\d+)\s*(?:months?|m\b)", s)
    if m_months:
        return int(m_months.group(1)) * 30

    # Words like 'seven days', 'three days', 'five days', 'ten days'
    m_word_days = re.search(r"([a-z]+)\s+days?", s)
    if m_word_days and m_word_days.group(1) in WORD_TO_NUM:
        return WORD_TO_NUM[m_word_days.group(1)]

    m_num = re.search(r"^\s*(\d+)\s*$", s)
    if m_num:
        return int(m_num.group(1))

    return 7
