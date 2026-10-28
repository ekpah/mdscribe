"""dots.mocr layout JSON -> the `POST /ocr` contract. Dependency-free for unit tests."""

import json
import math
import re

# dots.mocr's own limit; larger inputs only cost time on clinical pages.
MAX_PIXELS = 11_289_600
# Qwen2-VL vision patches (14 px, merged 2x2): sizes on this grid are not resized
# again by the processor, so returned boxes refer exactly to the sent image.
GRID = 28

PROMPT = """Please output the layout information from the PDF image, including each layout element's bbox, its category, and the corresponding text content within the bbox.

1. Bbox format: [x1, y1, x2, y2]

2. Layout Categories: The possible categories are ['Caption', 'Footnote', 'Formula', 'List-item', 'Page-footer', 'Page-header', 'Picture', 'Section-header', 'Table', 'Text', 'Title'].

3. Text Extraction & Formatting Rules:
    - Picture: For the 'Picture' category, the text field should be omitted.
    - Formula: Format its text as LaTeX.
    - Table: Format its text as HTML.
    - All Others (Text, Title, etc.): Format their text as Markdown.

4. Constraints:
    - The output text must be the original text from the image, with no translation.
    - All layout elements must be sorted according to human reading order.

5. Final Output: The entire output must be a single JSON object.
"""


def fit_to_grid(width: int, height: int) -> tuple[int, int]:
    """Size on the 28-px grid within MAX_PIXELS, keeping the aspect ratio."""
    scale = min(1.0, math.sqrt(MAX_PIXELS / (width * height)))
    fit = lambda side: max(GRID, math.floor(side * scale / GRID) * GRID)  # noqa: E731
    return fit(width), fit(height)


def parse_layout(raw: str, sent: tuple[int, int], original: tuple[int, int]) -> tuple[str, list[dict]]:
    """Returns (markdown, results) with boxes as XYXY pixels of the original image.

    Raises ValueError for truncated or malformed model output: a partial page
    must fail loudly instead of silently dropping table rows.
    """
    cells = json.loads(raw)
    if not isinstance(cells, list):
        raise ValueError("Layout output is not a list")
    sx, sy = original[0] / sent[0], original[1] / sent[1]
    texts, results = [], []
    for cell in cells:
        category, text = cell.get("category"), str(cell.get("text") or "").strip()
        if category == "Picture" or not text:
            continue
        texts.append(f"$$\n{text}\n$$" if category == "Formula" else text)
        x0, y0, x1, y1 = (float(v) for v in cell["bbox"])
        box = [
            min(max(x0 * sx, 0.0), original[0]),
            min(max(y0 * sy, 0.0), original[1]),
            min(max(x1 * sx, 0.0), original[0]),
            min(max(y1 * sy, 0.0), original[1]),
        ]
        if box[2] > box[0] and box[3] > box[1]:
            # Citation matching compares plain words, not table markup.
            plain = " ".join(re.sub(r"<[^>]+>", " ", text).split())
            # dots.mocr reports no confidence; the contract requires one.
            results.append({"bbox": box, "confidence": 1.0, "text": plain})
    return "\n\n".join(texts), results
