"""
settings.py – Persistent settings management for Discify.

Stores API keys and configuration in settings.json (gitignored).
Falls back to environment variables for Docker/server deployments.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

_SETTINGS_FILE = Path(__file__).parent / "settings.json"

_DEFAULTS: dict = {
    "vision_backend": "anthropic",
    "anthropic_model": "claude-sonnet-4-6",
    "ollama_model": "llava",
    "ollama_url": "http://localhost:11434",
    "anthropic_api_key": "",
}


def load() -> dict:
    """Load settings, merging file > env vars > defaults."""
    settings = dict(_DEFAULTS)

    if _SETTINGS_FILE.exists() and _SETTINGS_FILE.is_file():
        try:
            file_data = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
            settings.update({k: v for k, v in file_data.items() if k in _DEFAULTS})
        except Exception:
            pass

    if os.getenv("ANTHROPIC_API_KEY"):
        settings["anthropic_api_key"] = os.environ["ANTHROPIC_API_KEY"]
    if os.getenv("OLLAMA_URL"):
        settings["ollama_url"] = os.environ["OLLAMA_URL"]

    return settings


def save(data: dict) -> None:
    """Persist settings to settings.json. Only saves known keys."""
    current = load()
    for key in _DEFAULTS:
        if key in data:
            current[key] = data[key]

    if current.get("anthropic_api_key"):
        os.environ["ANTHROPIC_API_KEY"] = current["anthropic_api_key"]
    if current.get("ollama_url"):
        os.environ["OLLAMA_URL"] = current["ollama_url"]

    _SETTINGS_FILE.write_text(
        json.dumps(current, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def apply_to_env() -> None:
    """Apply saved settings to os.environ (call at startup)."""
    s = load()
    if s.get("anthropic_api_key"):
        os.environ["ANTHROPIC_API_KEY"] = s["anthropic_api_key"]
    if s.get("ollama_url"):
        os.environ["OLLAMA_URL"] = s["ollama_url"]


def get_safe() -> dict:
    """Return settings with secrets masked for API responses."""
    s = load()
    return {
        **s,
        "anthropic_api_key": "***" if s.get("anthropic_api_key") else "",
        "anthropic_api_key_set": bool(s.get("anthropic_api_key")),
    }
