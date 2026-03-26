---
phase: 05-server-render-and-output
plan: 02
subsystem: ui
tags: [react, hooks, sse, eventsource, zustand, render, download, progress-bar]

requires:
  - phase: 05-server-render-and-output/05-01
    provides: POST /api/jobs/:jobId/render, GET /api/jobs/:jobId/download, SSE rendering/rendered status, render progress in job store

provides:
  - useRender hook managing render lifecycle (idle->rendering->rendered/failed) with SSE progress tracking
  - Render MP4 button in SubtitlesPage transcribed state with cycling labels
  - Real-time progress bar during rendering
  - Download MP4 anchor link on render completion
  - Render error display inline below controls
  - resetRender wired into resetAll for full state cleanup

affects: [06-polish-and-export]

tech-stack:
  added: []
  patterns:
    - "useRender follows same focused state-machine hook pattern as useTranscribe and useDiarize"
    - "EventSource cleanup via useEffect return — prevents memory leaks on unmount"
    - "Zustand store read via getState() inside render() callback — avoids stale closure"
    - "Download as <a download> anchor — browser handles file download natively"

key-files:
  created:
    - packages/frontend/src/hooks/useRender.ts
  modified:
    - packages/frontend/src/pages/SubtitlesPage.tsx
    - packages/frontend/src/pages/SubtitlesPage.css

key-decisions:
  - "useRender reads store via useSubtitleStore.getState() inside render() callback — same pattern as diarize hook, avoids closure over stale store"
  - "Download MP4 uses <a href download> anchor, not a button — browser handles Content-Disposition download natively without JS"
  - "render-controls placed after diarize-controls in top-controls bar — logical left-to-right workflow: go-to-subtitle / detect-speakers / render"
  - "EventSource lifecycle: created after successful POST, closed on rendered/failed terminal state or SSE error, also cleaned up on unmount"

patterns-established:
  - "Pattern: Focused render state machine hook mirrors useTranscribe — POST to trigger, SSE to track, terminal state closes connection"
  - "Pattern: Download via anchor tag — /api/jobs/:jobId/download URL with download attribute triggers browser file save"

duration: 8min
completed: 2026-03-05
---

# Phase 5 Plan 2: Render UI Summary

**useRender hook and SubtitlesPage render controls: Render MP4 button with SSE progress bar and Download MP4 anchor link completing the end-to-end subtitle burn-in workflow**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-05T13:40:24Z
- **Completed:** 2026-03-05T13:48:00Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint — approved)
- **Files modified:** 3

## Accomplishments
- useRender hook: idle->rendering->rendered/failed state machine with POST trigger and SSE progress tracking
- Render MP4 button with cycling labels (Render MP4 / Rendering N% / Re-render MP4 / Retry render)
- Real-time progress bar displayed during rendering using same progress track component as upload/transcribe
- Download MP4 link (<a download>) appears on render completion, pointing to /api/jobs/:jobId/download
- Render error shown inline, matching diarize error pattern
- CSS additions: render-controls, render-btn, render-progress, download-btn (green accent), render-error

## Task Commits

Each task was committed atomically:

1. **Task 1: useRender hook and SubtitlesPage render/download integration** - `3269601` (feat)

**Plan metadata:** `ba7eae5` (docs: complete plan)

_Task 2 is a human-verify checkpoint — approved by user confirming burned-in subtitles in downloaded MP4_

## Files Created/Modified
- `packages/frontend/src/hooks/useRender.ts` - useRender state machine hook: POST render trigger, SSE progress, reset (NEW)
- `packages/frontend/src/pages/SubtitlesPage.tsx` - Integrated useRender, render controls section, download button, render error
- `packages/frontend/src/pages/SubtitlesPage.css` - CSS for render-controls, render-btn, render-progress, download-btn, render-error

## Decisions Made
- useRender reads `useSubtitleStore.getState()` inside the render callback (not a React hook call) — accesses current store state at trigger time without stale closure, same pattern used by useDiarize
- Download implemented as `<a href="/api/jobs/:jobId/download" download>` — browser handles Content-Disposition attachment natively without JavaScript file handling
- Render controls placed after diarize controls in the top-controls bar to match left-to-right workflow
- EventSource created after successful POST and closed on rendered/failed terminal states, also cleaned up via useEffect return on unmount

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - TypeScript compilation clean on first attempt.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- End-to-end render workflow verified by user: subtitles are visibly burned in to the downloaded MP4
- Phase 5 Plan 2 complete — ready for 05-03 (final phase verification/polish) or Phase 6 (polish and export)
- Full workflow confirmed: upload → transcribe → (optional diarize) → render → download MP4 with karaoke subtitles

---
*Phase: 05-server-render-and-output*
*Completed: 2026-03-05*
