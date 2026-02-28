# Phase 2: Transcription - Research

**Researched:** 2026-02-28
**Domain:** Local speech-to-text with faster-whisper on Apple Silicon, Node.js subprocess orchestration, SSE progress streaming
**Confidence:** HIGH (core stack verified via official docs and PyPI; Apple Silicon behavior cross-referenced across multiple sources)

---

## Summary

Phase 2 builds a transcription pipeline that runs entirely on the M4 Mac Mini using `faster-whisper` (Python, CTranslate2 backend). The core flow is: backend receives a "transcribe" request for an existing job, spawns a Python subprocess that runs `faster-whisper` and emits JSON-line progress to stdout, backend streams those progress events as SSE to the frontend, and on completion the transcript is written as `transcript.json` in the job directory.

`faster-whisper 1.2.1` (released October 2025) is confirmed to support `large-v3-turbo` via the model name `"turbo"`. On Apple Silicon the only working backend is `device="cpu"` with `compute_type="int8"` — CTranslate2 ships native `macosx_arm64` wheels, CUDA is not needed and not supported. The VAD filter (`vad_filter=True`) is built in via Silero VAD and suppresses hallucinations on silence. Word-level timestamps are enabled via `word_timestamps=True`; each `Word` dataclass exposes `.word`, `.start`, `.end`, `.probability`. Progress can be tracked by comparing `segment.end` against `info.duration` as the generator is consumed.

The Node.js integration pattern is identical to what Phase 1 already uses for FFmpeg: `child_process.spawn()` reading stdout line-by-line via `readline.createInterface`, forwarding JSON-line progress updates to the job store, then SSE-streaming job state to the frontend. The existing SSE mechanism in `/api/jobs/:jobId/status` and the existing `useUpload` hook pattern in the frontend serve as templates for the transcription progress UI.

**Primary recommendation:** Use `faster-whisper` (CPU/int8, `large-v3-turbo`) orchestrated via a Python script that emits `{"type":"progress","percent":N}` lines to stdout. Integrate into the existing Fastify job store + SSE pattern. Validate word timestamp accuracy with a real test video during Plan 02-01 before committing to the architecture.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| faster-whisper | 1.2.1 (Oct 2025) | Speech-to-text with word timestamps | CTranslate2 backend is 4x faster than openai/whisper; ships arm64 wheels; VAD built-in; word timestamps via DTW |
| ctranslate2 | bundled by faster-whisper | Transformer inference engine | ARM64 native wheels on PyPI; no CUDA needed on Apple Silicon |
| Python | 3.9+ | Script runtime for transcription subprocess | faster-whisper requirement |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PyAV | bundled by faster-whisper | Audio decoding (bundles FFmpeg libs) | Automatic — faster-whisper uses it internally; no system FFmpeg needed for the Python script |
| Node.js `readline` | built-in | Line-by-line stdout parsing | Use instead of raw `data` events to reliably parse JSON-line output from Python subprocess |
| Node.js `child_process.spawn` | built-in | Spawn Python transcription subprocess | Already used in Phase 1 for FFmpeg; same pattern applies |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| faster-whisper CPU/int8 | mlx-whisper | mlx-whisper is faster on Apple Silicon (leverages Metal/ANE) but is a heavier dependency, less mature API, no VAD built-in — faster-whisper is the pre-decided choice per project decisions |
| faster-whisper CPU/int8 | WhisperX | WhisperX improves word timestamp accuracy via wav2vec2 alignment but adds significant dependency complexity; project decision is to evaluate if faster-whisper drift is unacceptable |
| Python subprocess | REST API (separate process) | Subprocess is simpler, no port management, already the pattern for FFmpeg |
| `readline` | raw `stdout.on('data')` | Raw `data` events may split mid-line; `readline` emits complete lines reliably |

**Installation:**
```bash
# Python side (run once to set up venv)
python3 -m venv .venv
source .venv/bin/activate
pip install faster-whisper

# No system FFmpeg needed for transcription — PyAV bundles it
# No CUDA needed — ARM64 wheels on PyPI
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/backend/src/
├── routes/
│   ├── upload.ts           # existing
│   ├── jobs.ts             # existing — SSE already handles transcription statuses
│   └── transcribe.ts       # NEW: POST /api/jobs/:jobId/transcribe
├── services/
│   ├── jobStore.ts         # extend Job type: add transcription statuses + transcript
│   ├── ffmpeg.ts           # existing
│   └── transcription.ts    # NEW: spawn Python, stream progress, write transcript.json
scripts/
└── transcribe.py           # NEW: Python script — loads model, emits progress, writes JSON
data/
└── {jobId}/
    ├── original.{ext}      # existing
    ├── normalized.mp4      # existing
    ├── thumbnail.jpg       # existing
    └── transcript.json     # NEW: word-level timestamped transcript
```

### Pattern 1: Python Script Emitting JSON-Line Progress

**What:** Python script runs `faster-whisper`, tracks progress by comparing `segment.end / info.duration`, emits `{"type":"progress","percent":N}` lines to stdout, writes final `transcript.json` on completion, emits `{"type":"done"}`.

**When to use:** Any long-running Python computation that needs to report progress to a Node.js parent.

**Example:**
```python
# Source: faster-whisper PyPI docs + Node.js child_process pattern
import sys, json
from faster_whisper import WhisperModel

model = WhisperModel("turbo", device="cpu", compute_type="int8")

audio_path = sys.argv[1]
output_path = sys.argv[2]

segments_gen, info = model.transcribe(
    audio_path,
    word_timestamps=True,
    vad_filter=True,
    vad_parameters={"min_silence_duration_ms": 500},
)

words = []
for segment in segments_gen:
    # Progress: segment.end / info.duration → 0.0–1.0
    progress = min(100, int(segment.end / info.duration * 100))
    print(json.dumps({"type": "progress", "percent": progress}), flush=True)

    if segment.words:
        for w in segment.words:
            words.append({
                "word": w.word.strip(),
                "start": round(w.start, 3),
                "end": round(w.end, 3),
                "confidence": round(w.probability, 3),
            })

import json as _json
with open(output_path, "w") as f:
    _json.dump({"words": words, "language": info.language}, f)

print(json.dumps({"type": "done"}), flush=True)
```

### Pattern 2: Node.js Subprocess Orchestration (matches existing FFmpeg pattern)

**What:** `child_process.spawn` with `readline` to parse JSON lines from Python stdout, update job store, which the existing SSE endpoint then streams to the frontend.

**When to use:** Every time a long-running subprocess needs to report progress back to the Node.js job store.

**Example:**
```typescript
// Source: Node.js child_process docs + existing ffmpeg.ts pattern
import { spawn } from 'node:child_process'
import readline from 'node:readline'

function runTranscription(
  jobId: string,
  audioPath: string,
  outputPath: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', ['-u', 'scripts/transcribe.py', audioPath, outputPath])
    // -u = unbuffered stdout — critical for real-time progress

    const rl = readline.createInterface({ input: proc.stdout, terminal: false })
    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line) as { type: string; percent?: number }
        if (msg.type === 'progress' && msg.percent !== undefined) {
          onProgress(msg.percent)
        }
      } catch { /* ignore non-JSON lines */ }
    })

    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`transcribe.py exited ${code}: ${stderr.slice(-500)}`))
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn transcribe.py: ${err.message}`))
    })
  })
}
```

### Pattern 3: Extending the Job Type for Transcription

**What:** Add transcription-specific statuses and fields to the shared `Job` type. The existing SSE endpoint at `/api/jobs/:jobId/status` already broadcasts the full `Job` object — adding `transcribing` status and `transcriptPath` is sufficient.

**Example:**
```typescript
// packages/shared-types/src/index.ts — extend existing types
export type JobStatus =
  | 'uploading'
  | 'normalizing'
  | 'ready'
  | 'transcribing'      // NEW
  | 'transcribed'       // NEW
  | 'failed'

export interface Job {
  id: string
  status: JobStatus
  progress: number
  originalFilename?: string
  metadata?: VideoMetadata
  thumbnailPath?: string
  transcriptPath?: string    // NEW: absolute path to transcript.json
  error?: string
  createdAt: number
}
```

### Pattern 4: Transcript JSON Schema

**What:** The format written by the Python script and read by the frontend.

```json
{
  "language": "en",
  "words": [
    { "word": "Hello", "start": 0.000, "end": 0.480, "confidence": 0.998 },
    { "word": "world.", "start": 0.560, "end": 1.120, "confidence": 0.985 }
  ]
}
```

Note: faster-whisper returns words with leading spaces (e.g., `" Hello"`) — strip with `.strip()` in the Python script.

### Anti-Patterns to Avoid

- **Not using `-u` flag with Python:** Python's stdout is block-buffered by default. Without `-u` (unbuffered), progress lines arrive in large batches at the end, not in real-time. Always spawn as `python3 -u scripts/transcribe.py ...`.
- **Calling `list(segments)` before iterating:** faster-whisper's `transcribe()` returns a lazy generator. Wrapping in `list()` runs the entire transcription before you can emit any progress. Iterate with `for segment in segments_gen` to get incremental progress.
- **Using `device="cuda"` on Apple Silicon:** CTranslate2 on macOS does not support CUDA. Use `device="cpu"`, `compute_type="int8"`.
- **Storing transcript in job store memory:** Transcripts can be large. Store only `transcriptPath` in the in-memory job store; serve transcript content via a dedicated `GET /api/jobs/:jobId/transcript` endpoint that reads the file.
- **Piping video directly to Python:** The Python script should receive the normalized audio track or the normalized `.mp4` path — not the raw original. faster-whisper/PyAV handles audio extraction from `.mp4` internally.
- **Blocking the Fastify event loop:** Mirror the FFmpeg pattern — `runTranscriptionPipeline` is a fire-and-forget async function, the `POST /api/jobs/:jobId/transcribe` route returns `202 Accepted` immediately.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Voice activity detection | Custom silence detector | `vad_filter=True` in faster-whisper | Silero VAD is ML-based, handles music/noise correctly; hand-rolled VAD misses edge cases |
| Word timestamp extraction | DTW or alignment code | `word_timestamps=True` in faster-whisper | DTW over cross-attention weights is non-trivial; faster-whisper handles it internally |
| Audio decoding to 16kHz float32 | Custom FFmpeg pipeline | PyAV bundled in faster-whisper | faster-whisper calls `decode_audio()` internally when given a file path |
| Progress callbacks in Python | Custom wrapper | Lazy generator + `segment.end / info.duration` | The generator naturally yields segments in time order; no callback mechanism needed |

**Key insight:** faster-whisper does the heavy lifting. The Python script's job is to iterate the generator, compute a percentage, and print JSON lines. Everything else is handled by the library.

---

## Common Pitfalls

### Pitfall 1: Python stdout buffering kills real-time progress

**What goes wrong:** Progress lines are buffered in Python's internal stdout buffer and arrive at Node.js only after a large batch has accumulated (or at process exit), making the progress bar non-functional.

**Why it happens:** Python defaults to block-buffered stdout when writing to a pipe (not a TTY). The `print()` call does not flush automatically.

**How to avoid:** Always spawn Python with `python3 -u script.py` OR use `print(..., flush=True)` on every progress print.

**Warning signs:** Progress stays at 0% for the entire transcription then jumps to 100%.

---

### Pitfall 2: First run is slow — model download on cold start

**What goes wrong:** The first invocation of `WhisperModel("turbo", ...)` triggers a ~800MB model download from Hugging Face Hub. This looks like a hung process from the Node.js perspective (no stdout for minutes).

**Why it happens:** faster-whisper automatically downloads the CTranslate2-converted model on first use and caches it in `~/.cache/huggingface/hub/`.

**How to avoid:** Two strategies:
1. Pre-download the model during setup: `python3 -c "from faster_whisper import WhisperModel; WhisperModel('turbo', device='cpu', compute_type='int8')"`
2. Emit a `{"type":"progress","percent":0,"status":"loading_model"}` line at script start (before `model.transcribe()`), so the frontend shows "Loading model..." on first run.

**Warning signs:** Job stays at `transcribing` 0% for an unusually long time on first use.

---

### Pitfall 3: Word timestamp drift at segment boundaries

**What goes wrong:** faster-whisper's word timestamps are produced via DTW on cross-attention weights. Timestamps can drift, especially around music, multiple speakers, or rapid speech. Words may be assigned to slightly wrong times.

**Why it happens:** Whisper was not trained for word-level segmentation; word timestamps are post-hoc inference.

**How to avoid:** Run Plan 02-01 spike with a real test video to validate accuracy is acceptable. If word drift is unacceptable (>200ms consistent error), evaluate WhisperX (per project decision).

**Warning signs:** Subtitle display in later phases shows words appearing noticeably before or after they are spoken.

---

### Pitfall 4: Zombie subprocesses when client disconnects

**What goes wrong:** User navigates away mid-transcription. The SSE connection closes. The Python subprocess continues running in the background, holding CPU and model memory indefinitely.

**Why it happens:** `child_process.spawn` is fire-and-forget; closing the SSE connection does not signal the child.

**How to avoid:** Track the subprocess handle in the job record. In the SSE `req.raw.on('close', ...)` handler (already present in `jobs.ts`), check if the job is still in a non-terminal state and call `proc.kill()` if so.

**Warning signs:** `ps aux | grep transcribe.py` shows multiple Python processes after multiple client disconnects.

---

### Pitfall 5: `large-v3-turbo` vs `"turbo"` naming

**What goes wrong:** Using `WhisperModel("large-v3-turbo", ...)` fails with model not found; the correct shorthand in faster-whisper is `"turbo"`.

**Why it happens:** faster-whisper maps short names to Hugging Face model IDs. The mapping is `"turbo"` → `Systran/faster-whisper-large-v3-turbo`.

**How to avoid:** Use `"turbo"` as the model size string. Verify at spike time (Plan 02-01) by checking the resolved model path in the download log.

**Warning signs:** `ValueError: No model found for size 'large-v3-turbo'` at runtime.

---

### Pitfall 6: Transcript file path vs. transcript content in API

**What goes wrong:** Serving raw `transcriptPath` from the job store JSON exposes an absolute server filesystem path to the client.

**Why it happens:** If `transcriptPath` is serialized directly into the job SSE stream, the client receives something like `/Users/eigenair/projects/personal/eigen-video-editor/data/{jobId}/transcript.json`.

**How to avoid:** Keep `transcriptPath` internal to the job store. Expose transcript content only via `GET /api/jobs/:jobId/transcript` which reads and returns the file. Do NOT include `transcriptPath` in the SSE job broadcast (or strip it before sending).

---

## Code Examples

Verified patterns from official sources:

### faster-whisper: Full transcription with word timestamps + VAD + progress

```python
# Source: https://pypi.org/project/faster-whisper/ (v1.2.1 docs)
import sys, json
from faster_whisper import WhisperModel

model = WhisperModel("turbo", device="cpu", compute_type="int8")

segments_gen, info = model.transcribe(
    sys.argv[1],                          # audio/video path
    word_timestamps=True,
    vad_filter=True,
    vad_parameters={"min_silence_duration_ms": 500},
)

words = []
for segment in segments_gen:
    progress = min(100, int(segment.end / info.duration * 100))
    print(json.dumps({"type": "progress", "percent": progress}), flush=True)
    if segment.words:
        for w in segment.words:
            words.append({
                "word": w.word.strip(),
                "start": round(w.start, 3),
                "end": round(w.end, 3),
                "confidence": round(w.probability, 3),
            })
```

### Word object fields (faster-whisper v1.2.1)

```python
# Source: https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py
# Word is a dataclass with:
#   word: str
#   start: float    # seconds
#   end: float      # seconds
#   probability: float  # 0.0–1.0 confidence

# TranscriptionInfo fields relevant to progress:
#   info.duration: float         # total audio duration in seconds
#   info.duration_after_vad: float  # duration after VAD filtering
#   info.language: str           # detected language code
```

### VAD parameters reference

```python
# Source: https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/vad.py
# Key defaults (faster-whisper overrides from Silero defaults):
#   threshold: 0.5                  (speech probability threshold)
#   min_silence_duration_ms: 2000   (faster-whisper default; Silero default is 100)
#   speech_pad_ms: 400              (padding around speech; Silero default is 30)
#   min_speech_duration_ms: 250

# Recommended override for this use case:
vad_parameters = {"min_silence_duration_ms": 500}  # less aggressive than 2000ms default
```

### Node.js: spawn + readline line-by-line JSON (matches existing ffmpeg.ts pattern)

```typescript
// Source: Node.js docs https://nodejs.org/api/child_process.html
import { spawn } from 'node:child_process'
import readline from 'node:readline'

const proc = spawn('python3', ['-u', 'scripts/transcribe.py', audioPath, outputPath])

const rl = readline.createInterface({ input: proc.stdout, terminal: false })
rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line) as { type: string; percent?: number }
    if (msg.type === 'progress' && msg.percent !== undefined) {
      onProgress(msg.percent)
    }
  } catch { /* ignore non-JSON */ }
})
```

### Frontend: SSE consumption for transcription progress (extends existing useUpload pattern)

```typescript
// Mirrors useUpload.ts EventSource pattern already in the codebase
// packages/frontend/src/hooks/useTranscribe.ts (new)
const es = new EventSource(`/api/jobs/${jobId}/status`)
es.onmessage = (event) => {
  const job = JSON.parse(event.data) as Job
  if (job.status === 'transcribed' || job.status === 'failed') {
    es.close()
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `openai/whisper` (PyTorch) | `faster-whisper` (CTranslate2) | 2023 | 4x faster, lower memory |
| No word timestamps | `word_timestamps=True` (DTW) | 2023 | Good-enough accuracy for subtitle sync |
| No VAD | Silero VAD built into faster-whisper | 2023–2024 | Eliminates hallucinations on silence |
| `large-v3` only | `large-v3-turbo` (`"turbo"`) available | Oct 2024 | Same accuracy as large-v2, much faster decoder (4 layers vs 32) |
| `Word` as NamedTuple | `Word` as dataclass | 2024 | Enables direct `asdict()` / JSON serialization without nesting |

**Deprecated/outdated:**
- `compute_type="float16"` on CPU: Only int8 and float32 are practical on CPU; float16 may work but is not well-optimized for ARM without explicit FP16 CPU support.
- `local_dir_use_symlinks` parameter: Deprecated in v1.1.0+; ignore any old docs referencing it.

---

## Open Questions

1. **Actual benchmark on M4 Mac Mini with large-v3-turbo**
   - What we know: mlx-whisper and insanely-fast-whisper complete a ~10s audio sample in ~1–1.2s on Apple Silicon. No specific faster-whisper CPU int8 RTF figure found for M4.
   - What's unclear: For a typical 5–15 minute video, will CPU int8 transcription take 2–5x real-time (acceptable) or 10x+ (problematic for UX)?
   - Recommendation: Plan 02-01 spike must benchmark with a representative test video. If faster-whisper CPU is too slow (>5x real-time for large-v3-turbo), evaluate mlx-whisper as an Apple Silicon alternative.

2. **Python venv management strategy**
   - What we know: `pip install faster-whisper` works on Apple Silicon ARM64. The project has no Python tooling yet.
   - What's unclear: Should the Python venv be committed, .gitignored, or set up via a justfile task? Where should it live (repo root `.venv` or `scripts/.venv`)?
   - Recommendation: Root `.venv` with a `justfile` setup task (`just setup-python` or similar) matching the existing `justfile` pattern. Add `.venv` to `.gitignore`.

3. **Audio input to Python script: normalized.mp4 vs. extracted audio**
   - What we know: faster-whisper/PyAV can decode audio from `.mp4` directly. It handles audio extraction internally.
   - What's unclear: Is passing the full normalized `.mp4` reliable, or should we extract audio to `.wav` first for robustness?
   - Recommendation: Pass `normalized.mp4` directly to the Python script. PyAV handles `.mp4` → audio decoding. If the spike reveals issues, fall back to a pre-extraction step using the existing FFmpeg service.

4. **Model loading time — load once vs. reload per job**
   - What we know: Model loading (reading from disk cache) takes a few seconds. Model download (cold start) takes minutes.
   - What's unclear: Should we load the model once in a long-lived Python daemon process (IPC) vs. reloading per subprocess invocation?
   - Recommendation: For Phase 2, spawn a new Python process per job (simpler, no IPC complexity). If model load time is a UX problem (>10s), a Phase 2 stretch goal could be a persistent Python server. Spike should measure model-load time from warm cache.

---

## Sources

### Primary (HIGH confidence)
- `https://pypi.org/project/faster-whisper/` — version 1.2.1 (Oct 2025), installation, `transcribe()` API, VAD, word timestamps
- `https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py` — `Word` dataclass fields (`.word`, `.start`, `.end`, `.probability`), `TranscriptionInfo.duration`, `log_progress` parameter
- `https://nodejs.org/api/child_process.html` — `spawn()` async, stdio pipes, readline pattern

### Secondary (MEDIUM confidence)
- `https://github.com/SYSTRAN/faster-whisper` — README: model names, Apple Silicon CPU mode, device options, PyAV bundling
- `https://github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/vad.py` — VAD parameter defaults (threshold 0.5, min_silence_duration_ms 2000, speech_pad_ms 400)
- `https://pypi.org/project/ctranslate2/` — ARM64 wheel confirmed available as of Feb 2026
- Multiple WebSearch results cross-confirming `device="cpu"`, `compute_type="int8"` as the Apple Silicon configuration

### Tertiary (LOW confidence — validate at spike time)
- Benchmark data for faster-whisper CPU RTF on M4: No authoritative source found. Only GPU benchmarks (RTX 2080Ti: ~19s for unknown-length audio). Spike required.
- `"turbo"` as model name alias: Confirmed via WebSearch + PyPI README but not verified against an actual `WhisperModel("turbo", ...)` invocation. Verify in Plan 02-01 spike.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — faster-whisper v1.2.1 confirmed on PyPI with ARM64 wheels; `large-v3-turbo` availability confirmed; device/compute_type options verified
- Architecture: HIGH — subprocess + readline + SSE pattern is identical to existing FFmpeg pattern in Phase 1; no new patterns required
- Word timestamp API: HIGH — `Word` dataclass fields verified from source code
- VAD parameters: HIGH — parameter names and defaults verified from vad.py source
- Performance/benchmarks: LOW — no Apple Silicon CPU benchmark found for faster-whisper; spike required

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable library; check for faster-whisper releases if planning is delayed)
