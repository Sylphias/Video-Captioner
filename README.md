# Eigen Video Editor

A subtitle editor and renderer for video. Transcribe speech, edit timing and text, style per-speaker captions, and render hardcoded subtitles using Remotion.

## Architecture

Monorepo with four packages:

- **`packages/backend`** -- Express API server handling jobs, file management, waveform generation, and transcription orchestration
- **`packages/frontend`** -- React + Vite UI with timeline, text editor, animation editor, and preview
- **`packages/remotion-composition`** -- Remotion composition for rendering subtitle overlays onto video
- **`packages/shared-types`** -- Shared TypeScript types across packages

Transcription runs via a Python sidecar (`scripts/transcribe.py`) using WhisperX with forced alignment and optional pyannote speaker diarization.

## Prerequisites

- **Node.js** >= 20
- **Python** >= 3.11 (for transcription)
- **[just](https://github.com/casey/just)** (command runner)
- **[uv](https://docs.astral.sh/uv/)** (Python package manager)
- **FFmpeg** (for audio/video processing)
- **HuggingFace token** (optional, for speaker diarization) -- set `HUGGINGFACE_TOKEN` in `.env`

### GPU support

The transcription script auto-detects the best available device:

| Device | Backend | Compute type | Batch size | Notes |
|--------|---------|-------------|------------|-------|
| NVIDIA GPU | CUDA | float16 | 16 | Fastest -- requires CUDA toolkit |
| Apple Silicon | MPS | float32 | 4 | Works on M1/M2/M3/M4 Macs |
| CPU | CPU | int8 | 4 | Slowest, works everywhere |

## Setup

```bash
# Install JS dependencies
just install-deps

# Set up Python environment (pick one):
just setup-python-cuda    # NVIDIA GPU (Linux/WSL)
just setup-python-mac     # Apple Silicon Mac
just setup-python-cpu     # CPU-only fallback

# Build shared libraries
just build-libs
```

## Development

```bash
# Start both backend (port 3001) and frontend (port 5173)
just dev

# Or run them separately:
just backend
just frontend
```

## Transcription

Transcription happens automatically when a video is imported through the UI. The backend spawns `scripts/transcribe.py` which runs:

1. WhisperX `large-v3` speech-to-text
2. wav2vec2 forced alignment for word-level timestamps
3. pyannote speaker diarization (if HuggingFace token is provided)
