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

# Set up Python venv — NVIDIA GPU (CUDA)
setup-python-cuda:
    uv venv .venv
    uv pip install --python .venv/bin/python torch torchaudio --index-url https://download.pytorch.org/whl/cu128
    uv pip install --python .venv/bin/python whisperx 'pyannote-audio>=3.1'

# Set up Python venv — Apple Silicon Mac (MPS)
setup-python-mac:
    uv venv .venv
    uv pip install --python .venv/bin/python torch torchaudio
    uv pip install --python .venv/bin/python whisperx 'pyannote-audio>=3.1'

# Set up Python venv — CPU only
setup-python-cpu:
    uv venv .venv
    uv pip install --python .venv/bin/python torch torchaudio --index-url https://download.pytorch.org/whl/cpu
    uv pip install --python .venv/bin/python whisperx 'pyannote-audio>=3.1'

# Validate the venv: confirm torch + whisperx importable, show detected device
check-env:
    .venv/bin/python3 -c "import torch; print('CUDA:', torch.cuda.is_available()); print('MPS:', torch.backends.mps.is_available()); import whisperx; print('WhisperX: OK')"

# Build shared-types and remotion-composition so downstream packages see updated types/exports
build-libs:
    cd packages/shared-types && npx tsc --build
    cd packages/remotion-composition && npx tsc --build

# Start both services (rebuild libs first, then backend + frontend)
dev: build-libs
    bash -c 'node --experimental-strip-types packages/backend/src/index.ts & BACKEND_PID=$!; trap "kill $BACKEND_PID 2>/dev/null" EXIT; cd packages/frontend && npx vite --host'
