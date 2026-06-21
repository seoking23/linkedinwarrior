#!/bin/bash
# start-demo.sh — Production startup for Cloud Shell / demo day
# Usage: bash start-demo.sh

set -e
set -o pipefail

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        LinkedIn Warrior — Demo Day       ║"
echo "║  GDG Newport Beach · June 20, 2026       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load .env when present (local or Cloud Shell checkout)
if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

# Prompt for API key if not set
if [ -z "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
  echo "Paste your Gemini API key (from https://aistudio.google.com/apikey):"
  echo -n "> "
  read -s GEMINI_API_KEY
  export GEMINI_API_KEY
  echo ""
  echo "✅ API key set"
fi

# Verify AI Studio key when used (skip when running on Vertex via GOOGLE_CLOUD_PROJECT)
if [ -n "$GEMINI_API_KEY" ]; then
  echo ""
  echo "Testing Gemini API key..."
  RESP=$(curl -s \
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"contents":[{"parts":[{"text":"Say hello in exactly 5 words"}]}]}' 2>/dev/null)

  if echo "$RESP" | grep -q "candidates"; then
    echo "✅ Gemini API is working"
  else
    echo "❌ Gemini API test failed. Check your key."
    echo "Response: $RESP"
    exit 1
  fi
fi

# Install Python deps
echo ""
echo "Installing backend dependencies..."
pip install -r "$PROJECT_DIR/backend/requirements.txt" --quiet --break-system-packages
echo "✅ Dependencies installed"

# Start server (production mode — no hot reload)
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Backend starting on port 8080               ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  1. Click 'Web Preview' (top-right Cloud     ║"
echo "║     Shell toolbar) → 'Preview on port 8080'  ║"
echo "║  2. Copy the https://8080-cs-…cloudshell.dev ║"
echo "║     URL from the new tab's address bar       ║"
echo "║  3. Open the LinkedIn Warrior site, click    ║"
echo "║     ⚙ Settings, paste URL into 'Cloud Shell  ║"
echo "║     API URL', click Save                     ║"
echo "║  4. Verify: visit <URL>/health → JSON with   ║"
echo "║     gemini_key_set: true                     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

export ENV=production
export PORT="${PORT:-8080}"
cd "$PROJECT_DIR/backend"
exec python3 -m uvicorn main:app --host 0.0.0.0 --port "$PORT"
