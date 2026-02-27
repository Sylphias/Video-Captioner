---
phase: 01-foundation
plan: 04
subsystem: api
tags: [fastify, react, typescript, sse, multipart, ffmpeg, react-dropzone, vite, upload, progress]

# Dependency graph
requires:
  - phase: 01-02
    provides: Fastify server, in-memory job store, FFmpeg normalize/probe/thumbnail services, DATA_ROOT
  - phase: 01-03
    provides: React + Vite app shell, dark theme tokens, SubtitlesPage placeholder, /api proxy to :3001
provides:
  - POST /api/upload streaming multipart endpoint — streams file to disk, returns jobId, triggers async FFmpeg normalization
  - GET /api/jobs/:jobId/status SSE endpoint — real-time job progress from uploading through normalizing to ready/failed
  - GET /api/jobs/:jobId/thumbnail endpoint — serves JPEG thumbnail after normalization
  - UploadZone component with react-dropzone drag-and-drop and click-to-upload
  - useUpload hook managing full lifecycle via XHR upload progress + EventSource SSE
  - SubtitlesPage orchestrating idle/uploading/normalizing/ready/failed states with video info card
  - justfile with install-deps, backend, frontend, and dev recipes
affects:
  - 02-x (transcript UI will build on the ready-state video info card and jobId established here)
  - 03-x (Remotion composition will use normalizedPath from job store)

# Tech tracking
tech-stack:
  added:
    - "react-dropzone (useDropzone hook for drag-and-drop + click-to-upload)"
    - "XMLHttpRequest (upload progress tracking — fetch doesn't expose upload.onprogress)"
    - "EventSource (browser-native SSE client)"
  patterns:
    - "Fire-and-forget async normalization pipeline triggered after POST /api/upload responds 202"
    - "Manual SSE via reply.raw.writeHead + reply.raw.write — more reliable than @fastify/sse plugin"
    - "XHR for upload (progress tracking) + EventSource for SSE (streaming progress back) — two separate transport mechanisms per lifecycle phase"
    - "fp() wrapping on route plugins for consistent encapsulation pattern"

key-files:
  created:
    - packages/backend/src/routes/upload.ts
    - packages/backend/src/routes/jobs.ts
    - packages/frontend/src/components/UploadZone.tsx
    - packages/frontend/src/components/UploadZone.css
    - packages/frontend/src/hooks/useUpload.ts
    - packages/frontend/src/pages/SubtitlesPage.tsx (replaced placeholder)
    - packages/frontend/src/pages/SubtitlesPage.css (replaced placeholder)
    - justfile
  modified:
    - packages/backend/src/index.ts (registered uploadRoutes + jobRoutes; added bodyLimit: 10GB)
    - packages/backend/src/plugins/multipart.ts (fileSize: 0 → 10GB explicit limit)
    - packages/frontend/vite.config.ts (proxy target localhost → 127.0.0.1 to avoid IPv6 resolution)

key-decisions:
  - "Manual SSE on reply.raw (not @fastify/sse plugin) — plan explicitly noted @fastify/sse API shape had medium confidence; manual SSE is 3 lines and fully reliable"
  - "XHR for upload phase (not fetch) — only XHR exposes xhr.upload.onprogress for per-byte upload progress display"
  - "fileSize: 10GB explicit limit in @fastify/multipart — fileSize: 0 means 0 bytes (not unlimited) per @fastify/multipart API"
  - "bodyLimit: 10GB in Fastify constructor — Fastify default 1MB bodyLimit was truncating large video uploads before multipart plugin received the stream"
  - "Vite proxy target 127.0.0.1 (not localhost) — Node.js resolves localhost to IPv6 ::1 on macOS; Fastify only binds 0.0.0.0 IPv4"

patterns-established:
  - "Upload route streams multipart file to disk via pipeline(data.file, createWriteStream(dest)) — never buffers in memory"
  - "Two-file-per-job pattern: original{ext} preserved untouched, normalized.mp4 is the processing artifact"
  - "SSE polling interval cleared on req.raw close event to prevent leak after client disconnects"
  - "useUpload hook owns all state transitions — components only call upload(file) and read state"

# Metrics
duration: 45min
completed: 2026-02-28
---

# Phase 1 Plan 04: Upload Pipeline End-to-End Summary

**Complete video upload pipeline: streaming multipart POST, async FFmpeg normalization with SSE progress, react-dropzone frontend, and ready-state video info card (thumbnail, duration, resolution, fps) — Phase 1 feature complete**

## Performance

- **Duration:** ~45 min (includes end-to-end testing and bug fix iteration)
- **Started:** 2026-02-28
- **Completed:** 2026-02-28
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files modified:** 11

## Accomplishments

- Complete upload flow from drag-and-drop through FFmpeg normalization to video info display — zero buffering in memory regardless of file size
- Three bugs found and fixed during end-to-end testing: @fastify/multipart fileSize semantics, Fastify default bodyLimit, Vite proxy IPv6 resolution
- Phase 1 success criteria fully satisfied: LAN-accessible dark UI, drag-and-drop upload, CFR normalization, metadata extraction, thumbnail display, Transcribe button placeholder

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend upload route and SSE job status endpoint** - `6e70e2f` (feat)
2. **Task 2: Frontend upload zone, upload hook, and SubtitlesPage upload flow** - `1a6d8ca` (feat)
3. **Task 3: Bug fixes found during end-to-end testing** - `db98edb` (fix)
4. **justfile: dev recipes** - `0154662` (chore)

**Plan metadata:** `(pending)`

## Files Created/Modified

- `packages/backend/src/routes/upload.ts` - POST /api/upload: streams multipart to disk, returns 202 jobId, fires async normalization
- `packages/backend/src/routes/jobs.ts` - GET /api/jobs/:jobId/status (SSE polling every 500ms), GET /api/jobs/:jobId/thumbnail
- `packages/backend/src/index.ts` - Added bodyLimit: 10GB, registered uploadRoutes + jobRoutes with fp() plugins
- `packages/backend/src/plugins/multipart.ts` - Fixed fileSize: 0 → 10GB explicit limit
- `packages/frontend/src/components/UploadZone.tsx` - Drag-and-drop zone via react-dropzone with drag-active green border state
- `packages/frontend/src/components/UploadZone.css` - Dark theme drop zone styling using --color-dropzone-* tokens
- `packages/frontend/src/hooks/useUpload.ts` - XHR upload + EventSource SSE lifecycle hook with idle/uploading/normalizing/ready/failed states
- `packages/frontend/src/pages/SubtitlesPage.tsx` - Orchestrates upload zone, progress bar, and ready-state video info card with Transcribe button
- `packages/frontend/src/pages/SubtitlesPage.css` - Progress bar, video info card, thumbnail, and metadata layout styles
- `packages/frontend/vite.config.ts` - Fixed proxy target to 127.0.0.1 to prevent IPv6 resolution
- `justfile` - install-deps, backend, frontend, and dev recipes (dev recipe runs both servers concurrently)

## Decisions Made

- Manual SSE via `reply.raw.writeHead` + `reply.raw.write` — plan noted @fastify/sse plugin API had medium confidence; manual SSE is 3 lines and more reliable
- XHR for the upload phase (not fetch) — only XHR exposes `xhr.upload.onprogress` for real upload progress percentage display during the file transfer
- Two-file-per-job layout: `original{ext}` preserved untouched alongside `normalized.mp4` — per pre-build decision; original is always the unmodified source of truth

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed @fastify/multipart fileSize: 0 meaning 0 bytes, not unlimited**
- **Found during:** Task 3 (end-to-end testing — uploads failing with file size limit error)
- **Issue:** `fileSize: 0` in @fastify/multipart's limits object means 0-byte limit, not unlimited. The 01-02 SUMMARY documented this as "unlimited" but the API semantics were the opposite of the original intent.
- **Fix:** Changed `fileSize: 0` to `fileSize: 10 * 1024 * 1024 * 1024` (10GB explicit limit)
- **Files modified:** `packages/backend/src/plugins/multipart.ts`
- **Verification:** Large video upload proceeded past multipart layer to disk successfully
- **Committed in:** `db98edb` (fix commit)

**2. [Rule 1 - Bug] Fixed Vite proxy resolving localhost to IPv6 ::1**
- **Found during:** Task 3 (end-to-end testing — frontend getting ECONNREFUSED on /api calls)
- **Issue:** Vite proxy target `http://localhost:3001` — Node.js on macOS resolves `localhost` to IPv6 `::1`. Fastify listens on `0.0.0.0` (IPv4 only). Connection refused because no service on `::1:3001`.
- **Fix:** Changed proxy target to `http://127.0.0.1:3001` (explicit IPv4 loopback)
- **Files modified:** `packages/frontend/vite.config.ts`
- **Verification:** Frontend API calls proxied successfully; /api/upload returned 202
- **Committed in:** `db98edb` (fix commit)

**3. [Rule 1 - Bug] Fixed Fastify default bodyLimit truncating video uploads**
- **Found during:** Task 3 (end-to-end testing — multipart plugin receiving truncated streams)
- **Issue:** Fastify's default `bodyLimit` is 1MB. Even though @fastify/multipart handles the stream, Fastify's core body parsing limit was applied first, truncating video payloads before the multipart plugin received them.
- **Fix:** Added `bodyLimit: 10 * 1024 * 1024 * 1024` (10GB) to Fastify constructor options
- **Files modified:** `packages/backend/src/index.ts`
- **Verification:** Full-size video upload streamed to disk without truncation
- **Committed in:** `db98edb` (fix commit)

---

**Total deviations:** 3 auto-fixed (3 bugs — all discovered during end-to-end user testing in checkpoint)
**Impact on plan:** All three fixes were required for the upload pipeline to function with real video files. The multipart and bodyLimit issues were interrelated — both had to be fixed for uploads to work. No scope creep.

## Issues Encountered

- @fastify/multipart `fileSize: 0` semantic trap: the 01-02 SUMMARY documented this as "unlimited" based on a misread of the API — the correct interpretation is that 0 means a 0-byte limit. This required setting an explicit 10GB cap instead of relying on a sentinel value.

## User Setup Required

None — all dependencies installed, all configuration fixed during plan execution.

## Next Phase Readiness

- Phase 1 is complete: LAN-accessible dark UI, drag-and-drop upload, async CFR normalization, video metadata extraction, thumbnail display, Transcribe button placeholder
- The job store pattern (Map<string, Job> on Fastify instance) is established for Phase 2 transcription integration
- `normalizedPath` is available on the job record for Phase 2 faster-whisper transcription input
- Frontend `useUpload` hook returns the full `job` object on ready state — Phase 2 can extend this to include transcript data
- Phase 2 blocker: verify `large-v3-turbo` availability in faster-whisper before implementation

---
*Phase: 01-foundation*
*Completed: 2026-02-28*

## Self-Check: PASSED

All 7 expected files found. All 4 task commits verified in git log (6e70e2f, 1a6d8ca, db98edb, 0154662).
