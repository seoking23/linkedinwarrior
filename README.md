# LinkedIn Warrior ⚔️

AI-powered LinkedIn profile consultant built at the **GDG Newport Beach Google I/O Extended Lab & Hackathon** — June 20, 2026.

Paste your LinkedIn URL. Get a full AI profile audit, 10 ready-to-post drafts, and AI image prompts — in seconds. Each draft has a one-click **Open in LinkedIn** button that copies the text and opens the LinkedIn composer in a new tab.

---

## What it does

- **Profile Review** — Scores every section of your LinkedIn (headline, about, experience, skills, photo, recommendations, activity) with specific, actionable feedback
- **Content Plan** — 10 ready-to-post LinkedIn drafts personalized to your profile, including a GDG Newport Beach hackathon recap post
- **Image Prompts** — Engineered Nano Banana prompts for a 4K professional headshot, tech-leader portrait, and GDG hackathon badge
- **GitHub enrichment** — Optional: add your GitHub URL to make the content plan richer with your actual projects
- **Auto-fallback** — If the Cloud Shell backend is unreachable mid-pipeline, the frontend automatically falls back to client-side Gemini (Mode B) without user intervention

---

## Architecture

Two modes — no deploy required for demo day:

### Mode A: Cloud Shell backend (recommended for demo day)
Static frontend (GitHub Pages) → FastAPI backend (Cloud Shell Web Preview) → Gemini API

### Mode B: Pure client-side fallback
Static frontend (GitHub Pages) → Gemini API directly from browser (no server)

```
Frontend  →  GitHub Pages (this repo, /frontend)
Backend   →  Cloud Shell + FastAPI (/backend/main.py)
AI        →  Gemini 2.5 Flash (text) + 2.5 Flash Image / Nano Banana (images)
GitHub    →  Public GitHub REST API (no auth needed for public profiles)
Storage   →  localStorage (no database)
```

---

## Quick start

### Get a Gemini API key (free) — needed for either mode

```
https://aistudio.google.com/apikey
→ Create API key → Select project → Copy key
```

### Mode A — Cloud Shell backend (recommended for demo day)

Open [Google Cloud Shell](https://shell.cloud.google.com/) and run:

```bash
git clone https://github.com/<your-org>/linkedinwarrior.git
cd linkedinwarrior
bash start-demo.sh
```

The script prompts for your Gemini key, smoke-tests it, installs deps, and starts uvicorn on port 8080.

Then:
1. Click **Web Preview** (top-right Cloud Shell toolbar) → **Preview on port 8080**
2. Copy the `https://8080-cs-…cloudshell.dev` URL from the new tab
3. Open the frontend, click ⚙ **Settings**, paste into **Cloud Shell API URL**, **Save**
4. Sanity check: visit `<URL>/health` — you should see JSON with `"gemini_key_set": true`

### Mode B — Pure client-side (no backend)

1. Open the frontend
2. Click ⚙ **Settings** → paste your Gemini key into **Gemini API Key** → **Save**
3. Done — all AI calls run directly in the browser

### Deploy the frontend

GitHub Actions in `.github/workflows/pages.yml` auto-deploys `/frontend` to GitHub Pages on every push to `main`. Enable Pages once: **Settings → Pages → Source: GitHub Actions**.

Live at `https://<your-username>.github.io/linkedinwarrior/`.

> ⚠️ The deploy workflow can inject a `GEMINI_KEY` secret directly into the deployed HTML (see `scripts/inject-frontend-config.py`). Leave that secret **unset** unless you intend the key to be readable by anyone visiting the site — end users can paste their own key in Settings instead.

### Auto-fallback (Mode A → Mode B)

If the Cloud Shell backend goes down mid-pipeline, the frontend automatically falls back to client-side Gemini *provided* a Gemini key is set in Settings. Add both for resilience.

---

## Project structure

```
linkedinwarrior/
├── backend/
│   ├── main.py                          — FastAPI server (runs in Cloud Shell)
│   ├── requirements.txt
│   └── agents/
│       ├── gemini_client.py             — google-genai SDK wrapper
│       ├── prompts.py                   — Harness + task prompts, JSON schemas
│       └── schemas.py
├── frontend/
│   ├── index.html                       — Full single-page app
│   └── src/
│       ├── gemini.js                    — Gemini client + agent wrappers
│       ├── github.js                    — GitHub public API fetch
│       ├── storage.js                   — localStorage session persistence
│       └── config.js                    — Mode switcher + apiPostWithFallback
├── scripts/
│   └── inject-frontend-config.py        — Build-time config injection (CI)
├── .github/workflows/pages.yml          — GitHub Pages auto-deploy
├── start-demo.sh                        — One-command demo startup
├── .env.example                         — Safe to commit — no real values
└── README.md
```

---

## API endpoints (backend)

```
GET  /health                — Health check + API key status
POST /api/extract-profile   — Structure pasted profile text into typed ProfileData
POST /api/analyze           — LinkedIn profile review (returns scored JSON)
POST /api/content-plan      — 10-post LinkedIn content plan
POST /api/image-prompt      — Engineered image generation prompt (Nano Banana)
POST /api/generate-image    — Direct image generation via gemini-2.5-flash-image
```

---

## Switching modes during demo

To switch to Cloud Shell mode mid-demo, paste in browser console:
```javascript
localStorage.setItem('api_base', 'https://8080-cs-xxxx.cs.us-central1.cloudshell.dev')
location.reload()
```

To revert to client-side mode:
```javascript
localStorage.removeItem('api_base')
location.reload()
```

---

## Security rules

This repo is **public**. Never commit:

| ❌ Never commit | ✅ Use instead |
|---|---|
| API keys | `export GEMINI_API_KEY=...` in Cloud Shell |
| `.env` files | `.env.example` with placeholder values |
| Service account JSON | GitHub Secrets |
| Any token or password | Runtime env vars |

---

## Event

Built at **Google I/O Extended Lab: Workshop & Hackathon**  
Organizer: GDG Newport Beach  
Date: June 20, 2026  
Location: 2807 Villa Way, Newport Beach, CA 92663  

Speakers:
- Kartik Derasari — Multi-Agentic Ecosystem using Google AI stack
- Abby Damodaran — Multi-turn image generation Codelab
- Suvaditya Mukherjee — Optimizing Gemma models on Vertex AI

Tech themes: Vertex AI · Gemini · Agent Engine · ADK · Cloud Run · A2A · Gemma 4

---

## Cost

| Service | Cost |
|---|---|
| GitHub Pages | $0 |
| Gemini API (AI Studio key) | $0 — free tier |
| Cloud Shell | $0 — included with GCP |
| GitHub Actions | $0 — 2,000 min/month free |
| **Total** | **$0** |
