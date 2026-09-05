#!/usr/bin/env python3
"""
Sanjivani Dev Runner
Unified cross-platform launcher for:
  1. Local vLLM Model Server (Optional: google/medgemma-1.5-4b-it on :8001)
  2. Database Schema Sync & Pre-seeded ABHA Accounts
  3. FastAPI Clinical Backend (:8000)
  4. React Vite Frontend (:5173)

Supports both local virtualenvs (sihvenv312, .venv) and Dev Containers.
Handles graceful shutdown on Ctrl+C (SIGINT / SIGTERM).
"""

import argparse
import asyncio
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = ROOT_DIR / "frontend"


def get_python_executable() -> str:
    venv_candidates = [
        ROOT_DIR / "sihvenv312" / "bin" / "python",
        ROOT_DIR / "sihvenv312" / "Scripts" / "python.exe",
        ROOT_DIR / ".venv" / "bin" / "python",
        ROOT_DIR / ".venv" / "Scripts" / "python.exe",
        ROOT_DIR / "venv" / "bin" / "python",
        ROOT_DIR / "venv" / "Scripts" / "python.exe",
    ]
    for candidate in venv_candidates:
        if candidate.exists():
            return str(candidate)
    return sys.executable


def load_env_file(env_path: Path):
    """Load environment variables from .env file into os.environ."""
    if not env_path.exists():
        return
    try:
        from dotenv import load_dotenv
        load_dotenv(env_path)
    except ImportError:
        # Fallback basic parser if python-dotenv is not yet available
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k not in os.environ:
                    os.environ[k] = v


def main():
    parser = argparse.ArgumentParser(description="Sanjivani Dev Runner")
    parser.add_argument(
        "--no-vllm", "--skip-vllm",
        action="store_true",
        help="Skip starting the local vLLM server (runs only Backend + Frontend)"
    )
    parser.add_argument(
        "--reset-db", "--clean-db",
        action="store_true",
        help="Reset the local SQLite database before startup"
    )
    args = parser.parse_args()

    # If invoked by a different python (e.g. system python) but a project venv exists,
    # re-execute using the venv's python executable so all packages are available.
    py_exe = get_python_executable()
    try:
        if Path(sys.executable).resolve() != Path(py_exe).resolve():
            os.execv(py_exe, [py_exe] + sys.argv)
    except Exception:
        pass

    print("=" * 60)
    print("    Sanjivani (संजीवनी) - Clinical Intake & Digitization")
    print("=" * 60)
    print(f"✓ Python runtime: {py_exe}")

    # 1. Check & copy .env
    env_file = ROOT_DIR / ".env"
    if not env_file.exists() and (ROOT_DIR / ".env.example").exists():
        print("⚠ .env not found. Copying .env.example to .env...")
        with open(ROOT_DIR / ".env.example", "r", encoding="utf-8") as src, open(env_file, "w", encoding="utf-8") as dst:
            dst.write(src.read())

    load_env_file(env_file)

    # 2. Check frontend dependencies
    if not (FRONTEND_DIR / "node_modules").exists():
        print("⚠ frontend/node_modules not found. Running npm install...")
        subprocess.run(["npm", "install"], cwd=str(FRONTEND_DIR), check=True)

    # 3. Handle Database Reset
    db_file = ROOT_DIR / "sanjivani.db"
    if args.reset_db and db_file.exists():
        print("⚠ Resetting local database (sanjivani.db)...")
        try:
            db_file.unlink()
        except Exception as e:
            print(f"Warning: Could not remove {db_file}: {e}")

    # 4. Synchronize Database & Seed Demo Accounts
    print("✓ Initializing Database & Pre-Seeding Demo Accounts...")
    try:
        from app.db.seed import init_db, seed_demo_data

        async def init():
            await init_db()
            await seed_demo_data()

        asyncio.run(init())
    except Exception as e:
        print(f"⚠ Warning initializing database: {e}")

    # 5. Determine vLLM configuration
    start_vllm = not args.no_vllm

    # Check if .env explicitly disables vLLM or sets cloud AI
    if os.getenv("START_VLLM", "").lower() == "false":
        start_vllm = False

    vllm_model = os.getenv("VLLM_MODEL") or os.getenv("TEXT_LLM_MODEL_NAME") or "google/medgemma-1.5-4b-it"
    has_cloud_ai = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    if has_cloud_ai or any(k in vllm_model.lower() for k in ["gemini", "gemma-2"]):
        # If cloud AI is configured, skip local GPU server by default unless forced
        if not args.no_vllm and os.getenv("FORCE_VLLM", "").lower() != "true":
            start_vllm = False

    vllm_port = os.getenv("VLLM_PORT", "8001")
    vllm_gpu_util = os.getenv("VLLM_GPU_UTIL", "0.85")
    vllm_max_len = os.getenv("VLLM_MAX_LEN", "4096")
    vllm_quant = os.getenv("VLLM_QUANT", "bitsandbytes")
    database_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./sanjivani.db")

    print("\nStarting Services:")
    if start_vllm:
        print(f"  ► vLLM Model Server: http://localhost:{vllm_port}/v1 (Model: {vllm_model}, 4-bit BnB)")
    else:
        model_display = os.getenv("TEXT_LLM_MODEL_NAME", "Google Cloud Gemini")
        print(f"  ► Clinical AI Model: {model_display} (Local vLLM skipped)")
    print(f"  ► Database Engine:   {database_url}")
    print("  ► FastAPI Backend:   http://localhost:8000 (Swagger: http://localhost:8000/docs)")
    print("  ► React Frontend:    http://localhost:5173")

    print("\nAuthentication:")
    print("  ► Open the frontend and click 'Register' to self-enroll and generate your ABHA ID.")
    print("  ► Simulated OTP is 123456 for all enrolled accounts.")
    print("\nPress [Ctrl+C] to stop all services.\n" + "-" * 60)

    procs = []

    # 1. vLLM Server if enabled
    if start_vllm:
        print(f"Launching vLLM server for '{vllm_model}' on port {vllm_port}...")
        vllm_env = os.environ.copy()
        vllm_env["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
        vllm_env["VLLM_USE_FLASHINFER_SAMPLER"] = "0"
        vllm_cmd = [
            py_exe,
            "-m",
            "vllm.entrypoints.openai.api_server",
            "--model",
            vllm_model,
            "--port",
            vllm_port,
            "--quantization",
            vllm_quant,
            "--load-format",
            vllm_quant,
            "--gpu-memory-utilization",
            vllm_gpu_util,
            "--max-model-len",
            vllm_max_len,
        ]
        p_vllm = subprocess.Popen(vllm_cmd, cwd=str(ROOT_DIR), env=vllm_env)
        procs.append(p_vllm)

    # 2. FastAPI Backend
    backend_cmd = [py_exe, "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
    p_backend = subprocess.Popen(backend_cmd, cwd=str(ROOT_DIR))
    procs.append(p_backend)

    # 3. Frontend
    frontend_cmd = ["npm", "run", "dev", "--", "--host"]
    p_frontend = subprocess.Popen(frontend_cmd, cwd=str(FRONTEND_DIR), shell=(sys.platform == "win32"))
    procs.append(p_frontend)

    def shutdown(signum=None, frame=None):
        print("\n\nShutting down Sanjivani services...")
        for p in procs:
            if p.poll() is None:
                p.terminate()
        for p in procs:
            try:
                p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                p.kill()
        print("✓ All services stopped cleanly.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            for p in procs:
                ret = p.poll()
                if ret is not None:
                    print(f"\nA process exited with code {ret}. Shutting down remaining services...")
                    shutdown()
            time.sleep(0.5)
    except (KeyboardInterrupt, SystemExit):
        shutdown()


if __name__ == "__main__":
    main()
