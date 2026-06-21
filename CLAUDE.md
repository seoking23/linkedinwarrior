cat > /Users/douglasseo/Desktop/FunDevSideProjects/linkedinwarrior/CLAUDE.md << 'EOF'
# LinkedIn Warrior — Claude Code Context

## What this is
AI-powered LinkedIn profile consultant. Built at GDG Newport Beach Google I/O Extended Hackathon, June 20, 2026.

## Architecture
- **Frontend**: `/frontend/index.html` — vanilla JS, no build step, GitHub Pages
- **Backend**: `/backend/main.py` — FastAPI, Google Cloud Shell, port 8080
- **AI**: Gemini 2.0 Flash via Google AI Studio key (`GEMINI_API_KEY`)
- **Mode A**: Cloud Shell backend + GitHub Pages frontend
- **Mode B**: Client-side only, Gemini called directly from browser
- **Storage**: localStorage, no database

## Agent pipeline
1. Fetch Agent → LinkedIn URL + optional GitHub
2. Analysis Agent → profile score 0-100 per section  
3. Content Plan Agent → 5 posts, Post 1 = GDG Newport Beach hackathon recap
4. Image Prompt Agent → prompts for Nano Banana Pro

## Key files
- `frontend/src/gemini.js` — Gemini client + all agent wrappers
- `frontend/src/github.js` — GitHub public API
- `frontend/src/storage.js` — localStorage session
- `frontend/src/config.js` — mode switcher
- `backend/main.py` — FastAPI endpoints

## API endpoints
- `POST /api/analyze` — LinkedIn review
- `POST /api/content-plan` — 5-post content plan
- `POST /api/image-prompt` — image generation prompt

## Deploy
- Frontend auto-deploys to GitHub Pages via `.github/workflows/pages.yml` on push to main
- Backend: `bash start-demo.sh` in Cloud Shell

## Never commit
- API keys, .env files, tokens, service account JSON

## GDG event context
- Event: Google I/O Extended Lab & Hackathon
- Organizer: GDG Newport Beach  
- Date: June 20, 2026
- Location: 2807 Villa Way, Newport Beach, CA 92663
EOF