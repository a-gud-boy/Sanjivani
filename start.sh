#!/usr/bin/env bash

# ==============================================================================
# Sanjivani - Unified Dev Server Startup Script
# Starts:
#   1. vLLM Local Model Server (Optional: google/medgemma-1.5-4b-it on :8001)
#   2. Relational Database Sync & Pre-seeded ABHA Accounts
#   3. FastAPI Clinical Backend (Port :8000)
#   4. React Vite Frontend with ABHA Auth & Patient Dashboard (Port :5173)
#   5. Public Secure Tunnel (Cloudflare Quick Tunnel)
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

# Verify critical database dependencies
if ! "$PYTHON_BIN" -c "import sqlalchemy, aiosqlite, greenlet" 2>/dev/null; then
    echo -e "${YELLOW}⚠ Installing missing database packages (sqlalchemy, aiosqlite, greenlet)...${NC}"
    "$PYTHON_BIN" -m pip install -q "sqlalchemy>=2.0.0" "aiosqlite>=0.20.0" "greenlet>=3.0.0"
fi

# 2. Check for .env file
if [ ! -f "$ROOT_DIR/.env" ]; then
    if [ -f "$ROOT_DIR/.env.example" ]; then
        echo -e "${YELLOW}⚠ .env not found. Copying .env.example to .env...${NC}"
        cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    else
        echo -e "${RED}✗ Error: .env file missing in root directory.${NC}"
    fi
fi

# 3. Check frontend node_modules
if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    echo -e "${YELLOW}⚠ frontend/node_modules not found. Running npm install...${NC}"
    (cd "$ROOT_DIR/frontend" && npm install)
fi

# 4. Parse Command Line Arguments
START_VLLM=true
START_TUNNEL=true
RESET_DB=false

for arg in "$@"; do
    if [ "$arg" == "--no-vllm" ] || [ "$arg" == "--skip-vllm" ]; then
        START_VLLM=false
    fi
    if [ "$arg" == "--no-tunnel" ] || [ "$arg" == "--skip-tunnel" ] || [ "$arg" == "--local-only" ]; then
        START_TUNNEL=false
    fi
    if [ "$arg" == "--reset-db" ] || [ "$arg" == "--clean-db" ]; then
        RESET_DB=true
    fi
done

# Check if .env explicitly disables vLLM or Tunnel
if [ -f "$ROOT_DIR/.env" ]; then
    if grep -qE "^START_VLLM=false" "$ROOT_DIR/.env"; then
        START_VLLM=false
    fi
    if grep -qE "^ENABLE_PUBLIC_TUNNEL=false" "$ROOT_DIR/.env"; then
        START_TUNNEL=false
    fi
fi

if [ -f "$ROOT_DIR/.env" ]; then
    ENV_VLLM_MODEL=$(grep -E "^(VLLM_MODEL|TEXT_LLM_MODEL_NAME)=" "$ROOT_DIR/.env" | head -n1 | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
    if [ -n "$ENV_VLLM_MODEL" ]; then
        VLLM_MODEL="$ENV_VLLM_MODEL"
    fi
    ENV_DB_URL=$(grep -E "^DATABASE_URL=" "$ROOT_DIR/.env" | head -n1 | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
    if [ -n "$ENV_DB_URL" ]; then
        DATABASE_URL="$ENV_DB_URL"
    fi
fi

VLLM_MODEL="${VLLM_MODEL:-google/medgemma-1.5-4b-it}"
VLLM_PORT="${VLLM_PORT:-8001}"
VLLM_GPU_UTIL="${VLLM_GPU_UTIL:-0.85}"
VLLM_MAX_LEN="${VLLM_MAX_LEN:-4096}"
VLLM_QUANT="${VLLM_QUANT:-bitsandbytes}"
DATABASE_URL="${DATABASE_URL:-sqlite+aiosqlite:///./sanjivani.db}"

# Automatically skip local vLLM if Google Gemini is configured
if [ -f "$ROOT_DIR/.env" ]; then
    if grep -sqE "^(GEMINI_API_KEY|GOOGLE_API_KEY)=" "$ROOT_DIR/.env" || [[ "$VLLM_MODEL" =~ (gemini|gemma) ]]; then
        START_VLLM=false
        echo -e "${GREEN}✓ Google Cloud AI configured (${VLLM_MODEL}). Skipping local vLLM server.${NC}"
    fi
fi

# Optional DB reset if requested
if [ "$RESET_DB" = true ]; then
    echo -e "${YELLOW}⚠ Resetting local database (sanjivani.db)...${NC}"
    rm -f "$ROOT_DIR/sanjivani.db"
fi

# Synchronize database schema and seed demo accounts
echo -e "${GREEN}✓ Initializing Database & Pre-Seeding Demo Accounts...${NC}"
"$PYTHON_BIN" -c "
import asyncio
from app.db.seed import init_db, seed_demo_data
async def run():
    await init_db()
    await seed_demo_data()
asyncio.run(run())
"

# Clean up any lingering processes from prior sessions to free GPU VRAM & ports
pkill -9 -f "VLLM::EngineCore" 2>/dev/null || true
pkill -f "vllm.entrypoints.openai.api_server" 2>/dev/null || true
fuser -k 8000/tcp 8001/tcp 5173/tcp 2>/dev/null || true

echo ""
echo -e "${BOLD}Starting Services:${NC}"
if [ "$START_VLLM" = true ]; then
    echo -e "  ${GREEN}► vLLM Model Server:${NC}  http://localhost:${VLLM_PORT}/v1 (Model: ${VLLM_MODEL}, 4-bit BnB)"
else
    echo -e "  ${GREEN}► Clinical AI Model:${NC}  Google Cloud Gemini (${TEXT_LLM_MODEL_NAME:-gemini-2.5-flash})"
fi
echo -e "  ${GREEN}► Database Engine:${NC}   ${DATABASE_URL}"
echo -e "  ${GREEN}► FastAPI Backend:${NC}   http://localhost:8000 (Swagger: http://localhost:8000/docs)"
echo -e "  ${GREEN}► React Frontend:${NC}    http://localhost:5173"
if [ "$START_TUNNEL" = true ]; then
    echo -e "  ${GREEN}► Public Tunnel:${NC}     (Initializing secure HTTPS URL...)"
fi
echo ""
echo -e "${BOLD}Pre-Registered Demo Credentials:${NC}"
echo -e "  👤 ${CYAN}Patient:${NC} Ramesh Sharma  | ABHA: ${BOLD}14-1234-5678-9012${NC} | OTP: ${BOLD}123456${NC}"
echo -e "  🩺 ${CYAN}Doctor:${NC}  Dr. Priya Nair | ABHA: ${BOLD}14-9988-7766-5544${NC} | OTP: ${BOLD}123456${NC}"
echo ""
echo -e "${YELLOW}Press [Ctrl+C] to stop all services.${NC}"
echo "------------------------------------------------------------"

TUNNEL_LOG="/tmp/sanjivani_tunnel_$$.log"

# Function to clean up all background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down Sanjivani services...${NC}"
    if [ -n "$TUNNEL_PID" ]; then
        echo "Stopping Public Tunnel (PID: $TUNNEL_PID)..."
        kill "$TUNNEL_PID" 2>/dev/null || true
    fi
    if [ -f "$TUNNEL_LOG" ]; then
        rm -f "$TUNNEL_LOG" 2>/dev/null || true
    fi
    if [ -n "$VLLM_PID" ]; then
        echo "Stopping vLLM server (PID: $VLLM_PID)..."
        kill "$VLLM_PID" 2>/dev/null || true
    fi
    if [ -n "$BACKEND_PID" ]; then
        echo "Stopping FastAPI backend (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        echo "Stopping Vite frontend (PID: $FRONTEND_PID)..."
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    pkill -P $$ 2>/dev/null || true
    pkill -9 -f "VLLM::EngineCore" 2>/dev/null || true
    pkill -f "vllm.entrypoints.openai.api_server" 2>/dev/null || true
    pkill -f "cloudflared" 2>/dev/null || true
    wait 2>/dev/null || true
    echo -e "${GREEN}✓ All services stopped cleanly.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 5. Start vLLM Model Server if enabled
if [ "$START_VLLM" = true ]; then
    echo -e "${CYAN}Launching vLLM server for '${VLLM_MODEL}' on port ${VLLM_PORT} (4-bit quantization)...${NC}"
    export PYTORCH_CUDA_ALLOC_CONF="expandable_segments:True"
    export VLLM_USE_FLASHINFER_SAMPLER=0
    "$PYTHON_BIN" -m vllm.entrypoints.openai.api_server \
        --model "$VLLM_MODEL" \
        --port "$VLLM_PORT" \
        --quantization "$VLLM_QUANT" \
        --load-format "$VLLM_QUANT" \
        --gpu-memory-utilization "$VLLM_GPU_UTIL" \
        --max-model-len "$VLLM_MAX_LEN" &
    VLLM_PID=$!
fi

# 6. Start FastAPI Backend
"$PYTHON_BIN" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 7. Start Vite Frontend
(cd "$ROOT_DIR/frontend" && npm run dev -- --host) &
FRONTEND_PID=$!

# 8. Start Public Tunnel if enabled
if [ "$START_TUNNEL" = true ]; then
    CLOUDFLARED_BIN=""
    if command -v cloudflared &>/dev/null; then
        CLOUDFLARED_BIN="$(command -v cloudflared)"
    elif [ -f "$ROOT_DIR/.bin/cloudflared" ]; then
        CLOUDFLARED_BIN="$ROOT_DIR/.bin/cloudflared"
    else
        echo -e "${YELLOW}Downloading portable cloudflared binary to .bin/...${NC}"
        mkdir -p "$ROOT_DIR/.bin"
        if curl -sL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o "$ROOT_DIR/.bin/cloudflared"; then
            chmod +x "$ROOT_DIR/.bin/cloudflared"
            CLOUDFLARED_BIN="$ROOT_DIR/.bin/cloudflared"
        fi
    fi

    if [ -n "$CLOUDFLARED_BIN" ]; then
        "$CLOUDFLARED_BIN" tunnel --url http://localhost:5173 > "$TUNNEL_LOG" 2>&1 &
        TUNNEL_PID=$!
        (
            for i in {1..30}; do
                if [ -f "$TUNNEL_LOG" ]; then
                    URL=$(grep -o 'https://[a-zA-Z0-9-]*\.trycloudflare\.com' "$TUNNEL_LOG" | head -n 1 || true)
                    if [ -n "$URL" ]; then
                        echo -e "\n  ${GREEN}${BOLD}🌐 PUBLIC URL (Share with anyone):${NC} ${CYAN}${BOLD}${URL}${NC}\n"
                        break
                    fi
                fi
                sleep 0.5
            done
        ) &
    elif command -v npx &>/dev/null; then
        echo -e "${CYAN}Starting public tunnel via npx localtunnel (:5173)...${NC}"
        npx localtunnel --port 5173 &
        TUNNEL_PID=$!
    fi
fi

# Wait for all processes
wait
