"""
vision.py – OpenAI GPT-4o vision module for identifying CDs from photos.
"""

from __future__ import annotations

import base64
import json
import os
import re
from io import BytesIO

from openai import OpenAI
from PIL import Image

_SYSTEM_PROMPT = (
    "You are an expert music archivist. "
    "Your task is to identify CD albums visible in a photo. "
    "Look carefully at spine labels, cover art, and any visible text. "
    "Return ONLY a valid JSON array – no markdown, no extra text. "
    "Each element must have exactly two string keys: 'artist' and 'album'. "
    "If nothing is recognisable return an empty array []."
)

_USER_PROMPT = (
    "Please identify every CD visible in this image. "
    "Extract the artist name and album title for each one. "
    "Return the result as a raw JSON array: "
    '[{"artist": "...", "album": "..."}, ...]. '
    "Output ONLY the JSON – no explanations."
)


def _encode_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> tuple[str, str]:
    """Return (base64_string, mime_type), converting to JPEG if needed."""
    try:
        img = Image.open(BytesIO(image_bytes))
        # Convert palette / RGBA images before JPEG encode
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=90)
        return base64.b64encode(buf.getvalue()).decode("utf-8"), "image/jpeg"
    except Exception:
        # Fall back to raw encoding
        return base64.b64encode(image_bytes).decode("utf-8"), mime_type


def _clean_json(text: str) -> str:
    """Strip markdown code fences and leading/trailing whitespace."""
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ``` fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def identify_cds_from_image(image_bytes: bytes) -> list[dict]:
    """
    Send the image to GPT-4o and return a list of identified CDs.

    Returns a list of dicts: [{"artist": str, "album": str}, ...]
    Raises ValueError if the API key is not configured.
    Raises RuntimeError on API or parsing errors.
    """
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY is not set.")

    client = OpenAI(api_key=api_key)

    b64, mime = _encode_image(image_bytes)

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": _USER_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{b64}", "detail": "high"},
                        },
                    ],
                },
            ],
            max_tokens=2048,
        )
    except Exception as exc:
        raise RuntimeError(f"OpenAI API error: {exc}") from exc

    raw = response.choices[0].message.content or ""
    cleaned = _clean_json(raw)

    try:
        albums = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Could not parse GPT-4o response as JSON.\n"
            f"Raw response: {raw[:500]}"
        ) from exc

    if not isinstance(albums, list):
        raise RuntimeError("GPT-4o returned unexpected structure (expected a JSON array).")

    # Normalise: ensure each entry has 'artist' and 'album' keys
    normalised = []
    for item in albums:
        if isinstance(item, dict):
            normalised.append(
                {
                    "artist": str(item.get("artist", "")).strip(),
                    "album": str(item.get("album", "")).strip(),
                }
            )

    return normalised
