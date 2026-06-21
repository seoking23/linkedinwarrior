/**
 * gemini.js — Direct Gemini API calls (Mode B: client-side fallback)
 * Harness context → systemInstruction | Task context → user contents
 * Used when Cloud Shell backend is unavailable.
 */

const TEXT_MODEL = 'gemini-2.5-flash';
const IMAGE_MODEL = 'gemini-2.5-flash-image';
const GEMINI_URL = (key, model = TEXT_MODEL) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

export function getGeminiKey() {
  return (
    import.meta.env?.VITE_GEMINI_KEY ||
    window._GEMINI_KEY ||
    localStorage.getItem('gemini_key') ||
    ''
  );
}

// ── Shared event context (task context, not harness) ───────────────────

const GDG_EVENT_CONTEXT = `
Event: Google I/O Extended Lab: Workshop & Hackathon
Organizer: GDG Newport Beach
Date: June 20, 2026
Location: 2807 Villa Way, Newport Beach, CA 92663
Speakers:
  - Kartik Derasari (GDE — Multi-Agentic Ecosystems using Google AI stack)
  - Abby Damodaran (Google — Multi-turn image generation Codelab)
  - Suvaditya Mukherjee (GDE — Optimizing Gemma models on Vertex AI)
Tech themes: Vertex AI, Gemini, Agent Engine, ADK, Cloud Run, A2A, Gemma 4
`;

// ── Response schemas (structured output) ───────────────────────────────

const SECTION_SCORE = {
  type: 'object',
  properties: {
    score: { type: 'integer' },
    feedback: { type: 'string' },
    recommendations: { type: 'array', items: { type: 'string' } },
  },
  required: ['score', 'feedback', 'recommendations'],
};

const ANALYZE_SCHEMA = {
  type: 'object',
  properties: {
    overall_score: { type: 'integer' },
    summary: { type: 'string' },
    sections: {
      type: 'object',
      properties: {
        headline: SECTION_SCORE,
        about: SECTION_SCORE,
        experience: SECTION_SCORE,
        skills: SECTION_SCORE,
        education: SECTION_SCORE,
        profile_photo: SECTION_SCORE,
        certifications: SECTION_SCORE,
        recommendations: SECTION_SCORE,
        activity: SECTION_SCORE,
      },
      required: ['headline', 'about', 'experience', 'skills', 'education', 'profile_photo', 'certifications', 'recommendations', 'activity'],
    },
    top_strengths: { type: 'array', items: { type: 'string' } },
    top_improvements: { type: 'array', items: { type: 'string' } },
  },
  required: ['overall_score', 'summary', 'sections', 'top_strengths', 'top_improvements'],
};

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    headline: { type: 'string' },
    location: { type: 'string' },
    about: { type: 'string' },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          company: { type: 'string' },
          duration: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    skills: { type: 'array', items: { type: 'string' } },
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          school: { type: 'string' },
          degree: { type: 'string' },
          year: { type: 'string' },
        },
      },
    },
    certifications: { type: 'array', items: { type: 'string' } },
    recommendations_count: { type: 'integer' },
    activity_summary: { type: 'string' },
    connection_count: { type: 'string' },
  },
};

const CONTENT_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    plan_generated_at: { type: 'string' },
    source_data: { type: 'array', items: { type: 'string' } },
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          post_number: { type: 'integer' },
          type: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
          suggested_post_day: { type: 'string' },
          suggested_post_time: { type: 'string' },
          character_count: { type: 'integer' },
        },
        required: ['post_number', 'type', 'title', 'body', 'hashtags', 'suggested_post_day', 'suggested_post_time'],
      },
    },
  },
  required: ['posts'],
};

// ── Core client: harness → systemInstruction, task → user contents ─────

const FETCH_TIMEOUT_MS = 45000;
const STRICT_JSON_SUFFIX = '\n\nIMPORTANT: respond with valid JSON only, no prose or markdown fences.';

async function geminiFetch(url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`gemini.js: request timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function callAgent(harness, task, { responseSchema = null, temperature = 0.7 } = {}) {
  const key = getGeminiKey();
  if (!key) throw new Error('No Gemini API key. Set one in Settings.');

  const generationConfig = { temperature, maxOutputTokens: 8192 };
  if (responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = responseSchema;
  }

  const body = {
    systemInstruction: { parts: [{ text: harness }] },
    contents: [{ role: 'user', parts: [{ text: task }] }],
    generationConfig,
  };

  const res = await geminiFetch(GEMINI_URL(key), body);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `gemini.js: Gemini API error ${res.status}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

function cleanJson(raw) {
  let clean = raw.trim();
  if (clean.startsWith('```')) clean = clean.split('\n').slice(1).join('\n');
  if (clean.endsWith('```')) clean = clean.split('```').slice(0, -1).join('```');
  return JSON.parse(clean.trim());
}

async function callAgentJson(harness, task, options = {}) {
  const raw = await callAgent(harness, task, options);
  try {
    return cleanJson(raw);
  } catch (e) {
    console.warn('gemini.js: JSON parse failed, retrying with stricter instruction:', e.message);
    const rawRetry = await callAgent(harness, task + STRICT_JSON_SUFFIX, options);
    return cleanJson(rawRetry);
  }
}

// ── Agent harness contexts ─────────────────────────────────────────────

const EXTRACT_PROFILE_HARNESS = `# Role
You are Agent 1 (Fetch/Extract) in the LinkedIn Warrior multi-agent pipeline.
Your job is to structure raw LinkedIn DOM text into typed profile data for downstream agents.

# Constraints
- Extract ONLY fields present in the source text
- Use empty strings or empty arrays for missing fields
- NEVER invent, infer, or hallucinate profile data
- Do not add commentary — output structured data only

# Output
Return JSON matching the response schema exactly.`;

const ANALYZE_PROFILE_HARNESS = `# Role
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
Return JSON matching the response schema exactly.`;

const CONTENT_PLAN_HARNESS = `# Role
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
Return JSON matching the response schema exactly.`;

const IMAGE_PROMPT_HARNESS = `# Role
You are Agent 4 (Image Prompt) in the LinkedIn Warrior multi-agent pipeline.
You are an expert AI image prompt engineer for Nano Banana (Gemini image generation).

# Constraints
- Return ONLY the image generation prompt text
- No explanation, preamble, markdown, or labels
- Be specific about composition, lighting, colors, aspect ratio, and style
- Prompt must be ready to paste directly into an image generation model

# Output
Plain text prompt only.`;

// ── Agent wrappers ──────────────────────────────────────────────────────

export async function analyzeLinkedIn(linkedinUrl, profileText = '') {
  const task = `## Task
Review this LinkedIn profile and return a scored audit.

## LinkedIn URL
${linkedinUrl}

## Profile text
${profileText || '(No text — generate a plausible review based on the URL)'}`;

  return callAgentJson(ANALYZE_PROFILE_HARNESS, task, { responseSchema: ANALYZE_SCHEMA });
}

export async function generateContentPlan(linkedinUrl, profileText = '', githubData = null) {
  const task = `## Task
Generate a 10-post LinkedIn content plan for this person.

## LinkedIn URL
${linkedinUrl}

## Profile
${profileText || '(use URL for context)'}

## GitHub data
${githubData ? JSON.stringify(githubData) : 'not provided'}

## GDG event context (required for Posts 1–3)
${GDG_EVENT_CONTEXT}

Posts 1–3 must reference the GDG Newport Beach hackathon, speakers, and tech themes.`;

  return callAgentJson(CONTENT_PLAN_HARNESS, task, { responseSchema: CONTENT_PLAN_SCHEMA });
}

export async function extractProfileData(rawText, linkedinUrl = '') {
  const task = `## Task
Structure the raw LinkedIn profile text below into the required JSON schema.

## LinkedIn URL
${linkedinUrl}

## Raw profile text (bookmarklet DOM scrape)
${rawText}`;

  return callAgentJson(EXTRACT_PROFILE_HARNESS, task, { responseSchema: EXTRACT_SCHEMA });
}

export async function generateImagePrompt(name = '', role = '', profileText = '', style = 'professional headshot') {
  const task = style === 'gdg-badge'
    ? `## Task
Write a detailed image generation prompt for a GDG Newport Beach hackathon badge.

## Participant
${name}

## Requirements
- Clean modern digital achievement badge
- Circular badge design with Google brand colors (#4285F4, #EA4335, #FBBC05, #34A853)
- Centered GDG logo mark aesthetic
- Text: "Google I/O Extended · Newport Beach · June 20 2026 · Hackathon Participant"
- Participant name: "${name}"
- Gold accent ring border, flat design, 1:1 square, high resolution PNG`
    : `## Task
Write a detailed image generation prompt for a professional LinkedIn headshot.

## Subject
Name: ${name || 'a professional'}
Role: ${role || 'software engineer'}
Profile: ${profileText || 'a skilled technical professional'}

## Style
${style}

## Requirements
- Ultra-high-resolution 4K photorealistic portrait
- Soft studio lighting, clean grey gradient background
- Shallow depth of field, 1:1 square, no text, no watermark`;

  return callAgent(IMAGE_PROMPT_HARNESS, task, { temperature: 0.8 });
}

/**
 * Generate an image directly via gemini-2.5-flash-image (Nano Banana).
 * Returns { imageBase64, mimeType, text } — imageBase64 may be null if the
 * model returned text only.
 */
export async function generateNanoBananaImage(prompt) {
  const key = getGeminiKey();
  if (!key) throw new Error('No Gemini API key. Set one in Settings.');

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
  };

  const res = await geminiFetch(GEMINI_URL(key, IMAGE_MODEL), body);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `gemini.js: Nano Banana error ${res.status}`);
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  let imageBase64 = null;
  let mimeType = null;
  let text = null;
  for (const part of parts) {
    if (part.inlineData?.data) {
      imageBase64 = part.inlineData.data;
      mimeType = part.inlineData.mimeType || 'image/png';
    } else if (part.text) {
      text = part.text;
    }
  }
  if (!imageBase64 && !text) throw new Error('gemini.js: no image or text in Nano Banana response');
  return { imageBase64, mimeType, text };
}
