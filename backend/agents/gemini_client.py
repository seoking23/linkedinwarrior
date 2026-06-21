"""
Gemini client — google-genai SDK with harness/task separation.

Supports AI Studio (GEMINI_API_KEY) or Vertex AI (GOOGLE_CLOUD_PROJECT).
Text agents: gemini-2.5-flash with system_instruction + response_schema.
Image agent: gemini-2.5-flash-image (Nano Banana) with response_modalities.
"""

import base64
import os

from fastapi import HTTPException
from google import genai
from google.genai import types

TEXT_MODEL = "gemini-2.5-flash"
IMAGE_MODEL = "gemini-2.5-flash-image"

_client: genai.Client | None = None


def get_gemini_client() -> genai.Client:
    """Lazy-init client — Vertex AI in Cloud Shell, AI Studio key elsewhere."""
    global _client
    if _client is not None:
        return _client

    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
    api_key = os.environ.get("GEMINI_API_KEY", "")

    if project_id:
        _client = genai.Client(vertexai=True, project=project_id, location="us-central1")
    elif api_key:
        _client = genai.Client(api_key=api_key)
    else:
        raise HTTPException(
            status_code=500,
            detail="No Gemini credentials. Set GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT.",
        )
    return _client


def call_agent_text(
    harness: str,
    task: str,
    response_schema=None,
    temperature: float = 0.7,
    max_output_tokens: int = 8192,
) -> str:
    """
    Run a text agent: harness → system_instruction, task → user contents.
    When response_schema is set, returns validated JSON text.
    """
    client = get_gemini_client()

    config_kwargs: dict = {
        "system_instruction": harness,
        "temperature": temperature,
        "max_output_tokens": max_output_tokens,
    }
    if response_schema is not None:
        config_kwargs["response_mime_type"] = "application/json"
        config_kwargs["response_schema"] = response_schema

    response = client.models.generate_content(
        model=TEXT_MODEL,
        contents=task,
        config=types.GenerateContentConfig(**config_kwargs),
    )

    if not response.text:
        raise HTTPException(status_code=500, detail="gemini_client.py: empty text response from Gemini")
    return response.text


def generate_image(prompt: str) -> dict:
    """
    Generate an image with Nano Banana (gemini-2.5-flash-image).
    Returns {text, image_base64, mime_type} — image fields null if model returns text only.
    """
    client = get_gemini_client()

    response = client.models.generate_content(
        model=IMAGE_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
        ),
    )

    result = {"text": None, "image_base64": None, "mime_type": None}

    for part in response.parts:
        if part.text:
            result["text"] = part.text
        elif part.inline_data is not None:
            result["image_base64"] = base64.b64encode(part.inline_data.data).decode("ascii")
            result["mime_type"] = part.inline_data.mime_type or "image/png"

    if not result["text"] and not result["image_base64"]:
        raise HTTPException(status_code=500, detail="gemini_client.py: no text or image in Gemini response")

    return result
