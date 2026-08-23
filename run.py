#!/usr/bin/env python3
"""
Sanjivani Dev Runner
Starts both the FastAPI backend and Vite frontend concurrently.
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

    if not (ROOT_DIR / ".env").exists() and (ROOT_DIR / ".env.example").exists():
        print("⚠ .env not found. Copying .env.example to .env...")
        with open(ROOT_DIR / ".env.example", "r") as src, open(ROOT_DIR / ".env", "w") as dst:
            dst.write(src.read())

    if not (FRONTEND_DIR / "node_modules").exists():
        print("⚠ frontend/node_modules not found. Running npm install...")
        subprocess.run(["npm", "install"], cwd=str(FRONTEND_DIR), check=True)

    print("\nStarting Services:")
    print("  ► FastAPI Backend:  http://localhost:8000 (Swagger: http://localhost:8000/docs)")
    print("  ► Vite Frontend:    http://localhost:5173")
    print("\nPress [Ctrl+C] to stop all services.\n" + "-" * 60)

    procs = []

    # Backend
    backend_cmd = [py_exe, "-m", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
    p_backend = subprocess.Popen(backend_cmd, cwd=str(ROOT_DIR))
    procs.append(p_backend)

    # Frontend
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
