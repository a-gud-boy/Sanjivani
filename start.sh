#!/usr/bin/env bash

# ==============================================================================
# Sanjivani - Unified Dev Server Startup Script
# Starts:
#   1. vLLM Local Model Server (Optional: google/medgemma-1.5-4b-it on :8001)
#   2. FastAPI Clinical Backend (Port :8000)
#   3. React Vite Frontend (Port :5173)
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
    else
        echo -e "${RED}✗ Error: .env file missing in root directory.${NC}"
    fi
fi

# 3. Check frontend node_modules
if [ ! -d "$ROOT_DIR/frontend/node_modules" ]; then
    echo -e "${YELLOW}⚠ frontend/node_modules not found. Running npm install...${NC}"
    (cd "$ROOT_DIR/frontend" && npm install)
fi

# 4. Check if vLLM Local Server should be started (Enabled by default)
START_VLLM=true
for arg in "$@"; do
    if [ "$arg" == "--no-vllm" ] || [ "$arg" == "--skip-vllm" ]; then
        START_VLLM=false
    fi
done

# Check if .env explicitly disables vLLM
if [ "$START_VLLM" = true ] && [ -f "$ROOT_DIR/.env" ]; then
    if grep -qE "^START_VLLM=false" "$ROOT_DIR/.env"; then
        START_VLLM=false
    fi
fi

if [ -f "$ROOT_DIR/.env" ]; then
    ENV_VLLM_MODEL=$(grep -E "^(VLLM_MODEL|TEXT_LLM_MODEL_NAME)=" "$ROOT_DIR/.env" | head -n1 | cut -d '=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r')
    if [ -n "$ENV_VLLM_MODEL" ]; then
        VLLM_MODEL="$ENV_VLLM_MODEL"
    fi
fi

VLLM_MODEL="${VLLM_MODEL:-google/medgemma-1.5-4b-it}"
VLLM_PORT="${VLLM_PORT:-8001}"
VLLM_GPU_UTIL="${VLLM_GPU_UTIL:-0.88}"
VLLM_MAX_LEN="${VLLM_MAX_LEN:-4096}"
VLLM_QUANT="${VLLM_QUANT:-bitsandbytes}"

echo ""
echo -e "${BOLD}Starting Services:${NC}"
if [ "$START_VLLM" = true ]; then
    echo -e "  ${GREEN}► vLLM Model Server:${NC} http://localhost:${VLLM_PORT}/v1 (Model: ${VLLM_MODEL}, 4-bit BnB)"
fi
echo -e "  ${GREEN}► FastAPI Backend:${NC}   http://localhost:8000 (Swagger: http://localhost:8000/docs)"
echo -e "  ${GREEN}► Vite Frontend:${NC}     http://localhost:5173"
echo ""
echo -e "${YELLOW}Press [Ctrl+C] to stop all services.${NC}"
echo "------------------------------------------------------------"

# Function to clean up background processes on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down Sanjivani services...${NC}"
    if [ -n "$VLLM_PID" ]; then
        echo "Stopping vLLM server (PID: $VLLM_PID)..."
        kill "$VLLM_PID" 2>/dev/null || true
    fi
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

# Start vLLM Model Server if enabled
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

# Start FastAPI Backend
"$PYTHON_BIN" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start Vite Frontend
(cd "$ROOT_DIR/frontend" && npm run dev -- --host) &
FRONTEND_PID=$!

# Wait for all processes
wait
