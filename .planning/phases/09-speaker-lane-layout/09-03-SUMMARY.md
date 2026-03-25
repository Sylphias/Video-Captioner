---
phase: 09-speaker-lane-layout
plan: 03
subsystem: ui
tags: [react, zustand, typescript, speaker-lanes, drag-handles, presets]

# Dependency graph
requires:
  - phase: 09-01-speaker-lane-layout
    provides: speakerLanes/overlapGap/maxVisibleRows store fields, setSpeakerLane/loadLaneLayout actions
  - phase: 09-02-speaker-lane-layout
    provides: /api/lane-presets CRUD endpoints
provides:
  - LaneDragOverlay: per-speaker dashed + per-phrase dotted drag handles overlaid on video preview
  - LaneControlsPanel: numeric position inputs, proximity warnings, overlap gap, max rows, preset CRUD
  - useLanePresets hook: fetch/create/update/delete for /api/lane-presets
  - speakerColors.ts shared util extracted from SpeakerStylePanel
  - Stage-aware visibility: lane UI shown only in Timeline (timing) stage
  - Per-phrase vertical position override via StyleDrawer already present (no changes needed)
affects:
  - 09-04 (if any further lane polish plans)
  - render pipeline (lane positions applied in final MP4)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - LaneDragOverlay uses mousedown/mousemove/mouseup on document with draggingRef to avoid stale closures
    - playerWrapperRef passed as containerRef to overlay for height measurement
    - showLaneControls prop on PreviewPanel gates overlay render
    - SubtitlesPage wraps LaneControlsPanel+PreviewPanel in flex row when activeStage === 'timing'

key-files:
  created:
    - packages/frontend/src/utils/speakerColors.ts
    - packages/frontend/src/hooks/useLanePresets.ts
    - packages/frontend/src/components/LaneDragOverlay.tsx
    - packages/frontend/src/components/LaneDragOverlay.css
    - packages/frontend/src/components/LaneControls/LaneControlsPanel.tsx
    - packages/frontend/src/components/LaneControls/LaneControlsPanel.css
  modified:
    - packages/frontend/src/components/PreviewPanel.tsx
    - packages/frontend/src/components/PreviewPanel.css
    - packages/frontend/src/pages/SubtitlesPage.tsx
    - packages/frontend/src/pages/SubtitlesPage.css

key-decisions:
  - "playerWrapperRef used as containerRef for LaneDragOverlay height measurement — same element that contains the Remotion Player"
  - "Per-phrase drag handle appears only while phrase is currently playing (frame within phrase time range)"
  - "useLanePresets uses refreshTick counter pattern matching useAnimationPresets"
  - "speakerColors.ts extracted as shared util — previously duplicated in SpeakerStylePanel"
  - "LaneDragOverlay has pointer-events: none on container, pointer-events: auto on individual handles — passes through video clicks"
  - "PhraseStylePanel verticalPosition override already existed — no changes needed"

patterns-established:
  - "Drag handle overlay: container pointer-events:none, handle pointer-events:auto, document event listeners with draggingRef"
  - "Stage-aware UI: activeStage==='timing' gates both LaneControlsPanel render and showLaneControls prop"

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 9 Plan 03: Lane Controls UI Summary

**Drag handles on video preview and a numeric controls panel for bidirectionally synced per-speaker vertical lane positioning with proximity warnings and preset CRUD**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-25T15:45:18Z
- **Completed:** 2026-03-25T15:49:08Z
- **Tasks:** 2 auto + 1 checkpoint (pending human verify)
- **Files modified:** 10

## Accomplishments
- Created `LaneDragOverlay` with per-speaker dashed lines and per-phrase dotted handles draggable over the video preview
- Created `LaneControlsPanel` with numeric position inputs, proximity warnings (within 10%), overlap gap, max rows, and preset save/load/delete
- Created `useLanePresets` hook for CRUD against `/api/lane-presets`
- Extracted `speakerColors.ts` as a shared util referenced by both components
- Integrated into `PreviewPanel` (showLaneControls prop + overlay render) and `SubtitlesPage` (stage-aware flex layout)
- PhraseStylePanel already had verticalPosition override — no changes needed

## Task Commits

Each task was committed atomically:

1. **Task 1: LaneDragOverlay, LaneControlsPanel, useLanePresets hook** - `de3a86c` (feat)
2. **Task 2: Integration into PreviewPanel and SubtitlesPage** - `c11f4ab` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/frontend/src/utils/speakerColors.ts` - Shared SPEAKER_COLORS array + getSpeakerColor()
- `packages/frontend/src/hooks/useLanePresets.ts` - CRUD hook for /api/lane-presets with refreshTick pattern
- `packages/frontend/src/components/LaneDragOverlay.tsx` - Per-speaker + per-phrase drag handles over video preview
- `packages/frontend/src/components/LaneDragOverlay.css` - Dashed/dotted line styles, labels, pointer-events
- `packages/frontend/src/components/LaneControls/LaneControlsPanel.tsx` - Numeric inputs, warnings, presets
- `packages/frontend/src/components/LaneControls/LaneControlsPanel.css` - Compact dark-theme panel styles
- `packages/frontend/src/components/PreviewPanel.tsx` - showLaneControls prop, playerWrapperRef, LaneDragOverlay render
- `packages/frontend/src/components/PreviewPanel.css` - position:relative on player-wrapper
- `packages/frontend/src/pages/SubtitlesPage.tsx` - LaneControlsPanel import, stage-aware render, lane store subscriptions
- `packages/frontend/src/pages/SubtitlesPage.css` - preview-with-lanes flex row wrapper

## Decisions Made
- `playerWrapperRef` is the `containerRef` passed to `LaneDragOverlay` — it's the direct parent of the Remotion Player, so its height equals the video display height
- Per-phrase handles appear only when the phrase overlaps `currentFrame` — avoids cluttering the UI with all phrase handles at once
- `useLanePresets` follows the exact `refreshTick` counter pattern from `useAnimationPresets` for consistency
- `speakerColors.ts` extracted as a shared util to avoid duplication between `SpeakerStylePanel` and the new overlay/panel

## Deviations from Plan

None — plan executed exactly as written. PhraseStylePanel verticalPosition override was already implemented (plan noted to verify).

## Issues Encountered
None — TypeScript compiled cleanly on both task commits.

## User Setup Required
None.

## Next Phase Readiness
- All lane UI components built and integrated; pending human visual verification (Task 3 checkpoint)
- Once verified: Phase 9 complete — full speaker lane layout system from data model through backend to UI

---
*Phase: 09-speaker-lane-layout*
*Completed: 2026-03-25*
