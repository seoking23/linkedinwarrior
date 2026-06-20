"""
LinkedIn Warrior — FastAPI Backend
Runs in Google Cloud Shell on port 8080.
Requires: GEMINI_API_KEY environment variable.
"""

import os
import json
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="LinkedIn Warrior API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.0-flash:generateContent"
)

GDG_EVENT_CONTEXT = """
Event: Google I/O Extended Lab: Workshop & Hackathon
Organizer: GDG Newport Beach
Date: June 20, 2026
Location: 2807 Villa Way, Newport Beach, CA 92663
Speakers:
  - Kartik Derasari (Google Developer Expert — Multi-Agentic Ecosystems using Google AI stack)
  - Abby Damodaran (Google — Multi-turn image generation Codelab)
  - Suvaditya Mukherjee (Google Developer Expert — Optimizing Gemma models on Vertex AI)
Tech themes: Vertex AI, Gemini, Agent Engine, ADK, Cloud Run, A2A, Gemma 4
Event URL: https://gdg.community.dev/events/details/google-gdg-newport-beach-presents-google-io-extended-lab-workshop-amp-hackathon/
"""


def call_gemini(prompt: str, system: str = "") -> str:
    """Route all agent calls through a single Gemini function."""
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set. Run: export GEMINI_API_KEY=your_key")

    contents = []
    if system:
        contents.append({"role": "user", "parts": [{"text": system}]})
        contents.append({"role": "model", "parts": [{"text": "Understood. I'll follow those instructions exactly."}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    resp = requests.post(
        f"{GEMINI_URL}?key={GEMINI_API_KEY}",
        headers={"Content-Type": "application/json"},
        json={
            "contents": contents,
            "generationConfig": {"temperature": 0.7, "maxOutputTokens": 4096},
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["candidates"][0]["content"]["parts"][0]["text"]


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
        "gemini_key_set": bool(GEMINI_API_KEY),
        "event": "GDG Newport Beach · Google I/O Extended · June 20, 2026",
    }


# ── Agent 1: LinkedIn Profile Analysis ─────────────────────────────────

class AnalyzeRequest(BaseModel):
    linkedin_url: str
    linkedin_text: str = ""

@app.post("/api/analyze")
def analyze(req: AnalyzeRequest):
    """Agent 2 — Analysis Agent. Reviews LinkedIn profile, returns scored JSON audit."""
    system = """You are a senior LinkedIn profile consultant specializing in personal branding
for software engineers and technical professionals. You have reviewed thousands of profiles
and know exactly what makes a profile get noticed by recruiters, collaborators, and clients.

Review the LinkedIn profile provided and return ONLY valid JSON — no markdown, no backticks — matching this schema:
{
  "overall_score": 74,
  "summary": "2-sentence overall assessment",
  "sections": {
    "headline":         {"score": 0, "feedback": "", "recommendations": []},
    "about":            {"score": 0, "feedback": "", "recommendations": []},
    "experience":       {"score": 0, "feedback": "", "recommendations": []},
    "skills":           {"score": 0, "feedback": "", "recommendations": []},
    "education":        {"score": 0, "feedback": "", "recommendations": []},
    "profile_photo":    {"score": 0, "feedback": "", "recommendations": []},
    "certifications":   {"score": 0, "feedback": "", "recommendations": []},
    "recommendations":  {"score": 0, "feedback": "", "recommendations": []},
    "activity":         {"score": 0, "feedback": "", "recommendations": []}
  },
  "top_strengths":    ["...", "...", "..."],
  "top_improvements": ["...", "...", "..."]
}

Be direct, specific, and constructive. Reference actual content from the profile.
Each recommendations array should have 2-3 specific, actionable items."""

    prompt = f"""LinkedIn URL: {req.linkedin_url}

Profile text:
{req.linkedin_text or "(No profile text provided — generate a realistic, plausible review based on the LinkedIn URL and username only. Make reasonable assumptions about a typical professional with this URL.)"}

Review this profile and return the JSON audit."""

    try:
        raw = call_gemini(prompt, system)
        return clean_json(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Agent 2: Content Plan ───────────────────────────────────────────────

class ContentRequest(BaseModel):
    linkedin_url: str
    linkedin_text: str = ""
    github_username: str = ""
    github_data: dict = {}

@app.post("/api/content-plan")
def content_plan(req: ContentRequest):
    """Agent 3 — Content Plan Agent. Generates 5-post LinkedIn content plan."""
    system = """You are a LinkedIn content strategist for technical professionals.
You write posts that are specific, authentic, and human — not corporate fluff.
Use real details from the profile: job titles, company names, project names, tech stacks.
Never be generic. Every post must feel like it could only be written by this specific person.

Return ONLY valid JSON — no markdown, no backticks — matching this schema:
{
  "plan_generated_at": "ISO timestamp",
  "source_data": ["linkedin"] or ["linkedin", "github"],
  "posts": [
    {
      "post_number": 1,
      "type": "event",
      "title": "Short title",
      "body": "Full post text, 150-300 words, ready to copy-paste to LinkedIn",
      "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5"],
      "suggested_post_day": "Today (June 20, 2026)",
      "suggested_post_time": "8:00 PM PDT",
      "character_count": 0
    }
  ]
}

Generate exactly 5 posts with types: event, project, story, insight, engagement (in that order).
Post 1 MUST be about attending the GDG Newport Beach Google I/O Extended Hackathon on June 20, 2026."""

    prompt = f"""LinkedIn URL: {req.linkedin_url}
Profile: {req.linkedin_text or "(use URL for context, make reasonable assumptions)"}
GitHub username: {req.github_username or "not provided"}
GitHub data: {json.dumps(req.github_data) if req.github_data else "none"}

GDG Event context (inject into Post 1):
{GDG_EVENT_CONTEXT}

Generate a 5-post LinkedIn content plan. Post 1 must specifically reference the GDG Newport Beach
hackathon, the speakers (Kartik Derasari, Abby Damodaran, Suvaditya Mukherjee), and the tech themes."""

    try:
        raw = call_gemini(prompt, system)
        return clean_json(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Agent 3: Image Prompt Generator ────────────────────────────────────

class ImagePromptRequest(BaseModel):
    linkedin_text: str = ""
    name: str = ""
    role: str = ""
    style: str = "professional headshot"

@app.post("/api/image-prompt")
def image_prompt(req: ImagePromptRequest):
    """Agent 4 — Image Generation Agent. Engineers prompts for Nano Banana Pro."""
    system = "You are an expert AI image prompt engineer. Return only the prompt text — no explanation, no preamble."

    if req.style == "gdg-badge":
        prompt = f"""Write a detailed image generation prompt for a GDG Newport Beach hackathon badge.

Participant name: {req.name or "the participant"}

Requirements:
- Clean modern digital achievement badge
- Circular badge design with Google brand colors (#4285F4 blue, #EA4335 red, #FBBC05 yellow, #34A853 green)
- Centered GDG logo mark aesthetic
- Text elements: "Google I/O Extended · Newport Beach · June 20 2026 · Hackathon Participant"
- Participant name: {req.name or ""}
- Gold accent ring border
- Flat design with subtle shadow
- Transparent or white background
- 1:1 square format, high resolution PNG
- Digital illustration style"""
    else:
        prompt = f"""Based on this LinkedIn profile:
Name: {req.name or "a professional"}
Role: {req.role or "software engineer"}
Profile text: {req.linkedin_text or "a skilled technical professional"}

Write a detailed image generation prompt for a: {req.style}

Requirements:
- Ultra-high-resolution 4K photorealistic portrait
- Professional LinkedIn profile photo aesthetic
- Soft studio lighting, clean light grey gradient background
- Shallow depth of field, sharp facial features
- 1:1 square aspect ratio, portrait crop
- No text, no watermark
- Natural color grading, DSLR clarity
- Skin texture detail, professional attire appropriate for their industry"""

    try:
        result = call_gemini(prompt, system)
        return {"prompt": result.strip(), "style": req.style}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Run ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    print(f"\n{'='*50}")
    print(f"  LinkedIn Warrior API")
    print(f"  Port: {port}")
    print(f"  Gemini key set: {bool(GEMINI_API_KEY)}")
    print(f"{'='*50}\n")
    if not GEMINI_API_KEY:
        print("⚠️  WARNING: GEMINI_API_KEY not set!")
        print("   Run: export GEMINI_API_KEY=your_key_from_aistudio.google.com\n")
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)
