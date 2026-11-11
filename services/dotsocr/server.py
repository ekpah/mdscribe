"""HTTP response types and image validation for the dots.mocr service."""

import io

import numpy as np
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_IMAGE_PIXELS = 50_000_000
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


class OcrItem(BaseModel):
    text: str
    bbox: list[float] = Field(min_length=4, max_length=4)
    confidence: float = Field(ge=0.0, le=1.0)
    polygon: list[list[float]] | None = None


class OcrResponse(BaseModel):
    text: str
    results: list[OcrItem]


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
