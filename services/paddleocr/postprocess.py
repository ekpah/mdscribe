"""Plain-text cleanup of PaddleOCR-VL Markdown for clinical documents.

Dependency-free so it can be unit-tested without Paddle, Modal or a GPU.
"""

import re

_SYMBOLS = {
    "mu": "µ", "alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ", "Delta": "Δ",
    "lambda": "λ", "sigma": "σ", "kappa": "κ", "omega": "ω", "Omega": "Ω", "pi": "π",
    "times": "×", "cdot": "·", "pm": "±", "le": "≤", "leq": "≤", "ge": "≥", "geq": "≥",
    "approx": "≈", "neq": "≠", "ne": "≠", "sim": "~", "circ": "°", "degree": "°",
    "to": "→", "rightarrow": "→", "leftarrow": "←", "uparrow": "↑", "downarrow": "↓",
    "infty": "∞", "ldots": "…", "dots": "…", "cdots": "…", "%": "%", "&": "&", "_": "_",
    "#": "#", "$": "$", "{": "{", "}": "}", ",": " ", ";": " ", ":": " ", "!": "",
    " ": " ", "quad": " ", "qquad": " ", "left": "", "right": "", "displaystyle": "",
}
_SUP = str.maketrans("0123456789+-=()n°", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿ°")
_SUB = str.maketrans("0123456789+-=()", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎")
_SUP_CHARS = set("0123456789+-=()n°")
_SUB_CHARS = set("0123456789+-=()")

_TEXT_CMD = re.compile(
    r"\\(?:text|mathrm|mathbf|mathit|textbf|textit|operatorname|mbox|rm)\s*\{([^{}]*)\}"
)
_FRAC = re.compile(r"\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}")
_SQRT = re.compile(r"\\sqrt\s*\{([^{}]*)\}")
_CMD = re.compile(r"\\([a-zA-Z]+|[%&_#${},;:! ])")
_SCRIPT = re.compile(r"([\^_])\s*(\{[^{}]*\}|\\?[^\s{}\\])")
_MATH = re.compile(r"\$\$(.+?)\$\$|\$([^$\n]{1,200}?)\$", re.S)
_IMAGE = re.compile(r"<div[^>]*>\s*<img[^>]*>\s*</div>\s*|<img[^>]*>")


def _script(match: re.Match) -> str:
    kind, body = match.group(1), match.group(2).strip("{}").strip()
    chars, table = (_SUP_CHARS, _SUP) if kind == "^" else (_SUB_CHARS, _SUB)
    return body.translate(table) if body and set(body) <= chars else body


def _math_to_text(math: str) -> str:
    # The VLM doubles braces in scripts, e.g. `O^{{2}}`.
    math = re.sub(r"\{\{([^{}]*)\}\}", r"{\1}", math)
    for _ in range(3):  # nested \text inside \frac etc.
        math = _TEXT_CMD.sub(r"\1", math)
        math = _FRAC.sub(r"\1/\2", math)
        math = _SQRT.sub(r"√\1", math)
    math = _CMD.sub(lambda m: _SYMBOLS.get(m.group(1), m.group(1)), math)
    math = _SCRIPT.sub(_script, math)
    math = math.replace("{", "").replace("}", "")
    return re.sub(r"[ \t]{2,}", " ", math).strip()


def latex_to_text(markdown: str) -> str:
    """Rewrites the VLM's inline/display LaTeX as plain Unicode text.

    Clinical documents contain units and indices (µg, m², SpO₂, ±), not real
    formulas, so `$ O^{{2}} $` or `100 \\mu g` must read as `O²` and `100 µg`.
    """

    def math(match: re.Match) -> str:
        body = match.group(1) or match.group(2)
        # Leave ordinary dollar signs alone; only LaTeX markup is math.
        return _math_to_text(body) if re.search(r"[\\^_{]", body) else match.group(0)

    text = _MATH.sub(math, markdown)
    # Table cells carry literal "\n" line breaks ("Name, Vorname\nBerger");
    # keep them as breaks instead of reading "\nBerger" as a LaTeX command.
    text = text.replace("\\n", "<br>")
    # The VLM also emits bare commands such as `100 \mu g` without delimiters.
    text = re.sub(
        r"\\(?:[a-zA-Z]+(?:\s*\{[^{}]*\})*|[%&_#,;!])",
        lambda m: _math_to_text(m.group(0)),
        text,
    )
    # "\mu g" is a unit (µg), never µ followed by a separate word.
    text = re.sub(r"µ (?=[a-zA-Z]{1,2}\b)", "µ", text)
    # The pipeline pads math with spaces: "ml/ m²", "cm ⁻⁵" -> "ml/m²", "cm⁻⁵".
    text = re.sub(r"[ \t]+(?=[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻₀₁₂₃₄₅₆₇₈₉])", "", text)
    return re.sub(r"(?<=/)[ \t]+(?=[a-zA-Zµ]{1,3}[⁰¹²³⁴⁵⁶⁷⁸⁹⁻])", "", text)


# A pressure reading "sys/dia (mean)" whose slash the VLM read as "1" or "|",
# e.g. "52.126 (36)" or "143169 (90)" for handwritten 52/26 (36) and 143/69 (90).
# The opening parenthesis is sometimes read as a slash too: "743/69/90"; dots.mocr
# also keeps a gap from the slash stroke: "52 126 (36)" (one space at most).
_READING = re.compile(
    r"(?<![\d/.,])(\d[\d.,|lI/]{0,6}(?: [\d.,|lI/]{1,6})?\d)\s*"
    r"(?:\(\s*(\d{1,3})\s*\)|/(\d{2,3})(?![\d/.,]))"
)


def _possible(systolic: str, diastolic: str, mean: int) -> bool:
    if not systolic or not diastolic or systolic[0] == "0" or diastolic[0] == "0":
        return False
    return int(diastolic) < mean < int(systolic) <= 300


def _plausible(systolic: str, diastolic: str, mean: int) -> bool:
    high, low = (int(systolic), int(diastolic)) if _possible(systolic, diastolic, mean) else (0, 0)
    return bool(high) and abs(mean - (high + 2 * low) / 3) <= max(5, 0.1 * mean)


def _split(raw: str, i: int) -> tuple[str, str]:
    return re.sub(r"\D", "", raw[:i]), re.sub(r"\D", "", raw[i + 1 :])


def _one_for_seven(pairs: set[tuple[str, str]]) -> set[tuple[str, str]]:
    # A handwritten 1 with an upstroke reads as 7, an impossible systolic above 300.
    return {("1" + high[1:], low) for high, low in pairs if high.startswith("7") and len(high) == 3}


def _repair_reading(match: re.Match) -> str:
    raw, mean = match.group(1), int(match.group(2) or match.group(3))
    if raw.count("/") > 1:
        return match.group(0)  # several slashes: no single reading to restore
    # A drawn stroke is the slash whenever the reading is possible at all; the
    # mean formula does not hold for every chamber (RV 49/12 (19)).
    strokes = {_split(raw, i) for i, char in enumerate(raw) if char in "/|lI"}
    valid = [pair for pair in strokes if _possible(*pair, mean)]
    if not valid:
        # A gap or a "1" may stand in for the slash, but then the reading must
        # match the mean formula. "." and "," are decimal marks, never the slash.
        digits = re.sub(r"\D", "", raw)
        ones = {
            (digits[:i], digits[i + 1 :])
            for i, char in enumerate(digits)
            # Skip if the "1" may be a real digit: "4912 (19)" is 49/12 or 49/2.
            if char == "1"
            and not _possible(digits[: i + 1], digits[i + 1 :], mean)
            and not _possible(digits[:i], digits[i:], mean)
        }
        gaps = {_split(raw, i) for i, char in enumerate(raw) if char == " "}
        candidates = ones | gaps | strokes
        candidates |= _one_for_seven(candidates)
        valid = [pair for pair in candidates if _plausible(*pair, mean)]
    if len(valid) != 1:
        return match.group(0)
    systolic, diastolic = valid[0]
    return f"{systolic}/{diastolic} ({mean})"


def repair_pressure_readings(text: str) -> str:
    """Restores the slash in "sys/dia (mean)" only when exactly one split is
    hemodynamically consistent: dia < mean < sys and mean ≈ (sys + 2·dia) / 3."""
    return _READING.sub(_repair_reading, text)


def clean_markdown(markdown: str) -> str:
    # Figure crops (signatures, logos) are not returned, so their tags dangle.
    return repair_pressure_readings(latex_to_text(_IMAGE.sub("", markdown)))
