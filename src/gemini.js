/**
 * gemini.js — Direct Gemini API calls (Mode B: client-side fallback)
 * Used when Cloud Shell backend is unavailable.
 * API key is visible to users — acceptable for a hackathon demo.
 */

const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

export function getGeminiKey() {
  return (
    (typeof import !== "undefined" && typeof import.meta !== "undefined" && import.meta.env?.VITE_GEMINI_KEY) ||
    window._GEMINI_KEY ||
    localStorage.getItem("gemini_key") ||
    ""
  );
}

export async function callGemini(prompt, systemPrompt = "") {
  const key = getGeminiKey();
  if (!key) throw new Error("No Gemini API key. Set one in Settings.");

  const contents = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Understood. I'll follow those instructions exactly." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const res = await fetch(GEMINI_URL(key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error: ${res.status}`);
  }

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

function cleanJson(raw) {
  let clean = raw.trim();
  if (clean.startsWith("```")) clean = clean.split("\n").slice(1).join("\n");
  if (clean.endsWith("```")) clean = clean.split("```").slice(0, -1).join("```");
  return JSON.parse(clean.trim());
}

const GDG_CONTEXT = `
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

// ── Agent wrappers ──────────────────────────────────────────────────────

export async function analyzeLinkedIn(linkedinUrl, profileText = "") {
  const system = `You are a senior LinkedIn profile consultant for technical professionals.
Review the profile and return ONLY valid JSON — no markdown, no backticks:
{
  "overall_score": 74,
  "summary": "2-sentence assessment",
  "sections": {
    "headline":        {"score": 0, "feedback": "", "recommendations": []},
    "about":           {"score": 0, "feedback": "", "recommendations": []},
    "experience":      {"score": 0, "feedback": "", "recommendations": []},
    "skills":          {"score": 0, "feedback": "", "recommendations": []},
    "education":       {"score": 0, "feedback": "", "recommendations": []},
    "profile_photo":   {"score": 0, "feedback": "", "recommendations": []},
    "certifications":  {"score": 0, "feedback": "", "recommendations": []},
    "recommendations": {"score": 0, "feedback": "", "recommendations": []},
    "activity":        {"score": 0, "feedback": "", "recommendations": []}
  },
  "top_strengths":    ["...", "...", "..."],
  "top_improvements": ["...", "...", "..."]
}
Be direct and specific. Reference actual content from the profile.`;

  const prompt = `LinkedIn URL: ${linkedinUrl}\n\nProfile:\n${profileText || "(No text — generate a plausible review based on the URL)"}`;
  const raw = await callGemini(prompt, system);
  return cleanJson(raw);
}

export async function generateContentPlan(linkedinUrl, profileText = "", githubData = null) {
  const system = `You are a LinkedIn content strategist for technical professionals.
Write posts that are specific, authentic, human — not corporate fluff.
Return ONLY valid JSON — no markdown, no backticks:
{
  "posts": [
    {
      "post_number": 1,
      "type": "event",
      "title": "",
      "body": "150-300 words, ready to paste",
      "hashtags": [],
      "suggested_post_day": "",
      "suggested_post_time": ""
    }
  ]
}
Generate exactly 5 posts. Post 1 MUST be about attending the GDG Newport Beach hackathon today.`;

  const prompt = `LinkedIn URL: ${linkedinUrl}
Profile: ${profileText || "(use URL for context)"}
GitHub data: ${githubData ? JSON.stringify(githubData) : "not provided"}

GDG Event context (required for Post 1):
${GDG_CONTEXT}`;

  const raw = await callGemini(prompt, system);
  return cleanJson(raw);
}

export async function generateImagePrompt(name = "", role = "", profileText = "", style = "professional headshot") {
  const system = "You are an expert AI image prompt engineer. Return only the prompt text — no explanation.";

  const prompt = style === "gdg-badge"
    ? `Write a detailed image generation prompt for a GDG Newport Beach hackathon badge.
Participant: ${name}
Requirements: circular badge, Google brand colors (#4285F4 #EA4335 #FBBC05 #34A853), GDG branding,
text "Google I/O Extended · Newport Beach · June 20 2026 · Hackathon Participant",
participant name "${name}", gold ring border, flat design, 1:1 square, high resolution PNG`
    : `Write a detailed 4K professional headshot prompt for:
Name: ${name || "a professional"}
Role: ${role || "software engineer"}
Profile: ${profileText || "skilled technical professional"}
Requirements: Ultra-high-res 4K photorealistic, soft studio lighting, clean grey gradient background,
shallow depth of field, 1:1 square, no text, no watermark, natural color grading, professional attire`;

  return callGemini(prompt, system);
}
