---
phase: 02-transcription
plan: 03
subsystem: api
tags: [typescript, node, fastify, fastify-plugin, sse, subprocess, child_process]

# Dependency graph
requires:
  - phase: 02-transcription
    plan: 02
    provides: "runTranscription() service returning { promise, process }, Job.transcriptPath field"
  - phase: 01-foundation
    provides: "Fastify server setup, jobStore with fastify.jobs decorator, SSE pattern in jobs.ts"
provides:
  - "POST /api/jobs/:jobId/transcribe — 202 Accepted, fires background transcription pipeline"
  - "GET /api/jobs/:jobId/transcript — serves transcript.json content (not path) from disk"
  - "SSE streams full lifecycle: uploading -> normalizing -> ready -> transcribing -> transcribed"
  - "transcriptPath and thumbnailPath stripped from SSE broadcast (no server paths exposed)"
  - "killTranscription(jobId) called on SSE disconnect for zombie subprocess prevention"
affects:
  - 03-subtitles
  - 04-editor
  - 05-rendering

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget void pattern for background pipeline — reply.send() before pipeline starts"
    - "Module-level Map<string, ChildProcess> for subprocess tracking (not in job store)"
    - "Destructuring spread to strip internal fields before SSE broadcast: { transcriptPath, thumbnailPath, ...safeJob }"
    - "One-directional import for zombie cleanup: jobs.ts imports killTranscription from transcribe.ts (no circular dep)"

key-files:
  created:
    - "packages/backend/src/routes/transcribe.ts — POST transcribe endpoint, runTranscriptionPipeline, transcriptionProcesses Map, killTranscription export"
  modified:
    - "packages/backend/src/routes/jobs.ts — SSE terminal state updated, path stripping, killTranscription on disconnect, GET transcript endpoint"
    - "packages/backend/src/index.ts — registered transcribeRoutes plugin"

key-decisions:
  - "SSE 'ready' state is no longer terminal — stream stays open through transcription so frontend monitors full lifecycle"
  - "transcriptionProcesses Map kept module-level in transcribe.ts, NOT in job store — ChildProcess is not JSON-serializable"
  - "killTranscription imported into jobs.ts from transcribe.ts (not vice versa) — one-directional, no circular import"

patterns-established:
  - "Background pipeline pattern: update status -> send 202 -> void pipeline() — matches upload.ts pattern exactly"
  - "Internal field stripping convention: { sensitiveField, ...safeObject } before any client serialization"

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 2 Plan 03: Transcription Routes and SSE Extension Summary

**POST /api/jobs/:jobId/transcribe endpoint with background pipeline, SSE extended to stream full upload-to-transcribed lifecycle with server path stripping, and GET /api/jobs/:jobId/transcript serving transcript JSON content**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T09:34:24Z
- **Completed:** 2026-02-28T09:36:28Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- `packages/backend/src/routes/transcribe.ts` created with Fastify plugin (fp()) pattern; POST endpoint returns 202 and fires `runTranscriptionPipeline()` in background
- Module-level `transcriptionProcesses: Map<string, ChildProcess>` tracks subprocess handles outside job store; `killTranscription(jobId)` exported for SSE disconnect cleanup
- SSE terminal state updated: `'ready'` removed, `'transcribed'` added — stream stays open through full lifecycle
- `transcriptPath` and `thumbnailPath` destructured out before SSE `JSON.stringify` — no server filesystem paths exposed to client
- `killTranscription(jobId)` called in SSE close handler — zombie subprocesses killed on client disconnect
- `GET /api/jobs/:jobId/transcript` reads `transcript.json` content from disk and serves as `application/json` — content, not path
- `transcribeRoutes` registered in `index.ts` after existing route plugins

## Task Commits

Each task was committed atomically:

1. **Task 1: POST /api/jobs/:jobId/transcribe route and background pipeline** - `45f6c17` (feat)
2. **Task 2: Extend SSE and add GET transcript endpoint with security stripping** - `4c91521` (feat)

**Plan metadata:** (docs commit — this summary)

## Files Created/Modified

- `packages/backend/src/routes/transcribe.ts` — New Fastify plugin; POST transcribe endpoint, `runTranscriptionPipeline()`, `transcriptionProcesses` Map, exported `killTranscription(jobId)`
- `packages/backend/src/routes/jobs.ts` — SSE terminal state corrected (transcribed/failed only), path stripping via destructuring, `killTranscription` import + call on close, new GET transcript endpoint
- `packages/backend/src/index.ts` — `import transcribeRoutes` added, `await fastify.register(transcribeRoutes)` after `jobRoutes`

## Decisions Made

- **SSE 'ready' is no longer a terminal state** — The frontend needs to monitor the job continuously through transcription. Closing SSE at 'ready' would require the frontend to reconnect, adding unnecessary complexity. The stream stays open until 'transcribed' or 'failed'.
- **transcriptionProcesses Map is module-level in transcribe.ts** — ChildProcess handles cannot be stored in the job store (not JSON-serializable, would break SSE). A module-level Map is the correct scope: persists across requests, not exposed to client serialization.
- **One-directional import for zombie cleanup** — `jobs.ts` imports `killTranscription` from `transcribe.ts`. `transcribe.ts` does NOT import from `jobs.ts`. This avoids circular dependencies while keeping zombie prevention wired at the SSE disconnect point.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Port 3001 already in use by running dev server during verification. Confirmed backend startup correctness by: (1) health check returning `{"status":"ok"}` from existing running server, (2) new backend process failing with EADDRINUSE (not import errors), (3) content verification confirming all required elements present in source files.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three Phase 2 plans complete: Python transcription script (02-01), types + service (02-02), routes (02-03)
- Frontend can now: POST to trigger transcription, watch SSE for progress, GET transcript content
- Phase 3 (Subtitles) can consume `GET /api/jobs/:jobId/transcript` for transcript data
- Remaining Phase 2 concern: Run real benchmark with test video to confirm word timestamp accuracy

## Self-Check: PASSED

- FOUND: packages/backend/src/routes/transcribe.ts (contains killTranscription, transcriptionProcesses, POST endpoint)
- FOUND: packages/backend/src/routes/jobs.ts (contains 'transcribed' terminal check, path stripping, killTranscription call, GET transcript)
- FOUND: packages/backend/src/index.ts (contains transcribeRoutes import and register)
- FOUND: commit 45f6c17 (feat(02-03): POST /api/jobs/:jobId/transcribe endpoint)
- FOUND: commit 4c91521 (feat(02-03): extend SSE lifecycle)

---
*Phase: 02-transcription*
*Completed: 2026-02-28*
