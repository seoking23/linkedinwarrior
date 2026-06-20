#!/bin/bash
# start-demo.sh — Run this in Cloud Shell at the start of the hackathon
# Usage: bash start-demo.sh

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        LinkedIn Warrior — Demo Day       ║"
echo "║  GDG Newport Beach · June 20, 2026       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Prompt for API key if not set
if [ -z "$GEMINI_API_KEY" ]; then
  echo "Paste your Gemini API key (from https://aistudio.google.com/apikey):"
  echo -n "> "
  read -s GEMINI_API_KEY
  export GEMINI_API_KEY
  echo ""
  echo "✅ API key set"
fi

# Verify it works
echo ""
echo "Testing Gemini API key..."
RESP=$(curl -s \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello in exactly 5 words"}]}]}' 2>/dev/null)

if echo "$RESP" | grep -q "candidates"; then
  echo "✅ Gemini API is working"
else
  echo "❌ Gemini API test failed. Check your key."
  echo "Response: $RESP"
  exit 1
fi

# Install Python deps
echo ""
echo "Installing backend dependencies..."
pip install fastapi uvicorn requests --quiet --break-system-packages
echo "✅ Dependencies installed"

# Start server
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Starting FastAPI server on port 8080    ║"
echo "╠══════════════════════════════════════════╣"
echo "║  1. Click 'Web Preview' in Cloud Shell   ║"
echo "║  2. Select 'Preview on port 8080'        ║"
echo "║  3. Copy the https://8080-cs-xxx... URL  ║"
echo "║  4. Paste into Settings → Cloud Shell URL║"
echo "╚══════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"
python3 backend/main.py
