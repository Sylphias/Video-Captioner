---
phase: 15-desktop-app-port
plan: 04
subsystem: infra
tags: [python, whisperx, cuda, windows, uv, verification]

requires:
  - phase: 15-desktop-app-port
    provides: "15-03 Windows CUDA DLL registration + setup-python-windows recipe"
provides:
  - "Go signal for Plan 06: native-Windows uv resolve + CUDA transcription verified on RTX 4080"
affects: [15-06 in-app first-run setup]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "Native-Windows path is GO — Plan 03 needs no revision"

requirements-completed: [D-06, D-07]
---

# Plan 15-04 Summary: Native-Windows GPU Verification

**Outcome: PASS — Plan 06 unblocked.**

## Environment

- Windows 11 Pro 10.0.26200, NVIDIA GeForce RTX 4080 (16 GB), driver 617.14
- uv 0.12.6, just 1.32.0, ffmpeg 7.1 (gyan.dev essentials) on PATH
- uv selected CPython 3.12.8 (prior WSL venv was 3.11.13)
- Prior WSL/Linux `.venv` preserved as `.venv-wsl` (locally excluded via `.git/info/exclude`)

## Results

| Check | Result |
|-------|--------|
| `just setup-python-windows` resolve/install (Open Q1) | Clean — exit 0, no index/dependency conflict |
| torch build after whisperx install | `2.8.0+cu128` (not clobbered by a CPU wheel) |
| `torch.cuda.is_available()` | `True`, device `NVIDIA GeForce RTX 4080` |
| whisperx import | OK (whisperx 3.8.6, ctranslate2 4.8.2, faster-whisper 1.2.1, pyannote-audio 4.0.7) |
| cuDNN/cuBLAS DLL errors (Pitfall 1) | None — nvidia-cudnn-cu12 9.27, nvidia-cublas-cu12 12.9 |
| Device path | `cuda` / float16 (batch 16), not CPU/int8 fallback |
| 30s clip transcription | Exit 0, 97 word-level entries with start/end/confidence, accurate text |
| Wall time (cold-ish, model cached) | 31.9s end-to-end incl. model load + wav2vec2 alignment |

## Observations (non-blocking)

- **torchcodec fails to load** (`libtorchcodec_core{4..7}.dll` not found) — pyannote warns that built-in file decoding is unavailable. Harmless today: transcribe.py passes whisperx an in-memory array, and diarize.py already preloads audio via soundfile into a `{"waveform", "sample_rate"}` dict. Any future code that hands pyannote a file *path* will break on Windows.
- `hf_xet` not installed — HF downloads fall back to plain HTTP (slower first-run model download; consider adding for Plan 06/07 model-download UX).
- Diarization (`diarize.py`) not exercised here — needs a HuggingFace token; out of scope for this plan, covered by Plan 09 E2E UAT.
- First-ever run downloads `large-v3` + alignment models; first test took ~122s largely due to downloads.
