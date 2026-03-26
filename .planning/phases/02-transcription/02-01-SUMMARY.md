---
phase: 02-transcription
plan: 01
subsystem: infra
tags: [python, faster-whisper, whisper, ctranslate2, transcription, subprocess, json-line]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "justfile, repo structure, data/ directory convention"
provides:
  - "Python venv at .venv/ with faster-whisper 1.2.1 (ctranslate2 ARM64 backend)"
  - "scripts/transcribe.py — production subprocess script emitting JSON-line progress"
  - "Validated WhisperModel('turbo', device='cpu', compute_type='int8') on Apple Silicon"
  - "Confirmed VAD filter suppresses hallucinated output on silence"
  - "setup-python justfile recipe for reproducible environment setup"
affects:
  - 02-transcription (plans 02+)
  - 03-subtitles
  - 05-rendering

# Tech tracking
tech-stack:
  added:
    - "faster-whisper 1.2.1 (pip, ARM64 wheels via ctranslate2)"
    - "ctranslate2 4.7.1 (bundled via faster-whisper)"
    - "onnxruntime 1.24.2 (bundled for Silero VAD)"
  patterns:
    - "JSON-line progress protocol: {type, percent, status?} lines flushed to stdout for Node.js readline parsing"
    - "Python venv at repo root .venv/ — gitignored, set up via justfile recipe"
    - "flush=True on every print() — mandatory for real-time progress through pipes"
    - "Progress capped at 99% until done message — avoids premature 100%"

key-files:
  created:
    - "scripts/transcribe.py — production transcription script (CLI: audio_path output_path)"
  modified:
    - ".gitignore — added .venv/"
    - "justfile — added setup-python recipe"

key-decisions:
  - "WhisperModel('turbo', device='cpu', compute_type='int8') confirmed working on Apple Silicon — 'turbo' maps to Systran/faster-whisper-large-v3-turbo"
  - "Python subprocess per job (not persistent daemon) — simpler, no IPC; revisit if model load time is UX problem"
  - "VAD min_silence_duration_ms=500 (less aggressive than 2000ms default) — avoids over-suppression"
  - "Pass normalized.mp4 path directly to Python — PyAV handles audio extraction from mp4 internally"

patterns-established:
  - "JSON-line protocol: every stdout line is a complete JSON object, flushed immediately"
  - "last_percent dedup: only emit progress when percent increases to avoid stdout flooding"
  - "Scripts in scripts/ dir, run via .venv/bin/python -u"

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 2 Plan 01: Python Transcription Environment Summary

**faster-whisper 1.2.1 with WhisperModel('turbo', cpu, int8) validated on Apple Silicon; production scripts/transcribe.py spawnable as subprocess emitting JSON-line progress to stdout**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-28T09:25:47Z
- **Completed:** 2026-02-28T09:28:40Z
- **Tasks:** 2
- **Files modified:** 3 (created 1, modified 2)

## Accomplishments

- Python venv at `.venv/` with faster-whisper 1.2.1 installed (ctranslate2 ARM64 wheels — no CUDA needed)
- `WhisperModel("turbo", device="cpu", compute_type="int8")` confirmed loading successfully on Apple Silicon M4
- VAD filter validated: correctly suppresses output on silence segments (0 words returned for sine wave input)
- Production `scripts/transcribe.py` created with JSON-line progress protocol, word-level timestamps, and correct output JSON schema
- `setup-python` justfile recipe added for reproducible environment setup
- `.venv/` added to `.gitignore`

## Task Commits

Each task was committed atomically:

1. **Task 1: Python venv setup with faster-whisper and validation spike** - `cf2b3f5` (chore)
2. **Task 2: Production transcription script with JSON-line progress output** - `10826a4` (feat)

**Plan metadata:** (docs commit — this summary)

## Files Created/Modified

- `scripts/transcribe.py` — Production transcription script; receives audio_path + output_path as CLI args; emits JSON-line progress to stdout; writes transcript.json with `{language, words[{word, start, end, confidence}]}`
- `.gitignore` — Added `.venv/` exclusion
- `justfile` — Added `setup-python` recipe (python3 -m venv .venv, pip install faster-whisper)

## Decisions Made

- `"turbo"` is the correct model name alias (maps to `Systran/faster-whisper-large-v3-turbo`) — confirmed at runtime, fallback to `large-v3` not needed
- Model was already cached from a prior invocation; cold start would trigger ~800MB Hugging Face download
- VAD `min_silence_duration_ms=500` chosen over the 2000ms default for less aggressive silence suppression
- Progress capped at 99% until `done` message to prevent premature 100% in the frontend
- Spawn new Python process per transcription job (not persistent daemon) — simpler IPC; revisit if load time becomes a UX issue

## Deviations from Plan

None — plan executed exactly as written. The `"turbo"` model name was confirmed working (no fallback needed, as the plan anticipated).

## Issues Encountered

None. All verifications passed on first run. Model was already cached in `~/.cache/huggingface/hub/` so no download delay was encountered.

## User Setup Required

None — no external service configuration required. Run `just setup-python` to create the venv. Model is auto-downloaded from Hugging Face Hub on first use.

## Next Phase Readiness

- `scripts/transcribe.py` is ready for Node.js backend subprocess integration (Plan 02-02)
- Interface: `.venv/bin/python -u scripts/transcribe.py <audio_path> <output_json_path>`
- JSON-line protocol tested and working
- Concerns to address in 02-02:
  - Benchmark actual transcription time on M4 with a real speech video (currently only tested with silent audio)
  - Implement Node.js subprocess orchestration using existing ffmpeg.ts pattern
  - Handle zombie subprocess cleanup when client disconnects (Pitfall 4 from research)

## Self-Check: PASSED

- FOUND: scripts/transcribe.py
- FOUND: .venv/bin/python
- FOUND: .planning/phases/02-transcription/02-01-SUMMARY.md
- FOUND: commit cf2b3f5 (chore: venv setup)
- FOUND: commit 10826a4 (feat: transcription script)

---
*Phase: 02-transcription*
*Completed: 2026-02-28*
