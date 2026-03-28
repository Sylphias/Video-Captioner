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

# Set up Python venv with uv — CUDA PyTorch + NeMo (Parakeet TDT) + pyannote diarization
setup-python:
    uv venv .venv
    uv pip install --python .venv/bin/python torch torchaudio --index-url https://download.pytorch.org/whl/cu128
    uv pip install --python .venv/bin/python 'nemo_toolkit[asr]' 'pyannote-audio==4.0.4'

# Validate the venv: confirm CUDA and NeMo ASR importable
check-env:
    .venv/bin/python3 -c "import torch; print('CUDA:', torch.cuda.is_available()); import nemo.collections.asr; print('NeMo ASR: OK')"

# Run the Parakeet TDT spike (validates install + CUDA + model load)
spike-parakeet:
    .venv/bin/python3 scripts/spike_parakeet.py

# Build shared-types and remotion-composition so downstream packages see updated types/exports
build-libs:
    cd packages/shared-types && npx tsc --build
    cd packages/remotion-composition && npx tsc --build

# Start both services (rebuild libs first, then backend + frontend)
dev: build-libs
    bash -c 'node --experimental-strip-types packages/backend/src/index.ts & BACKEND_PID=$!; trap "kill $BACKEND_PID 2>/dev/null" EXIT; cd packages/frontend && npx vite --host'
