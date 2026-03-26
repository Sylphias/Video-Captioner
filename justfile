# Eigen Video Editor

set dotenv-load

# Install all workspace dependencies
install-deps:
    npm install

# Start the backend server (port 3001)
backend:
    node --experimental-strip-types packages/backend/src/index.ts

# Start the frontend dev server (port 5173)
frontend:
    cd packages/frontend && npx vite --host

# Set up Python venv with CUDA WhisperX + pyannote fallback dependencies (per D-02)
# (Native Windows — fallback only; NeMo requires WSL)
setup-python:
    python -m venv .venv
    .venv\Scripts\pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
    .venv\Scripts\pip install whisperx "pyannote-audio==4.0.4"

# Set up WSL Python venv for NeMo/Parakeet TDT transcription + MSDD diarization (Option B — WSL path)
# NeMo has no native Windows support (triton dependency has no Windows wheel).
# Run this from the project root in a normal Windows terminal — it shells into WSL to create the venv.
# The venv is placed at /root/.venv-wsl inside WSL (accessible to WSL Python spawned by Node.js).
setup-python-wsl:
    wsl bash -c "python3 -m venv /root/.venv-wsl && /root/.venv-wsl/bin/pip install --upgrade pip && /root/.venv-wsl/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128 && /root/.venv-wsl/bin/pip install 'nemo_toolkit[asr]' 'pyannote-audio==4.0.4'"

# Validate the WSL venv: confirm CUDA and NeMo ASR importable
check-wsl-env:
    wsl /root/.venv-wsl/bin/python3 -c "import torch; print('CUDA:', torch.cuda.is_available()); import nemo.collections.asr; print('NeMo ASR: OK')"

# Run the Parakeet TDT spike inside WSL (validates install + CUDA + model load)
spike-parakeet:
    wsl /root/.venv-wsl/bin/python3 scripts/spike_parakeet.py

# Start both services (backend in background, frontend in foreground)
dev:
    #!/usr/bin/env bash
    node --experimental-strip-types packages/backend/src/index.ts &
    BACKEND_PID=$!
    trap "kill $BACKEND_PID 2>/dev/null" EXIT
    cd packages/frontend && npx vite --host
