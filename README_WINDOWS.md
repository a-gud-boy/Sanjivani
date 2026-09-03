# Running Sanjivani on Windows 🪟

This guide provides step-by-step instructions for running **Sanjivani (संजीवनी)** on Windows 10/11.

---

## ⚡ Which Setup Method Should You Choose?

| Method | Best For | Local GPU / vLLM Support | Setup Effort |
| :--- | :--- | :--- | :--- |
| **[Method 1: Native Windows (PowerShell)](#method-1-native-windows-powershell--cmd)** | Quickest setup, using Cloud AI (Gemini / OpenAI) or built-in fallback | ❌ No (vLLM is Linux-only) | 🟢 5 Minutes |
| **[Method 2: WSL 2 (Ubuntu on Windows)](#method-2-wsl-2-recommended-for-local-vllm--gpu)** | **Recommended for local GPU**, running local MedGemma via vLLM with NVIDIA CUDA | ✅ Yes (Full CUDA acceleration) | 🟡 10 Minutes |
| **[Method 3: VS Code Dev Container](#method-3-docker--vs-code-dev-container)** | Zero-install isolated Docker environment | 🟡 Yes (with nvidia-container-toolkit) | 🟡 10 Minutes |

---

## Method 1: Native Windows (PowerShell / CMD)

Use this method if you want to run the FastAPI backend and React frontend directly on Windows without virtualization.

### Step 1: Install Prerequisites

1. **Python 3.12**:
   - Download from [python.org](https://www.python.org/downloads/windows/) or the Microsoft Store.
   - ⚠️ **IMPORTANT**: During installation, check the box: **"Add python.exe to PATH"**.
2. **Node.js (LTS)**:
   - Download from [nodejs.org](https://nodejs.org/). This includes `npm`.
3. **Git for Windows**:
   - Download from [git-scm.com](https://git-scm.com/download/win).

---

### Step 2: Open PowerShell & Allow Script Execution

Windows restricts running PowerShell scripts by default. Open **PowerShell** and run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
*(Press `Y` and Enter when prompted).*

---

### Step 3: Create & Activate Python Virtual Environment

Navigate to the project directory:

```powershell
cd "path\to\Sanjivani"

# Create a virtual environment named .venv
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1
```

> **Note for Command Prompt (`cmd.exe`) users**: Run `.\.venv\Scripts\activate.bat` instead.

---

### Step 4: Install Python & Node.js Dependencies

```powershell
# Upgrade pip and install backend packages
pip install --upgrade pip
pip install -r requirements.txt

# Install frontend dependencies
cd frontend
npm install
cd ..
```

---

### Step 5: Configure Environment Variables & Free Gemini API Key

1. If `.env` does not already exist, copy the template:
   ```powershell
   Copy-Item .env.example .env
   ```

2. **Get a Free Google Gemini API Key** (Takes ~1 minute, no credit card needed):
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey).
   - Sign in with your Google / Gmail account.
   - Click **"Create API key"** -> **"Create API key in new project"**.
   - Copy the generated key (starts with `AIzaSy...`).

3. Open `.env` in Notepad or VS Code:
   ```powershell
   notepad .env
   ```
   Paste your key on the `GEMINI_API_KEY` line:
   ```ini
   GEMINI_API_KEY=AIzaSyYourCopiedKeyHere
   GEMINI_MODEL_NAME=gemini-2.5-flash
   ```
   Save and close Notepad.

---

### Step 6: Launch Sanjivani with `run.py`

Run the cross-platform Python runner:

```powershell
python run.py --no-vllm
```

> **Why `--no-vllm`?**
> The `vLLM` inference library relies on Linux-specific kernel interfaces and does not run natively on Windows bare-metal.
> Using `--no-vllm` starts:
> 1. SQLite database sync & demo data seeding
> 2. FastAPI backend on `http://localhost:8000`
> 3. React Vite frontend on `http://localhost:5173`
> 4. Cloud AI (Gemini Flash) or the resilient clinical reasoning engine

---

## Method 2: WSL 2 (Recommended for Local vLLM & GPU)

If you have an **NVIDIA GPU** and want to run the local `google/medgemma-1.5-4b-it` model on port `8001`, **WSL 2 (Windows Subsystem for Linux)** gives you native Linux performance on Windows.

### Step 1: Install WSL 2

Open PowerShell as Administrator:
```powershell
wsl --install
```
Restart your computer if prompted. This will install Ubuntu.

---

### Step 2: Setup in Ubuntu (WSL)

Open the **Ubuntu** terminal from your Start Menu:

```bash
# Update Ubuntu packages
sudo apt update && sudo apt install -y python3 python3-pip python3-venv nodejs npm git

# Navigate to your project folder on your Windows drive (e.g. C: or D:)
cd /mnt/c/Users/YourUsername/path/to/Sanjivani

# Make the start script executable
chmod +x start.sh

# Run the unified start script
./start.sh
```

If you don't have an NVIDIA GPU inside WSL, run:
```bash
./start.sh --no-vllm
```

Your browser on Windows can directly access the servers at:
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend**: [http://localhost:8000](http://localhost:8000)

---

## Method 3: Docker & VS Code Dev Container

If you use Docker Desktop:

1. Install **Docker Desktop for Windows** (with the WSL 2 backend enabled).
2. Install **VS Code** with the **Dev Containers** extension (`ms-vscode-remote.remote-containers`).
3. Open the `Sanjivani` folder in VS Code.
4. When prompted in the bottom-right corner, click **"Reopen in Container"** (or press `F1` and select `Dev Containers: Reopen in Container`).
5. VS Code will automatically build the container with Python 3.12, Node.js LTS, and all dependencies pre-installed.
6. Open the integrated terminal and run:
   ```bash
   python run.py --no-vllm
   ```

---

## 🔑 Demo Login Accounts

Once the application is running at [http://localhost:5173](http://localhost:5173):

| Role | Name | ABHA ID | Sandbox OTP | Features |
| :--- | :--- | :--- | :--- | :--- |
| **Patient** | Ramesh Sharma | `14-1234-5678-9012` | `123456` | Dashboard, medications, intake consultations |
| **Doctor** | Dr. Priya Nair | `14-9988-7766-5544` | `654321` | Clinical review portal, patient triage |

You can also click the **"Demo Patient"** or **"Demo Doctor"** one-click buttons on the login card to auto-fill these credentials.

---

## 🛠️ Windows Troubleshooting & FAQs

### 1. `running scripts is disabled on this system` (PowerShell error)
**Fix:** Run PowerShell as Administrator or current user and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. `'python' is not recognized as an internal or external command`
**Fix:** Python was installed without adding it to the system PATH.
1. Press `Win + S` and search for **"Edit the system environment variables"**.
2. Click **Environment Variables...**
3. Under *User variables*, select `Path` and click **Edit**.
4. Add your Python installation path (typically `C:\Users\<User>\AppData\Local\Programs\Python\Python312` and `...\Python312\Scripts`).

### 3. Port 8000 or 5173 already in use
**Fix:** Check which process is occupying the port and terminate it:
```powershell
# Check port 8000
netstat -ano | findstr :8000

# Terminate process by PID
taskkill /PID <PID_NUMBER> /F
```

### 4. Git Long Paths Error (`Filename too long`)
**Fix:** Enable long path support in Git:
```powershell
git config --system core.longpaths true
```

### 5. Line Ending (CRLF / LF) Warnings
If you modify shell scripts or `.env` on Windows, ensure your code editor preserves **LF** (Unix) line endings instead of converting to Windows **CRLF**.

---

## 🧪 Running Tests on Windows

With your virtual environment activated:

```powershell
# Run backend test suite
pytest tests/

# Test frontend build
cd frontend
npm run build
cd ..
```
