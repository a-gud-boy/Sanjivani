#!/usr/bin/env python3
"""
Sanjivani Dev Runner
Starts:
  1. vLLM Local Model Server (Optional: google/medgemma-1.5-4b-it on :8001)
  2. FastAPI Backend (:8000)
  3. Vite Frontend (:5173)
Handles graceful shutdown on Ctrl+C (SIGINT / SIGTERM).
"""

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


def main():
    print("=" * 60)
    print("    Sanjivani (संजीवनी) - Clinical Intake & Digitization")
    print("=" * 60)

    py_exe = get_python_executable()
    print(f"✓ Python runtime: {py_exe}")

    env_file = ROOT_DIR / ".env"
    if not env_file.exists() and (ROOT_DIR / ".env.example").exists():
        print("⚠ .env not found. Copying .env.example to .env...")
        with open(ROOT_DIR / ".env.example", "r") as src, open(env_file, "w") as dst:
            dst.write(src.read())

    if not (FRONTEND_DIR / "node_modules").exists():
        print("⚠ frontend/node_modules not found. Running npm install...")
        subprocess.run(["npm", "install"], cwd=str(FRONTEND_DIR), check=True)

    # Check for vLLM flag (Enabled by default)
    start_vllm = True
    if "--no-vllm" in sys.argv or "--skip-vllm" in sys.argv:
        start_vllm = False
    elif env_file.exists():
        try:
            with open(env_file, "r") as f:
                content = f.read()
                if "START_VLLM=false" in content:
                    start_vllm = False
        except Exception:
            pass

    vllm_model = os.getenv("VLLM_MODEL", "google/medgemma-1.5-4b-it")
    vllm_port = os.getenv("VLLM_PORT", "8001")
    vllm_gpu_util = os.getenv("VLLM_GPU_UTIL", "0.88")
    vllm_max_len = os.getenv("VLLM_MAX_LEN", "4096")
    vllm_quant = os.getenv("VLLM_QUANT", "bitsandbytes")

    print("\nStarting Services:")
    if start_vllm:
        print(f"  ► vLLM Model Server: http://localhost:{vllm_port}/v1 (Model: {vllm_model}, 4-bit BnB)")
    print("  ► FastAPI Backend:   http://localhost:8000 (Swagger: http://localhost:8000/docs)")
    print("  ► Vite Frontend:     http://localhost:5173")
    print("\nPress [Ctrl+C] to stop all services.\n" + "-" * 60)

    procs = []

    # 1. vLLM Server if enabled
    if start_vllm:
        print(f"Launching vLLM server for '{vllm_model}' on port {vllm_port} (4-bit quantization)...")
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
