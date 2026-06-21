"""
LinkedIn Warrior — FastAPI Backend
Runs in Google Cloud Shell on port 8080.
Requires: GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT for Vertex AI.
"""

import json
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents.gemini_client import call_agent_text, generate_image
from agents.prompts import (
    ANALYZE_PROFILE_HARNESS,
    ANALYZE_PROFILE_SCHEMA,
    build_analyze_profile_task,
    build_content_plan_task,
    build_extract_profile_task,
    build_gdg_badge_prompt_task,
    build_headshot_prompt_task,
    CONTENT_PLAN_HARNESS,
    CONTENT_PLAN_SCHEMA,
    EXTRACT_PROFILE_HARNESS,
    EXTRACT_PROFILE_SCHEMA,
    IMAGE_PROMPT_HARNESS,
)

def get_cors_origins() -> list[str]:
    """CORS_ORIGINS=comma,separated,urls — defaults to * for demo/hackathon use."""
    raw = os.environ.get("CORS_ORIGINS", "*").strip()
    if not raw or raw == "*":
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(title="LinkedIn Warrior API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)


def clean_json(raw: str) -> dict:
    """Strip markdown fences and parse JSON safely."""
    clean = raw.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[-1]
    if clean.endswith("```"):
        clean = clean.rsplit("```", 1)[0]
    return json.loads(clean.strip())


# ── Health ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {
        "status": "ok",
        "gemini_key_set": bool(os.environ.get("GEMINI_API_KEY")),
        "vertex_project": os.environ.get("GOOGLE_CLOUD_PROJECT", ""),
        "text_model": "gemini-2.5-flash",
        "image_model": "gemini-2.5-flash-image",
        "event": "GDG Newport Beach · Google I/O Extended · June 20, 2026",
    }


# ── Agent 1: Profile Extraction ────────────────────────────────────────

class ExtractRequest(BaseModel):
    linkedin_url: str = ""
    linkedin_text: str = ""


@app.post("/api/extract-profile")
def extract_profile(req: ExtractRequest):
    """Agent 1 — Extract. Structures raw DOM text into typed ProfileData."""
    try:
        raw = call_agent_text(
            harness=EXTRACT_PROFILE_HARNESS,
            task=build_extract_profile_task(req.linkedin_url, req.linkedin_text),
            response_schema=EXTRACT_PROFILE_SCHEMA,
        )
        return clean_json(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Agent 2: LinkedIn Profile Analysis ─────────────────────────────────

class AnalyzeRequest(BaseModel):
    linkedin_url: str
    linkedin_text: str = ""


@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    """Agent 2 — Analysis. Reviews LinkedIn profile, returns scored JSON audit."""
    try:
        raw = call_agent_text(
            harness=ANALYZE_PROFILE_HARNESS,
            task=build_analyze_profile_task(req.linkedin_url, req.linkedin_text),
            response_schema=ANALYZE_PROFILE_SCHEMA,
        )
        return clean_json(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Agent 3: Content Plan ───────────────────────────────────────────────

class ContentRequest(BaseModel):
    linkedin_url: str
    linkedin_text: str = ""
    github_username: str = ""
    github_data: dict = {}


@app.post("/api/content-plan")
def content_plan(req: ContentRequest):
    """Agent 3 — Content Plan. Generates 10-post LinkedIn content plan."""
    try:
        raw = call_agent_text(
            harness=CONTENT_PLAN_HARNESS,
            task=build_content_plan_task(
                req.linkedin_url,
                req.linkedin_text,
                req.github_username,
                req.github_data,
            ),
            response_schema=CONTENT_PLAN_SCHEMA,
        )
        return clean_json(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Agent 4: Image Prompt Generator ────────────────────────────────────

class ImagePromptRequest(BaseModel):
    linkedin_text: str = ""
    name: str = ""
    role: str = ""
    style: str = "professional headshot"


@app.post("/api/image-prompt")
def image_prompt(req: ImagePromptRequest):
    """Agent 4 — Image Prompt. Engineers prompts for Nano Banana."""
    try:
        if req.style == "gdg-badge":
            task = build_gdg_badge_prompt_task(req.name)
        else:
            task = build_headshot_prompt_task(req.name, req.role, req.linkedin_text, req.style)

        result = call_agent_text(harness=IMAGE_PROMPT_HARNESS, task=task, temperature=0.8)
        return {"prompt": result.strip(), "style": req.style}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Agent 4b: Direct Image Generation (Nano Banana) ────────────────────

class GenerateImageRequest(BaseModel):
    prompt: str


@app.post("/api/generate-image")
def generate_image_endpoint(req: GenerateImageRequest):
    """Generate an image directly via gemini-2.5-flash-image (Nano Banana)."""
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="prompt is required")
    try:
        return generate_image(req.prompt.strip())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Run ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    from pathlib import Path

    import uvicorn

    backend_dir = Path(__file__).resolve().parent
    os.chdir(backend_dir)
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    port = int(os.environ.get("PORT", 8080))
    is_production = os.environ.get("ENV", "development").lower() == "production"

    print(f"\n{'='*50}")
    print("  LinkedIn Warrior API")
    print(f"  Port: {port}")
    print(f"  Environment: {'production' if is_production else 'development'}")
    print(f"  Gemini key set: {bool(os.environ.get('GEMINI_API_KEY'))}")
    print(f"  Vertex project: {os.environ.get('GOOGLE_CLOUD_PROJECT', '(none — using AI Studio key)')}")
    print(f"{'='*50}\n")
    if not os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_CLOUD_PROJECT"):
        print("⚠️  WARNING: Set GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT")
        print("   AI Studio: export GEMINI_API_KEY=your_key_from_aistudio.google.com\n")

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=not is_production,
    )
