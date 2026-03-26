---
phase: 06-styling
plan: 05
subsystem: ui
tags: [react, canvas, ffmpeg, waveform, timeline, timing-editor, zustand]

# Dependency graph
requires:
  - phase: 06-03
    provides: 4-stage nav shell with Timing stage placeholder
  - phase: 06-04
    provides: undo/redo store integrated into subtitleStore mutations
provides:
  - Timeline-style Timing Editor with waveform background and phrase blocks
  - GET /api/jobs/:jobId/waveform endpoint returning 2000-point amplitude data
  - Per-phrase linger duration control flowing through full pipeline
  - Word-level numeric timestamp editing in Timing stage
  - Stacked lane assignment for overlapping speaker phrases
  - Split/merge controls available in Timing stage
affects: [future render improvements, SRT import alignment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FFmpeg PCM extraction: mono 8kHz f32le piped to stdout, bucketed to 2000 peaks
    - Module-level Map cache for waveform data (both backend service and frontend hook)
    - Canvas waveform: requestAnimationFrame + center-mirrored vertical lines
    - Greedy lane assignment: tracks end time per lane, assigns to lowest available
    - Per-phrase linger: SessionPhrase -> TranscriptPhrase -> PreviewPanel -> SubtitleOverlay chain

key-files:
  created:
    - packages/backend/src/services/waveform.ts
    - packages/backend/src/routes/waveform.ts
    - packages/frontend/src/hooks/useWaveform.ts
    - packages/frontend/src/components/TimingEditor/WaveformCanvas.tsx
    - packages/frontend/src/components/TimingEditor/TimingEditor.tsx
    - packages/frontend/src/components/TimingEditor/TimingEditor.css
  modified:
    - packages/backend/src/index.ts
    - packages/frontend/src/lib/grouping.ts
    - packages/frontend/src/store/subtitleStore.ts
    - packages/frontend/src/components/PreviewPanel.tsx
    - packages/frontend/src/pages/SubtitlesPage.tsx
    - packages/remotion-composition/src/SubtitleOverlay.tsx
    - packages/shared-types/src/index.ts

key-decisions:
  - "FFmpeg waveform: mono 8kHz f32le PCM piped to stdout, downsampled to 2000 peaks via max amplitude bucketing"
  - "Per-phrase lingerDuration stored on SessionPhrase and TranscriptPhrase — overrides global style.lingerDuration when set"
  - "Greedy lane assignment: cap at 3 lanes maximum to prevent excessive timeline height"
  - "Split button appears only before words that are not the first (split at position 0 is invalid)"
  - "setPhraseLinger action uses pushUndo before mutation — consistent with all other mutating store actions"

patterns-established:
  - "Waveform cache: module-level Map<jobId, data> pattern in both backend service and frontend hook prevents redundant FFmpeg extraction/fetch"
  - "TimingEditor lane assignment: greedy algorithm runs on phrase array, returns parallel lanes[] array indexed by phraseIndex"

# Metrics
duration: 7min
completed: 2026-03-08
---

# Phase 06 Plan 05: Timing Editor Summary

**FFmpeg waveform extraction + canvas timeline with phrase blocks, stacked lanes, per-phrase linger, and word-level timestamp editing wired into Stage 2**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-08T11:05:11Z
- **Completed:** 2026-03-08T11:11:35Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Backend waveform service extracts mono 8kHz PCM via FFmpeg, downsamples to 2000-point peak amplitude array, caches by jobId; GET /api/jobs/:jobId/waveform serves JSON
- TimingEditor renders horizontal scrollable timeline with ruler, WaveformCanvas background, phrase blocks positioned by timestamp in stacked lanes (greedy overlap detection)
- Per-phrase linger duration flows through the full pipeline: setPhraseLinger (store with undo) -> SessionPhrase.lingerDuration -> TranscriptPhrase.lingerDuration -> PreviewPanel inputProps -> SubtitleOverlay per-phrase override
- PhraseDetailPanel provides word-level timestamp editing (numeric inputs), per-phrase linger slider (0-5s, 0.1 step), and split/merge controls
- All TypeScript compiles across frontend, backend, and remotion-composition

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend waveform extraction + frontend waveform hook and canvas** - `76d9101` (feat)
2. **Task 2: Build TimingEditor component with per-phrase linger and wire into SubtitlesPage** - `e181b03` (feat)

## Files Created/Modified

- `packages/backend/src/services/waveform.ts` - FFmpeg PCM extraction, 2000-point peak bucketing, module-level cache
- `packages/backend/src/routes/waveform.ts` - GET /api/jobs/:jobId/waveform endpoint
- `packages/backend/src/index.ts` - Register waveformRoutes
- `packages/frontend/src/hooks/useWaveform.ts` - Fetch + module-level cache hook returning {waveform, loading}
- `packages/frontend/src/components/TimingEditor/WaveformCanvas.tsx` - Canvas waveform: center-mirrored vertical bars, requestAnimationFrame
- `packages/frontend/src/components/TimingEditor/TimingEditor.tsx` - Timeline editor: ruler, lanes, phrase blocks, PhraseDetailPanel, WordTimingRow
- `packages/frontend/src/components/TimingEditor/TimingEditor.css` - Dark theme timeline CSS using CSS custom properties
- `packages/frontend/src/lib/grouping.ts` - Added lingerDuration to SessionPhrase interface
- `packages/frontend/src/store/subtitleStore.ts` - Added setPhraseLinger action with undo support
- `packages/frontend/src/components/PreviewPanel.tsx` - Added lingerDuration to phrase inputProps mapping
- `packages/frontend/src/pages/SubtitlesPage.tsx` - Import TimingEditor + replace placeholder with TimingEditor render
- `packages/remotion-composition/src/SubtitleOverlay.tsx` - Per-phrase linger: phrase.lingerDuration ?? style.lingerDuration ?? 1.0
- `packages/shared-types/src/index.ts` - Added lingerDuration to TranscriptPhrase

## Decisions Made

- **FFmpeg PCM flags**: `-ac 1 -ar 8000 -f f32le -acodec pcm_f32le pipe:1` — same FFMPEG path as existing services (`/opt/homebrew/bin/ffmpeg`)
- **Waveform cache scope**: Module-level Map in both backend service (keyed by jobId) and frontend hook prevents redundant work across requests/renders
- **Lane cap at 3**: `assignedLane = Math.min(laneEndTimes.length, 2)` — prevents runaway vertical expansion for edge-case overlaps
- **Per-phrase linger override chain**: `phrase.lingerDuration ?? style.lingerDuration ?? 1.0` in SubtitleOverlay — per-phrase takes priority, global is fallback, 1.0 is default

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `shared-types` dist directory is in .gitignore so had to run `npx tsc` inside the package manually after adding `lingerDuration` to ensure remotion-composition TypeScript check could resolve the type. This is a known limitation of the workspace setup (noted in prior decisions).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Timing Editor is fully functional: waveform background, phrase blocks, word timestamp editing, per-phrase linger, split/merge
- Per-phrase linger flows through the full pipeline to both browser preview and server render
- Phase 6 (06-styling) is now complete — all 5 plans executed
- Project is feature-complete per roadmap; ready for QA and delivery

## Self-Check: PASSED

All created files found on disk. Both task commits verified in git log:
- `76d9101` feat(06-05): backend waveform extraction + frontend hook and canvas
- `e181b03` feat(06-05): build TimingEditor and wire into Timing stage

---
*Phase: 06-styling*
*Completed: 2026-03-08*
