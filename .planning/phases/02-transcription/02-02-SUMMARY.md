---
phase: 02-transcription
plan: 02
subsystem: api
tags: [typescript, node, child_process, readline, spawn, subprocess, shared-types]

# Dependency graph
requires:
  - phase: 02-transcription
    plan: 01
    provides: "scripts/transcribe.py emitting JSON-line progress to stdout"
  - phase: 01-foundation
    provides: "JobStatus and Job types in shared-types, ffmpeg.ts service pattern"
provides:
  - "Extended JobStatus union: 'transcribing' | 'transcribed' added after 'ready'"
  - "Job.transcriptPath optional field (internal only, not sent to SSE clients)"
  - "TranscriptWord interface: word, start, end, confidence"
  - "Transcript interface: language, words[]"
  - "runTranscription() service function — spawns Python subprocess with { promise, process } return shape"
affects:
  - 02-transcription (plan 03 — route integration)
  - 03-subtitles
  - 05-rendering

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Named function export pattern (no classes, no plugins) — matches ffmpeg.ts convention"
    - "Return { promise, process } from spawn wrapper — process handle enables zombie subprocess cleanup"
    - "readline.createInterface on proc.stdout for JSON-line parsing — line-by-line, no data event fragmentation"
    - "transcriptPath internal-only field convention — type system marks it optional; route layer strips before SSE broadcast"

key-files:
  created:
    - "packages/backend/src/services/transcription.ts — runTranscription() service; spawns .venv/bin/python -u scripts/transcribe.py"
  modified:
    - "packages/shared-types/src/index.ts — added transcribing/transcribed to JobStatus, transcriptPath to Job, TranscriptWord and Transcript interfaces"

key-decisions:
  - "Return { promise, process } shape from runTranscription — exposes ChildProcess handle for caller to kill on client disconnect (zombie prevention)"
  - "transcriptPath marked internal-only via comment — route layer in 02-03 must strip it before SSE broadcast to avoid exposing server filesystem paths"
  - "Pre-existing TS5097 errors in backend (index.ts, upload.ts) are not caused by this plan — confirmed pre-existing from Phase 1"

patterns-established:
  - "Service modules return { promise, process } for spawn-based operations — allows callers to manage subprocess lifecycle"
  - "transcriptPath internal convention — any Job field that exposes server paths is commented 'internal only'"

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 2 Plan 02: Shared Types Extension and Transcription Service Summary

**Extended JobStatus with transcribing/transcribed, added Job.transcriptPath and Transcript/TranscriptWord interfaces, and created runTranscription() Node.js service that spawns Python -u subprocess returning { promise, process } for zombie-safe subprocess management**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T09:30:57Z
- **Completed:** 2026-02-28T09:34:57Z
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments

- JobStatus union type extended with `'transcribing'` and `'transcribed'` statuses placed after `'ready'`
- `Job.transcriptPath` optional field added with explicit internal-only comment to flag SSE serialization risk
- `TranscriptWord` and `Transcript` interfaces added to shared-types — match Python script's output JSON schema exactly
- `packages/backend/src/services/transcription.ts` created with `runTranscription()` function matching `ffmpeg.ts` named-export pattern
- Python subprocess spawned with `-u` (unbuffered stdout) and `readline.createInterface` for reliable JSON-line parsing
- Returns `{ promise, process }` shape exposing `ChildProcess` handle — enables caller to kill subprocess on client disconnect

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend shared types with transcription statuses and transcript path** - `7aab5ce` (feat)
2. **Task 2: Transcription service module — Python subprocess with progress tracking** - `c37f55e` (feat)

**Plan metadata:** (docs commit — this summary)

## Files Created/Modified

- `packages/shared-types/src/index.ts` — Added `'transcribing' | 'transcribed'` to JobStatus, `transcriptPath?` to Job, `TranscriptWord` interface, `Transcript` interface
- `packages/backend/src/services/transcription.ts` — New service module; exports `runTranscription(audioPath, outputPath, onProgress?)` returning `{ promise: Promise<void>; process: ChildProcess }`

## Decisions Made

- **Return `{ promise, process }` shape** — Unlike `ffmpeg.ts` which returns a bare `Promise<void>`, transcription service returns the ChildProcess handle. This is required because transcription is long-running (30s–5min) and if the client disconnects, the route handler must be able to `proc.kill()` to prevent zombie Python processes accumulating.
- **`transcriptPath` internal-only field** — Adding a server filesystem path to the shared `Job` type creates a risk that future developers accidentally serialize it into SSE events. The comment "internal only — not sent to client" codifies the constraint; the route in 02-03 will explicitly strip it.
- **Pre-existing TypeScript errors not fixed** — `npx tsc` on the backend package shows TS5097 errors in `index.ts` and `upload.ts` (`.ts` extension imports with allowImportingTsExtensions disabled). These pre-date this plan and were NOT introduced by `transcription.ts`. The new file compiles cleanly in isolation.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Pre-existing TS5097 errors in backend (`packages/backend/src/index.ts`, `packages/backend/src/routes/upload.ts`) surfaced during verification. These are not caused by this plan — confirmed by checking that errors exist without my changes. The new `transcription.ts` file passes isolated TypeScript checking with no errors. These are tracked pre-existing issues.

## User Setup Required

None — no external service configuration required. The service depends on `.venv/bin/python` which is set up via `just setup-python` (completed in 02-01).

## Next Phase Readiness

- `runTranscription()` is ready for route integration (Plan 02-03)
- Interface: `runTranscription(audioPath, outputPath, onProgress?)` → `{ promise, process }`
- Route in 02-03 must: update job status to `'transcribing'`, call `runTranscription`, track `process` handle for disconnect cleanup, strip `transcriptPath` before SSE broadcast
- Shared types are fully aligned with Python script's output JSON schema

## Self-Check: PASSED

- FOUND: packages/shared-types/src/index.ts (contains 'transcribing', 'transcriptPath', 'TranscriptWord')
- FOUND: packages/backend/src/services/transcription.ts (contains runTranscription, -u flag, readline)
- FOUND: commit 7aab5ce (feat(02-02): extend shared types)
- FOUND: commit c37f55e (feat(02-02): add transcription service module)
- TypeScript compilation passes on shared-types package

---
*Phase: 02-transcription*
*Completed: 2026-02-28*
