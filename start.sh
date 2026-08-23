#!/usr/bin/env bash

# ==============================================================================
# Sanjivani - Unified Dev Server Startup Script (FastAPI Backend + Vite Frontend)
# ==============================================================================

set -e

# Project root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Text styles
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "============================================================"
echo "    Sanjivani (संजीवनी) - Clinical Intake & Digitization"
echo "============================================================"
echo -e "${NC}"

# 1. Check & Activate Python Virtual Environment
PYTHON_BIN="python3"
if [ -d "$ROOT_DIR/sihvenv312" ]; then
    source "$ROOT_DIR/sihvenv312/bin/activate"
    PYTHON_BIN="$ROOT_DIR/sihvenv312/bin/python"
    echo -e "${GREEN}✓ Using virtualenv:${NC} sihvenv312"
elif [ -d "$ROOT_DIR/.venv" ]; then
    source "$ROOT_DIR/.venv/bin/activate"
    PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
    echo -e "${GREEN}✓ Using virtualenv:${NC} .venv"
elif [ -d "$ROOT_DIR/venv" ]; then
    source "$ROOT_DIR/venv/bin/activate"
    PYTHON_BIN="$ROOT_DIR/venv/bin/python"
    echo -e "${GREEN}✓ Using virtualenv:${NC} venv"
else
    echo -e "${YELLOW}⚠ No standard venv directory found. Using system python3.${NC}"
fi

# 2. Check for .env file
if [ ! -f "$ROOT_DIR/.env" ]; then
    if [ -f "$ROOT_DIR/.env.example" ]; then
        echo -e "${YELLOW}⚠ .env not found. Copying .env.example to .env...${NC}"
        cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
        echo -e "${YELLOW}👉 Please update .env with your valid OPENAI_API_KEY if needed.${NC}"
    else
        echo -e "${RED}✗ Error: .env file missing in root directory.${NC}"
    fi
fi

# 3. Check frontend node_modules
if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    echo -e "${YELLOW}⚠ frontend/node_modules not found. Running npm install...${NC}"
    (cd "$ROOT_DIR/frontend" && npm install)
fi

echo ""
echo -e "${BOLD}Starting Services:${NC}"
echo -e "  ${GREEN}► FastAPI Backend:${NC}  http://localhost:8000 (Swagger Docs: http://localhost:8000/docs)"
echo -e "  ${GREEN}► Vite Frontend:${NC}    http://localhost:5173"
echo ""
echo -e "${YELLOW}Press [Ctrl+C] to stop all services.${NC}"
echo "------------------------------------------------------------"

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down Sanjivani services...${NC}"
    if [ -n "$BACKEND_PID" ]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    wait 2>/dev/null || true
    echo -e "${GREEN}✓ All services stopped cleanly.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start FastAPI Backend
"$PYTHON_BIN" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start Vite Frontend
(cd "$ROOT_DIR/frontend" && npm run dev -- --host) &
FRONTEND_PID=$!

# Wait for both processes
wait
