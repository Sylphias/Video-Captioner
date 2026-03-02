---
phase: 02-transcription
plan: 04
subsystem: ui
tags: [react, typescript, vite, sse, eventsource, faster-whisper, whisper, hooks, components]

# Dependency graph
requires:
  - phase: 02-transcription
    plan: 03
    provides: "POST /api/jobs/:jobId/transcribe, GET /api/jobs/:jobId/transcript, SSE full lifecycle"
  - phase: 01-foundation
    provides: "SubtitlesPage scaffold, useUpload hook, SSE EventSource pattern"
provides:
  - "useTranscribe hook managing POST trigger, SSE progress tracking, and GET transcript fetch"
  - "TranscriptView component rendering word-level transcript with CSS tooltip timestamps"
  - "SubtitlesPage extended to handle full lifecycle: upload -> normalize -> ready -> transcribing -> transcribed"
  - "Transcription errors displayed with retry capability"
  - "Both upload and transcription state machines coordinated in SubtitlesPage"
affects:
  - 03-subtitles
  - 04-editor

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separate hooks per lifecycle phase: useUpload handles upload/normalize, useTranscribe handles transcribe — each hook is a focused state machine"
    - "SSE progress consumer pattern: EventSource on /status, close on terminal status, then fetch separate data endpoint"
    - "CSS custom property tooltip pattern: data-tooltip + ::after pseudo-element for instant-appear hover info"
    - "Two-hook coordination: SubtitlesPage reads both hook states, transcribeState takes UI priority when active"

key-files:
  created:
    - "packages/frontend/src/hooks/useTranscribe.ts — transcription lifecycle state machine with POST trigger, SSE progress, GET transcript"
    - "packages/frontend/src/components/TranscriptView.tsx — word-level transcript display with CSS tooltip timestamps"
    - "packages/frontend/src/components/TranscriptView.css — dark theme transcript styles using only CSS custom property tokens"
  modified:
    - "packages/frontend/src/pages/SubtitlesPage.tsx — integrated useTranscribe, enabled Transcribe button, transcribing/transcribed state rendering"
    - "packages/frontend/src/pages/SubtitlesPage.css — added transcript section and enabled button styles"
    - "packages/backend/src/services/transcription.ts — language parameter forced to 'en' by default"
    - "scripts/transcribe.py — language CLI arg, model switched to large-v3 with int8_float32"

key-decisions:
  - "Language forced to 'en' by default — Whisper auto-detection misidentified English audio as Malay, causing hallucinated translation output; optional override retained via CLI arg"
  - "Switched from large-v3-turbo to large-v3 with int8_float32 — turbo model (used during 02-01) had accuracy issues at end-to-end verification; large-v3 + int8_float32 confirmed accurate"
  - "CSS tooltips over native title attribute — native tooltips have ~1s delay and are easy to miss; CSS ::after pseudo-element provides instant on-hover timestamp display"
  - "useTranscribe is a separate hook from useUpload — transcription is a distinct lifecycle phase; keeping each hook focused makes the state machine logic clear and reusable"
  - "fetchTranscript called after SSE signals 'transcribed' — SSE carries status/progress only; full transcript content fetched from dedicated GET endpoint to keep SSE payloads lean"

patterns-established:
  - "Hook-per-phase pattern: each major lifecycle phase (upload, transcribe) owns its own state machine hook"
  - "CSS tooltip via data-tooltip + ::after: preferred over native title for UX control"

# Metrics
duration: approx 60min (across 2 sessions: 2026-02-28 and 2026-03-02)
completed: 2026-03-02
---

# Phase 2 Plan 04: Frontend Transcription UI Summary

**useTranscribe hook + TranscriptView component wiring the full upload-to-transcript lifecycle in SubtitlesPage, with large-v3 int8_float32 accuracy fix and CSS instant-hover word timestamp tooltips**

## Performance

- **Duration:** ~60 min (across 2 sessions)
- **Started:** 2026-02-28T09:39:47Z
- **Completed:** 2026-03-02T11:24:38Z
- **Tasks:** 3 (including 1 human-verify checkpoint — APPROVED)
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- `useTranscribe` hook manages complete transcription lifecycle: POST to trigger, EventSource for SSE progress, GET to fetch completed transcript — follows same EventSource pattern established in `useUpload`
- `TranscriptView` component renders word-level transcript as flowing paragraph text with CSS tooltip timestamps (shows start–end time and confidence % on hover)
- `SubtitlesPage` extended to handle `transcribing` and `transcribed` states; Transcribe button enabled with `onClick` handler; both `useUpload` and `useTranscribe` state machines coordinated; "Upload another video" resets both hooks
- End-to-end verified by user: upload -> normalize -> ready -> transcribe (real-time SSE progress) -> transcript display with word-level timestamps
- Whisper language detection bug fixed: English audio was misidentified as Malay, causing hallucinated output; language forced to `en` by default
- Model accuracy improved: switched from large-v3-turbo to `large-v3` with `int8_float32` compute type after mlx-whisper experiment produced hallucinated output

## Task Commits

Each task was committed atomically:

1. **Task 1: useTranscribe hook and TranscriptView component** - `340e9bb` (feat)
2. **Task 2: Extend SubtitlesPage with transcription states** - `a8575d8` (feat)
3. **Task 3: End-to-end verification** - APPROVED (human checkpoint)

**Post-checkpoint fixes:**
- `68ca363` (fix) — Force language=en to prevent Whisper misdetection
- `9c0a87a` (feat) — Switch to mlx-whisper (reverted)
- `2a57701` (fix) — Revert to large-v3 with int8_float32
- `f09a2b8` (fix) — Replace native title tooltips with CSS tooltips

## Files Created/Modified

- `packages/frontend/src/hooks/useTranscribe.ts` — Hook: POST trigger, SSE EventSource for progress, GET transcript fetch; `transcribe()`, `reset()`, state shape `{ status, progress, transcript, error }`
- `packages/frontend/src/components/TranscriptView.tsx` — Renders word list as inline flowing text; CSS data-tooltip on each word for timestamp + confidence display
- `packages/frontend/src/components/TranscriptView.css` — Dark theme styles using only `var(--color-*)` tokens; CSS tooltip via `::after` pseudo-element
- `packages/frontend/src/pages/SubtitlesPage.tsx` — Added `useTranscribe` alongside `useUpload`; transcribing/transcribed state branches; resetAll() resets both hooks
- `packages/frontend/src/pages/SubtitlesPage.css` — `.subtitles-page__transcript-section` container, enabled transcribe button styles
- `packages/backend/src/services/transcription.ts` — `language` parameter added, defaults to `'en'`
- `scripts/transcribe.py` — `--language` CLI arg added; model switched to `large-v3` with `int8_float32` compute type

## Decisions Made

- **Language forced to 'en'** — Whisper auto-detect misidentified English audio as Malay, producing hallucinated Malay subtitles. Root cause: Whisper uses first 30 seconds for language detection; background noise or silence can trigger false detection. Forced `language='en'` (with CLI override) resolves this cleanly. Language display in TranscriptView still shows actual detected language if override is removed later.
- **large-v3 over large-v3-turbo** — Initial plan used `turbo` (confirmed working in 02-01). At end-to-end verification, transcription accuracy was unsatisfactory. mlx-whisper (Apple Silicon GPU) was tried briefly but produced hallucinated output on MP4 input. Settled on `faster-whisper large-v3` with `int8_float32` — better accuracy than `int8`, still CPU-compatible, no GPU dependency.
- **CSS tooltips over native title attribute** — Native `title` tooltips have ~1s browser delay and cannot be styled. CSS `::after` pseudo-elements using `data-tooltip` attribute provide instant-appear, styled tooltips showing `start–end (confidence%)` on word hover.
- **Separate useTranscribe hook** — Transcription is a distinct lifecycle from upload. Keeping each hook as a focused state machine (useUpload, useTranscribe) makes the logic clear and prevents state contamination between phases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Whisper language misdetection causing hallucinated output**
- **Found during:** Task 3 (end-to-end verification)
- **Issue:** Whisper auto-detected English audio as Malay; transcript contained hallucinated Malay text instead of English transcription
- **Fix:** Added `language` parameter defaulting to `'en'` in Python script and TypeScript service; optional CLI override retained
- **Files modified:** `scripts/transcribe.py`, `packages/backend/src/services/transcription.ts`
- **Verification:** Re-ran transcription; output correctly in English
- **Committed in:** `68ca363`

**2. [Rule 1 - Bug] Transcription model accuracy insufficient with large-v3-turbo**
- **Found during:** Task 3 (end-to-end verification, post-language fix)
- **Issue:** large-v3-turbo (used since 02-01) produced inaccurate word-level timestamps and missed words
- **Fix:** Switched to `large-v3` model with `int8_float32` compute type via faster-whisper; mlx-whisper attempt (Apple Silicon GPU) was tried but produced hallucinated exclamation marks on MP4 input and was reverted
- **Files modified:** `scripts/transcribe.py`, `justfile`
- **Verification:** User approved transcript quality in end-to-end verification
- **Committed in:** `9c0a87a` (mlx attempt), `2a57701` (revert to large-v3)

**3. [Rule 1 - Bug] Native title tooltip UX too slow for word-level timestamps**
- **Found during:** Task 3 (end-to-end verification)
- **Issue:** Native `title` attribute tooltips have ~1s delay, making word timestamps difficult to inspect
- **Fix:** Replaced with CSS `data-tooltip` + `::after` pseudo-element pattern for instant-appear tooltips
- **Files modified:** `packages/frontend/src/components/TranscriptView.tsx`, `packages/frontend/src/components/TranscriptView.css`
- **Verification:** Hover on words shows timestamp tooltip immediately on mouseover
- **Committed in:** `f09a2b8`

---

**Total deviations:** 3 auto-fixed (all Rule 1 - Bug)
**Impact on plan:** All fixes required for usable end-to-end product. Language detection and model accuracy fixes were blocking correctness. Tooltip fix was a UX improvement discovered during verification. No scope creep.

## Issues Encountered

- mlx-whisper was briefly adopted for Apple Silicon GPU acceleration but produced hallucinated output (repeated exclamation marks) when processing MP4 files. Reverted to faster-whisper. Root cause likely mlx-whisper's handling of MP4 audio extraction differing from faster-whisper's PyAV path.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 2 (Transcription) fully complete: Python transcription script, shared types + service, API routes, and frontend UI all verified end-to-end
- Phase 3 (Subtitles) can consume: `GET /api/jobs/:jobId/transcript` for word-level Transcript data, `Transcript` and `TranscriptWord` types from `@eigen/shared-types`
- Remaining concern: word timestamp accuracy benchmark with longer/more complex audio — acceptable for Phase 3 but flag if drift accumulates
- Model choice (large-v3 int8_float32) is slower than turbo; if transcription speed becomes a UX problem, revisit with VAD pre-filtering or chunking

## Self-Check

- FOUND: packages/frontend/src/hooks/useTranscribe.ts (contains useTranscribe)
- FOUND: packages/frontend/src/components/TranscriptView.tsx (contains TranscriptView)
- FOUND: packages/frontend/src/components/TranscriptView.css (dark theme styles, CSS tooltip)
- FOUND: commit 340e9bb (feat(02-04): add useTranscribe hook and TranscriptView component)
- FOUND: commit a8575d8 (feat(02-04): extend SubtitlesPage with transcription states)
- FOUND: commit 68ca363 (fix(02-04): force language=en)
- FOUND: commit 2a57701 (fix(02-04): revert to large-v3 with int8_float32)
- FOUND: commit f09a2b8 (fix(02-04): CSS tooltips)

## Self-Check: PASSED

---
*Phase: 02-transcription*
*Completed: 2026-03-02*
