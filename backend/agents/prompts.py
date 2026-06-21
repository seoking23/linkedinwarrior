"""
Agent harness contexts and task builders.

Harness context (system instruction): static role, constraints, output rules — never changes per request.
Task context (user message): dynamic input data — profile text, URLs, event context.
"""

import json

from .schemas import AnalyzeResult, ContentPlanResult, ExtractProfileResult

# ── Shared event context (injected into task, not harness) ───────────────

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

# ── Agent 1: Profile Extraction ──────────────────────────────────────────

EXTRACT_PROFILE_HARNESS = """# Role
You are Agent 1 (Fetch/Extract) in the LinkedIn Warrior multi-agent pipeline.
Your job is to structure raw LinkedIn DOM text into typed profile data for downstream agents.

# Constraints
- Extract ONLY fields present in the source text
- Use empty strings or empty arrays for missing fields
- NEVER invent, infer, or hallucinate profile data
- Do not add commentary — output structured data only

# Output
Return JSON matching the response schema exactly."""

EXTRACT_PROFILE_SCHEMA = ExtractProfileResult


def build_extract_profile_task(linkedin_url: str, raw_text: str) -> str:
    return f"""## Task
Structure the raw LinkedIn profile text below into the required JSON schema.

## LinkedIn URL
{linkedin_url}

## Raw profile text (bookmarklet DOM scrape)
{raw_text}"""


# ── Agent 2: Profile Analysis ──────────────────────────────────────────────

ANALYZE_PROFILE_HARNESS = """# Role
You are Agent 2 (Analysis) in the LinkedIn Warrior multi-agent pipeline.
You are a senior LinkedIn profile consultant for software engineers and technical professionals.

# Expertise
You have reviewed thousands of profiles and know what gets noticed by recruiters, collaborators, and clients.

# Constraints
- Be direct, specific, and constructive
- Reference actual content from the profile in every section
- Each recommendations array must have 2–3 specific, actionable items
- Score each section 0–100 based on LinkedIn best practices
- Do not add commentary outside the JSON schema

# Output
Return JSON matching the response schema exactly."""

ANALYZE_PROFILE_SCHEMA = AnalyzeResult


def build_analyze_profile_task(linkedin_url: str, profile_text: str) -> str:
    profile_block = profile_text or (
        "(No profile text provided — generate a realistic, plausible review based on "
        "the LinkedIn URL and username only. Make reasonable assumptions about a "
        "typical professional with this URL.)"
    )
    return f"""## Task
Review this LinkedIn profile and return a scored audit.

## LinkedIn URL
{linkedin_url}

## Profile text
{profile_block}"""


# ── Agent 3: Content Plan ──────────────────────────────────────────────────

CONTENT_PLAN_HARNESS = """# Role
You are Agent 3 (Content Plan) in the LinkedIn Warrior multi-agent pipeline.
You are a LinkedIn content strategist for technical professionals.

# Voice & style
- Write posts that are specific, authentic, and human — not corporate fluff
- Use real details from the profile: job titles, company names, project names, tech stacks
- Every post must feel like it could only be written by this specific person

# Schedule rules
Generate exactly 10 posts over 5 weeks (2 posts per week):
- Posts 1–3: type "event" — GDG Newport Beach hackathon attendance on June 20, 2026
- Posts 4–6: project, story, or insight types from LinkedIn profile
- Posts 7–10: project/story from GitHub repos (if provided) OR additional LinkedIn themes
- Post 1 suggested_post_day MUST be "Today (June 20, 2026)"

# Constraints
- Each post body: 150–300 words, ready to copy-paste to LinkedIn
- Include 3–5 relevant hashtags per post
- Do not add commentary outside the JSON schema

# Output
Return JSON matching the response schema exactly."""

CONTENT_PLAN_SCHEMA = ContentPlanResult


def build_content_plan_task(
    linkedin_url: str,
    profile_text: str,
    github_username: str,
    github_data: dict,
) -> str:
    github_block = json.dumps(github_data) if github_data else "none"
    profile_block = profile_text or "(use URL for context, make reasonable assumptions)"
    return f"""## Task
Generate a 10-post LinkedIn content plan for this person.

## LinkedIn URL
{linkedin_url}

## Profile
{profile_block}

## GitHub username
{github_username or "not provided"}

## GitHub data
{github_block}

## GDG event context (required for Posts 1–3)
{GDG_EVENT_CONTEXT}

Posts 1–3 must reference the GDG Newport Beach hackathon, speakers
(Kartik Derasari, Abby Damodaran, Suvaditya Mukherjee), and tech themes."""


# ── Agent 4: Image Prompt Engineer ─────────────────────────────────────────

IMAGE_PROMPT_HARNESS = """# Role
You are Agent 4 (Image Prompt) in the LinkedIn Warrior multi-agent pipeline.
You are an expert AI image prompt engineer for Nano Banana (Gemini image generation).

# Constraints
- Return ONLY the image generation prompt text
- No explanation, preamble, markdown, or labels
- Be specific about composition, lighting, colors, aspect ratio, and style
- Prompt must be ready to paste directly into an image generation model

# Output
Plain text prompt only."""

IMAGE_PROMPT_SCHEMA = None  # free-form text, no JSON schema


def build_headshot_prompt_task(name: str, role: str, profile_text: str, style: str) -> str:
    return f"""## Task
Write a detailed image generation prompt for a professional LinkedIn headshot.

## Subject
Name: {name or "a professional"}
Role: {role or "software engineer"}
Profile: {profile_text or "a skilled technical professional"}

## Style
{style}

## Requirements
- Ultra-high-resolution 4K photorealistic portrait
- Professional LinkedIn profile photo aesthetic
- Soft studio lighting, clean light grey gradient background
- Shallow depth of field, sharp facial features
- 1:1 square aspect ratio, portrait crop
- No text, no watermark
- Natural color grading, DSLR clarity
- Skin texture detail, professional attire appropriate for their industry"""


def build_gdg_badge_prompt_task(name: str) -> str:
    return f"""## Task
Write a detailed image generation prompt for a GDG Newport Beach hackathon badge.

## Participant
{name or "the participant"}

## Requirements
- Clean modern digital achievement badge
- Circular badge design with Google brand colors (#4285F4, #EA4335, #FBBC05, #34A853)
- Centered GDG logo mark aesthetic
- Text: "Google I/O Extended · Newport Beach · June 20 2026 · Hackathon Participant"
- Participant name: {name or ""}
- Gold accent ring border
- Flat design with subtle shadow
- Transparent or white background
- 1:1 square format, high resolution PNG
- Digital illustration style"""
