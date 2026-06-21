#!/bin/bash
# start-local.sh — Local development (backend + frontend)
# Usage: bash start-local.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT="${PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-5500}"

echo ""
echo "LinkedIn Warrior — local development"
echo "  Backend:  http://localhost:${BACKEND_PORT}"
echo "  Frontend: http://localhost:${FRONTEND_PORT}/?api=http://localhost:${BACKEND_PORT}"
echo ""

if [ -f "$PROJECT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$PROJECT_DIR/.env"
  set +a
fi

if [ ! -d "$PROJECT_DIR/.venv" ]; then
  python3 -m venv "$PROJECT_DIR/.venv"
fi

"$PROJECT_DIR/.venv/bin/pip" install -r "$PROJECT_DIR/backend/requirements.txt" -q

export ENV=development
export PORT="$BACKEND_PORT"

cd "$PROJECT_DIR/backend"
"$PROJECT_DIR/.venv/bin/uvicorn" main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!

cd "$PROJECT_DIR/frontend"
python3 -m http.server "$FRONTEND_PORT" &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Press Ctrl+C to stop both servers."
wait
