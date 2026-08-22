from __future__ import annotations

import asyncio
import io
import logging
import math
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, Iterable

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

LOGGER = logging.getLogger("paddleocr-service")

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_IMAGE_PIXELS = 50_000_000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

_pipeline: Any | None = None
_inference_lock = asyncio.Lock()


class OcrItem(BaseModel):
    text: str
    bbox: list[float] = Field(min_length=4, max_length=4)
    confidence: float = Field(ge=0.0, le=1.0)
    polygon: list[list[float]] | None = None


class OcrResponse(BaseModel):
    results: list[OcrItem]


class StatusResponse(BaseModel):
    status: str


def _create_pipeline() -> Any:
    # Importing PaddleOCR loads the native inference runtime, so keep it out of
    # module import paths used by lightweight contract tests.
    from paddleocr import PaddleOCR

    return PaddleOCR(
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=True,
    )


def _to_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return []


def _result_payload(result: Any) -> Any:
    if isinstance(result, dict):
        return result.get("res", result)

    json_value = getattr(result, "json", None)
    if callable(json_value):
        json_value = json_value()
    if isinstance(json_value, dict):
        return json_value.get("res", json_value)

    return result


def _field(payload: Any, name: str, fallback: str | None = None) -> list[Any]:
    if isinstance(payload, dict):
        value = payload.get(name)
        if value is None and fallback is not None:
            value = payload.get(fallback)
    else:
        value = getattr(payload, name, None)
        if value is None and fallback is not None:
            value = getattr(payload, fallback, None)
    return _to_list(value)


def _finite_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _polygon(value: Any, width: int, height: int) -> list[list[float]] | None:
    points = _to_list(value)
    if len(points) != 4:
        return None

    normalized: list[list[float]] = []
    for point in points:
        coordinates = _to_list(point)
        if len(coordinates) != 2:
            return None
        x = _finite_number(coordinates[0])
        y = _finite_number(coordinates[1])
        if x is None or y is None:
            return None
        normalized.append(
            [min(max(x, 0.0), float(width)), min(max(y, 0.0), float(height))]
        )
    return normalized


def _bbox(
    box_value: Any,
    polygon: list[list[float]] | None,
    width: int,
    height: int,
) -> list[float] | None:
    if polygon is not None:
        xs = [point[0] for point in polygon]
        ys = [point[1] for point in polygon]
        coordinates = [min(xs), min(ys), max(xs), max(ys)]
    else:
        raw_box = _to_list(box_value)
        if len(raw_box) != 4:
            return None
        parsed = [_finite_number(value) for value in raw_box]
        if any(value is None for value in parsed):
            return None
        coordinates = [float(value) for value in parsed if value is not None]

    x1 = min(max(coordinates[0], 0.0), float(width))
    y1 = min(max(coordinates[1], 0.0), float(height))
    x2 = min(max(coordinates[2], 0.0), float(width))
    y2 = min(max(coordinates[3], 0.0), float(height))
    if x2 <= x1 or y2 <= y1:
        return None
    return [x1, y1, x2, y2]


def format_results(
    predictions: Iterable[Any], width: int, height: int
) -> list[OcrItem]:
    first_result = next(iter(predictions), None)
    if first_result is None:
        return []

    payload = _result_payload(first_result)
    texts = _field(payload, "rec_texts")
    scores = _field(payload, "rec_scores")
    boxes = _field(payload, "rec_boxes")
    polygons = _field(payload, "rec_polys", "dt_polys")

    formatted: list[OcrItem] = []
    for index, raw_text in enumerate(texts):
        text = str(raw_text).strip()
        if not text:
            continue

        polygon = (
            _polygon(polygons[index], width, height)
            if index < len(polygons)
            else None
        )
        bbox = _bbox(
            boxes[index] if index < len(boxes) else None,
            polygon,
            width,
            height,
        )
        if bbox is None:
            LOGGER.warning("Skipping OCR item without a valid bounding box")
            continue

        raw_score = scores[index] if index < len(scores) else 1.0
        confidence = _finite_number(raw_score)
        if confidence is None:
            confidence = 0.0

        formatted.append(
            OcrItem(
                text=text,
                bbox=bbox,
                confidence=min(max(confidence, 0.0), 1.0),
                polygon=polygon,
            )
        )

    return formatted


def _decode_image(image_data: bytes) -> np.ndarray:
    try:
        with Image.open(io.BytesIO(image_data)) as source:
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise HTTPException(
                    status_code=413,
                    detail=f"The image exceeds the {MAX_IMAGE_PIXELS} pixel limit",
                )
            source.load()
            image = source.convert("RGB")
    except Image.DecompressionBombError as error:
        raise HTTPException(
            status_code=413,
            detail=f"The image exceeds the {MAX_IMAGE_PIXELS} pixel limit",
        ) from error
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=400, detail="The upload is not a valid image") from error

    return np.asarray(image)


def _predict(pipeline: Any, image: np.ndarray) -> list[Any]:
    return list(pipeline.predict(image))


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    global _pipeline

    LOGGER.info("Loading PP-OCRv6 medium models on CPU")
    _pipeline = await asyncio.to_thread(_create_pipeline)
    LOGGER.info("PP-OCRv6 is ready")
    try:
        yield
    finally:
        _pipeline = None


app = FastAPI(
    title="MDScribe PaddleOCR service",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    lifespan=lifespan,
)


@app.exception_handler(HTTPException)
async def http_error(_: Request, error: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content={"error": str(error.detail)})


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, error: RequestValidationError) -> JSONResponse:
    LOGGER.info("Invalid OCR request: %s", error)
    return JSONResponse(status_code=400, content={"error": "Invalid OCR request"})


@app.get("/health", response_model=StatusResponse)
async def health() -> StatusResponse:
    if _pipeline is None:
        raise HTTPException(status_code=503, detail="OCR model is still loading")
    return StatusResponse(status="healthy")


@app.post("/ocr", response_model=OcrResponse)
async def ocr(
    file: UploadFile = File(...),
    language: str = Form(default="en"),
) -> OcrResponse:
    # PP-OCRv6 uses one unified recognition model for its supported languages.
    # The field remains part of the endpoint because LiteParse always sends it.
    del language

    image_data = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.close()
    if not image_data:
        raise HTTPException(status_code=400, detail="The uploaded image is empty")
    if len(image_data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"The uploaded image exceeds {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
        )

    image = _decode_image(image_data)
    height, width = image.shape[:2]

    try:
        if _pipeline is None:
            raise HTTPException(status_code=503, detail="OCR model is still loading")
        # Paddle's predictor is kept single-threaded inside one container. Scale
        # with additional containers if parallel OCR throughput is required.
        async with _inference_lock:
            predictions = await asyncio.to_thread(_predict, _pipeline, image)
    except HTTPException:
        raise
    except Exception as error:
        LOGGER.exception("PaddleOCR inference failed")
        raise HTTPException(status_code=500, detail="OCR processing failed") from error

    return OcrResponse(results=format_results(predictions, width, height))
