# LinkedIn Warrior ⚔️

AI-powered LinkedIn profile consultant built at the **GDG Newport Beach Google I/O Extended Lab & Hackathon** — June 20, 2026.

Paste your LinkedIn URL. Get a full AI profile audit, a ready-to-post content plan, and AI image prompts — in seconds.

---

## What it does

- **Profile Review** — Scores every section of your LinkedIn (headline, about, experience, skills, photo, recommendations, activity) with specific, actionable feedback
- **Content Plan** — 5 ready-to-post LinkedIn posts personalized to your profile, including a GDG Newport Beach hackathon recap post
- **Image Prompts** — Engineered Nano Banana Pro prompts for a 4K professional headshot and GDG hackathon badge
- **GitHub enrichment** — Optional: add your GitHub URL to make the content plan richer with your actual projects

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
AI        →  Gemini 2.0 Flash via Google AI Studio API key
GitHub    →  Public GitHub REST API (no auth needed for public profiles)
Storage   →  localStorage (no database)
```

---

## Quick start

### 1. Get a Gemini API key (free)

```
https://aistudio.google.com/apikey
→ Create API key → Select project → Copy key
```

### 2. Deploy the frontend

The GitHub Actions workflow in `.github/workflows/pages.yml` auto-deploys `/frontend` to GitHub Pages on every push to `main`.

Enable GitHub Pages: **Settings → Pages → Source: gh-pages branch**

Your frontend will be live at:
```
https://<your-username>.github.io/linkedinwarrior/
```

### 3. Start the backend (Cloud Shell)

```bash
# In Google Cloud Shell:
git clone https://github.com/<your-org>/linkedinwarrior.git
cd linkedinwarrior
bash start-demo.sh
```

The script will:
- Prompt for your Gemini API key
- Test the API
- Install dependencies
- Start FastAPI on port 8080

Then click **Web Preview → Preview on port 8080** and copy the URL into the app's Settings panel.

### 4. Run purely client-side (fallback)

If Cloud Shell isn't available, open the app and go to **Settings → Gemini API Key** and paste your AI Studio key. All AI calls run directly in the browser.

---

## Project structure

```
linkedinwarrior/
├── backend/
│   ├── main.py             — FastAPI server (runs in Cloud Shell)
│   └── requirements.txt
├── frontend/
│   ├── index.html          — Full single-page app
│   └── src/
│       ├── gemini.js       — Gemini API client + agent wrappers
│       ├── github.js       — GitHub public API fetch
│       ├── storage.js      — localStorage session persistence
│       └── config.js       — API base switcher (server vs client mode)
├── .github/
│   └── workflows/
│       └── pages.yml       — GitHub Pages auto-deploy
├── start-demo.sh           — One-command demo startup for Cloud Shell
├── .env.example            — Safe to commit — no real values
└── README.md
```

---

## API endpoints (backend)

```
GET  /health                — Health check + API key status
POST /api/analyze           — LinkedIn profile review (returns scored JSON)
POST /api/content-plan      — 5-post LinkedIn content plan
POST /api/image-prompt      — Engineered image generation prompt
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
