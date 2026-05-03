"""
vision.py – CD identification from photos.

Supports two vision backends:
  • anthropic – Anthropic Claude models (claude-3-5-sonnet, claude-opus-4, …)
  • ollama    – Self-hosted Ollama models (llava, gemma3, moondream, …)

Usage
-----
from vision import identify_cds_from_image

albums = identify_cds_from_image(
    image_bytes,
    backend="anthropic",          # or "ollama"
    model="claude-opus-4-5",      # model name for the chosen backend
    # ollama_url="http://localhost:11434",  # only for ollama backend
)
# → [{"artist": "Pink Floyd", "album": "The Wall"}, …]
"""

from __future__ import annotations

import base64
import json
import os
from io import BytesIO
from typing import Literal

from PIL import Image

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

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

_BACKENDS = ("anthropic", "ollama")

# Recommended vision-capable models for each backend
ANTHROPIC_MODELS = [
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "claude-haiku-4-5",
    "claude-3-5-sonnet-20241022",
    "claude-3-opus-20240229",
]

OLLAMA_MODELS = [
    "llava",
    "llava:13b",
    "llava:34b",
    "llava-llama3",
    "bakllava",
    "moondream",
    "gemma3",   # Gemma 3 (2025) – vision-capable
    "gemma2",
    "minicpm-v",
]


def _to_jpeg_b64(image_bytes: bytes) -> str:
    """Convert image bytes to a JPEG base64 string."""
    img = Image.open(BytesIO(image_bytes))
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences without regex on user-controlled input."""
    text = text.strip()
    # Check for opening fence: ```json or ```
    if text.startswith("```"):
        lines = text.splitlines()
        # Drop the opening ``` / ```json line
        lines = lines[1:]
        # Drop the closing ``` line if present
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def _parse_albums(text: str) -> list[dict]:
    """Parse a JSON array of {artist, album} dicts from raw text."""
    text = _strip_code_fences(text)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            f"Could not parse model response as JSON.\nRaw: {text[:500]}"
        ) from exc

    if not isinstance(data, list):
        raise RuntimeError("Model returned unexpected structure (expected a JSON array).")

    return [
        {
            "artist": str(item.get("artist", "")).strip(),
            "album": str(item.get("album", "")).strip(),
        }
        for item in data
        if isinstance(item, dict)
    ]


# ---------------------------------------------------------------------------
# Anthropic backend
# ---------------------------------------------------------------------------


def _identify_via_anthropic(image_bytes: bytes, model: str) -> list[dict]:
    """Use an Anthropic Claude model to identify CDs."""
    try:
        import anthropic
    except ImportError as exc:
        raise RuntimeError(
            "The 'anthropic' package is not installed. Run: pip install anthropic"
        ) from exc

    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY is not set.")

    b64 = _to_jpeg_b64(image_bytes)
    client = anthropic.Anthropic(api_key=api_key)

    try:
        message = client.messages.create(
            model=model,
            max_tokens=2048,
            system=_SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": b64,
                            },
                        },
                        {"type": "text", "text": _USER_PROMPT},
                    ],
                }
            ],
        )
    except Exception as exc:
        raise RuntimeError(f"Anthropic API error: {exc}") from exc

    raw = message.content[0].text if message.content else ""
    return _parse_albums(raw)


# ---------------------------------------------------------------------------
# Ollama backend
# ---------------------------------------------------------------------------


def _identify_via_ollama(
    image_bytes: bytes, model: str, ollama_url: str
) -> list[dict]:
    """Use a local Ollama vision model to identify CDs."""
    import requests

    b64 = _to_jpeg_b64(image_bytes)
    prompt = f"{_SYSTEM_PROMPT}\n\n{_USER_PROMPT}"

    # Use the /api/chat endpoint (supports images in messages)
    payload = {
        "model": model,
        "stream": False,
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [b64],
            }
        ],
    }

    try:
        resp = requests.post(
            f"{ollama_url.rstrip('/')}/api/chat",
            json=payload,
            timeout=120,
        )
        resp.raise_for_status()
    except requests.exceptions.ConnectionError as exc:
        raise RuntimeError(
            f"Cannot connect to Ollama at {ollama_url}. "
            "Make sure Ollama is running (`ollama serve`)."
        ) from exc
    except requests.exceptions.HTTPError as exc:
        raise RuntimeError(f"Ollama HTTP error: {exc}") from exc
    except Exception as exc:
        raise RuntimeError(f"Ollama request failed: {exc}") from exc

    data = resp.json()
    raw = data.get("message", {}).get("content", "")
    if not raw:
        raw = data.get("response", "")

    return _parse_albums(raw)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def identify_cds_from_image(
    image_bytes: bytes,
    backend: Literal["anthropic", "ollama"] = "anthropic",
    model: str | None = None,
    ollama_url: str = "http://localhost:11434",
) -> list[dict]:
    """
    Identify all CDs visible in *image_bytes*.

    Parameters
    ----------
    image_bytes : bytes
        Raw image data (JPEG / PNG / WebP).
    backend : "anthropic" | "ollama"
        Which vision backend to use.
    model : str, optional
        Model name for the chosen backend.
        Defaults: ``claude-opus-4-5`` (Anthropic), ``llava`` (Ollama).
    ollama_url : str
        Base URL of the Ollama server (only used when backend="ollama").

    Returns
    -------
    list[dict]
        List of ``{"artist": str, "album": str}`` dicts.
    """
    if backend not in _BACKENDS:
        raise ValueError(f"backend must be one of {_BACKENDS}, got {backend!r}")

    if backend == "anthropic":
        return _identify_via_anthropic(image_bytes, model or ANTHROPIC_MODELS[0])
    else:
        return _identify_via_ollama(image_bytes, model or OLLAMA_MODELS[0], ollama_url)
