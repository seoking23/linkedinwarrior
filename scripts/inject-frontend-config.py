#!/usr/bin/env python3
"""
inject-frontend-config.py — Safely inject build-time config into frontend/index.html.

Used by GitHub Actions before Pages deploy. Escapes values for JavaScript strings.
"""

import json
import os
import sys
from pathlib import Path

INJECT_MARKER = "<!-- BUILD_CONFIG_INJECT -->"
INDEX_PATH = Path(__file__).resolve().parent.parent / "frontend" / "index.html"


def build_config_script() -> str:
    gemini_key = (
        os.environ.get("GEMINI_KEY", "").strip()
        or os.environ.get("GEMINI_API_KEY", "").strip()
    )
    api_base = os.environ.get("API_BASE", "").strip().rstrip("/")

    parts = []
    if gemini_key:
        parts.append(f"window._GEMINI_KEY={json.dumps(gemini_key)};")
    if api_base:
        parts.append(f"window._API_BASE={json.dumps(api_base)};")

    if not parts:
        return ""

    return f"<script>{''.join(parts)}</script>"


def inject_config(index_html: str, config_script: str) -> str:
    if not config_script:
        return index_html

    if INJECT_MARKER in index_html:
        return index_html.replace(INJECT_MARKER, config_script, 1)

    return index_html.replace("</head>", f"{config_script}\n</head>", 1)


def main() -> int:
    if not INDEX_PATH.is_file():
        print(f"inject-frontend-config.py: index not found at {INDEX_PATH}", file=sys.stderr)
        return 1

    config_script = build_config_script()
    html = INDEX_PATH.read_text(encoding="utf-8")
    INDEX_PATH.write_text(inject_config(html, config_script), encoding="utf-8")

    has_key = bool(os.environ.get("GEMINI_KEY", "").strip())
    has_base = bool(os.environ.get("API_BASE", "").strip())
    print(f"inject-frontend-config.py: injected gemini_key={has_key} api_base={has_base}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
