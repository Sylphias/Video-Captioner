---
phase: 15-desktop-app-port
plan: 03
subsystem: infra
tags: [python, whisperx, ctranslate2, cuda, windows, uv, pytorch]

requires:
  - phase: 15-desktop-app-port
    provides: "15-CONTEXT D-06/D-07 decisions (native Windows, no WSL)"
provides:
  - "register_windows_cuda_dlls() in scripts/transcribe.py and scripts/diarize.py"
  - "HF_HUB_DISABLE_SYMLINKS=1 default (no Developer Mode requirement)"
  - "just setup-python-windows / check-env-windows recipes"
  - "pyproject.toml explicit pytorch cu128 uv index (win32-gated)"
affects: [15-04 windows verification, 15-06 in-app first-run setup]

actuals:
  tokens: 2400
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Windows-only code paths guarded by sys.platform / uv markers so Linux/WSL path is unchanged"

key-files:
  created: []
  modified:
    - scripts/transcribe.py
    - scripts/diarize.py
    - justfile
    - pyproject.toml

key-decisions:
  - "torch/torchaudio source mapping to the cu128 index is gated with marker sys_platform == 'win32' so Linux/WSL/mac resolution is unchanged"
  - "nvidia-cudnn-cu12 and nvidia-cublas-cu12 are installed explicitly in the Windows recipe (not via pyproject, to avoid further uv.lock churn)"

requirements-completed: [D-06, D-07]

coverage:
  - id: D1
    description: "Both scripts register nvidia cudnn/cublas DLL dirs on win32 before torch/whisperx import, no-op elsewhere"
    requirement: "D-06"
    verification:
      - kind: other
        ref: "python3 -m py_compile scripts/transcribe.py scripts/diarize.py + grep add_dll_directory"
        status: pass
    human_judgment: true
    rationale: "Actual DLL resolution and GPU transcription can only be confirmed on native Windows (Plan 04)"
  - id: D2
    description: "HF_HUB_DISABLE_SYMLINKS defaults to 1 in both scripts"
    requirement: "D-06"
    verification:
      - kind: other
        ref: "grep HF_HUB_DISABLE_SYMLINKS scripts/*.py"
        status: pass
    human_judgment: false
  - id: D3
    description: "setup-python-windows and check-env-windows recipes plus cu128 uv index exist and pyproject parses"
    requirement: "D-07"
    verification:
      - kind: other
        ref: "just --list; tomllib.load(pyproject.toml)"
        status: pass
    human_judgment: true
    rationale: "Clean Windows resolve of torch cu128 + whisperx + pyannote cannot be exercised from WSL (Plan 04)"

duration: 8min
completed: 2026-10-08
status: complete
---

# Phase 15 Plan 03: Windows CUDA Python Setup Summary

**Windows-ready WhisperX/pyannote scripts (CUDA DLL dir registration before ctranslate2 loads, symlink-free HF cache) plus a `just setup-python-windows` uv recipe and win32-gated cu128 torch index**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-10-08T05:37Z
- **Completed:** 2026-10-08T05:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `register_windows_cuda_dlls()` added to `transcribe.py` and `diarize.py`; runs at module top before `import torch`/`whisperx`. Win32-only, ImportError-guarded, only adds `bin` dirs that exist.
- `os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")` in both scripts.
- `setup-python-windows` recipe (`.venv/Scripts/python.exe`, torch/torchaudio pinned `>=2.8.0,<2.9` from the cu128 index, then whisperx + `pyannote-audio>=4.0.4` + nvidia-cudnn-cu12 + nvidia-cublas-cu12) and `check-env-windows` (prints torch version, CUDA availability, device name, whisperx import).
- `pyproject.toml`: explicit `[[tool.uv.index]] pytorch` (cu128) with torch/torchaudio sources gated to `sys_platform == 'win32'`; `override-dependencies` retained.

## Task Commits

1. **Task 1: DLL registration + symlink-free HF cache** - `37d7003` (feat)
2. **Task 2: Windows uv recipe + cu128 index** - `a5d48e4` (feat)

## Files Created/Modified
- `scripts/transcribe.py` - DLL registration + HF env default before torch import
- `scripts/diarize.py` - same pre-flight (added `import os`)
- `justfile` - `setup-python-windows`, `check-env-windows`
- `pyproject.toml` - cu128 pytorch index + win32-gated sources

## Decisions Made
- Source mapping for torch/torchaudio is marker-gated to win32 (an unconditional mapping would also change the existing Linux/WSL resolve, which the project notes require to stay unchanged).
- The explicit nvidia cudnn/cublas packages go in the recipe rather than pyproject: the research claimed they arrive transitively with torch cu128, but the Windows torch wheel bundles its own CUDA libs and, as far as I know, does not depend on them, so the DLL registration would silently do nothing. Plan 04 must confirm.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Explicit nvidia-cudnn-cu12 / nvidia-cublas-cu12 install in Windows recipe**
- **Found during:** Task 2
- **Issue:** Pitfall 1 fix depends on `site-packages/nvidia/{cudnn,cublas}/bin` existing; RESEARCH assumed these come transitively from torch cu128 (true on Linux wheels, doubtful on Windows). Without them the registration is a silent no-op and ctranslate2 still fails.
- **Fix:** Added both packages to the `uv pip install` line of `setup-python-windows`.
- **Files modified:** justfile
- **Committed in:** a5d48e4

**2. [Rule 1 - Robustness] Namespace-package-safe path lookup**
- **Found during:** Task 1
- **Issue:** `nvidia.cudnn.__file__` can be `None` for namespace packages, which would raise in `os.path.dirname`.
- **Fix:** Fall back to `__path__[0]`; only register `bin` dirs that exist.
- **Files modified:** scripts/transcribe.py, scripts/diarize.py
- **Committed in:** 37d7003

**Total deviations:** 2 auto-fixed (1 missing critical, 1 robustness). **Impact:** No scope creep.

## Issues Encountered
- `uv lock --check --offline` could not complete (whisperx git source requires network), so uv's resolve of the new index config was not exercised. uv did parse `pyproject.toml` before failing on the network step, and `tomllib` parses it.

## Known Stubs
None.

## Needs human attention
- `uv.lock` is now stale relative to `pyproject.toml` (new index + sources block). Nothing in the `just setup-python-*` flow uses the lock; run `uv lock` on a networked machine if you start using `uv sync`. I did not touch it or the existing `.venv`.
- Plan 04 (Windows hands-on) must confirm:
  1. `just setup-python-windows` resolves from scratch and `check-env-windows` prints `CUDA available: True` on the RTX 4080.
  2. `site-packages/nvidia/cudnn/bin` and `nvidia/cublas/bin` exist after install, and WhisperX transcription runs on `cuda` without `Could not locate cudnn64_9.dll`.
  3. HuggingFace model download works without Developer Mode.
  4. The marker-gated `torch = { index = ... }` source mapping resolves with whisperX's own git `[[tool.uv.index]]` (RESEARCH Open Q1). If uv rejects it, the recipe is the primary path (it does not depend on pyproject resolution).

## Next Phase Readiness
Ready for Plan 04 hands-on Windows verification; Plan 06 can replicate the `setup-python-windows` commands.

## Self-Check: PASSED
- scripts/transcribe.py, scripts/diarize.py, justfile, pyproject.toml present and modified
- Commits 37d7003 and a5d48e4 exist
- `py_compile scripts/*.py` passes; all plan grep checks pass; pyproject parses as TOML

---
*Phase: 15-desktop-app-port*
*Completed: 2026-10-08*
