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
setup-python:
    python -m venv .venv
    .venv\Scripts\pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
    .venv\Scripts\pip install whisperx "pyannote-audio==4.0.4"

# Set up Python venv for NeMo/Parakeet path (run INSTEAD of setup-python if spike passes)
setup-python-nemo:
    python -m venv .venv
    .venv\Scripts\pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu128
    .venv\Scripts\pip install triton-windows
    .venv\Scripts\pip install "nemo_toolkit[asr]"

# Start both services (backend in background, frontend in foreground)
dev:
    #!/usr/bin/env bash
    node --experimental-strip-types packages/backend/src/index.ts &
    BACKEND_PID=$!
    trap "kill $BACKEND_PID 2>/dev/null" EXIT
    cd packages/frontend && npx vite --host
