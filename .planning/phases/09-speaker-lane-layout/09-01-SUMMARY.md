---
phase: 09-speaker-lane-layout
plan: 01
subsystem: ui
tags: [zustand, remotion, typescript, speaker-lanes, undo-redo]

# Dependency graph
requires:
  - phase: 08-animation-builder
    provides: keyframe animation system that lane positioning stacks on top of
  - phase: 04.1-multi-speaker-diarization
    provides: dominantSpeaker field on phrases, diarization completion lifecycle
provides:
  - SpeakerLane, LaneLayout, LanePreset types in shared-types
  - speakerLanes/overlapGap/maxVisibleRows store state with full undo/redo support
  - Fixed lane-based positioning in SubtitleOverlay replacing greedy assignSlots()
  - speakerLanes plumbed through PreviewPanel inputProps to Remotion composition
  - Auto-distribution of speaker lanes on diarization complete and page-refresh job load
affects:
  - 09-02 (LaneControlsPanel UI depends on setSpeakerLane/setOverlapGap/setMaxVisibleRows)
  - 09-03 (LaneDragOverlay depends on speakerLanes in PreviewPanel)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fixed lane lookup (getLanePosition) replaces greedy slot assignment (assignSlots)
    - Per-phrase styleOverride > speakerLanes > global style.verticalPosition precedence
    - initSpeakerLanes auto-distributes only when speakerLanes is empty (no customization yet)
    - Auto-distribute formula: base=85%, step down by overlapGap per speaker index

key-files:
  created: []
  modified:
    - packages/shared-types/src/index.ts
    - packages/frontend/src/store/subtitleStore.ts
    - packages/frontend/src/store/undoMiddleware.ts
    - packages/frontend/src/pages/SubtitlesPage.tsx
    - packages/remotion-composition/src/types.ts
    - packages/remotion-composition/src/SubtitleOverlay.tsx
    - packages/remotion-composition/src/SubtitleComposition.tsx
    - packages/frontend/src/components/PreviewPanel.tsx

key-decisions:
  - "speakerLanes is a separate Record<string, SpeakerLane> field — not stored in speakerStyles.verticalPosition — to keep positioning authoritative and separate from style overrides"
  - "assignSlots() greedy algorithm removed entirely — replaced by deterministic getLanePosition() lookup"
  - "maxVisibleRows cap applies after speaker deduplication (latestBySpeaker) — sorts by newest first, takes N"
  - "initSpeakerLanes guards Object.keys(speakerLanes).length === 0 — only auto-distributes before any user customization"
  - "loadLaneLayout maps preset positions to current speakers by descending position order, not ID match — speaker IDs differ across videos"
  - "speakerLanes optional in SubtitleCompositionProps for backward compatibility with AnimationBuilder KeyframePreview"

patterns-established:
  - "Lane position precedence: phrase.styleOverride.verticalPosition > speakerLanes[id].verticalPosition > style.verticalPosition (global)"
  - "sameSlotOffset=0 always since latestBySpeaker keeps only one phrase per speaker at a time"

# Metrics
duration: 7min
completed: 2026-03-25
---

# Phase 9 Plan 01: Speaker Lane Layout — Core Data Model Summary

**Per-speaker fixed vertical lane positioning with SpeakerLane types, Zustand store extension, full undo/redo support, and getLanePosition() replacing assignSlots() in the Remotion overlay**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-25T15:35:18Z
- **Completed:** 2026-03-25T15:42:05Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added `SpeakerLane`, `LaneLayout`, `LanePreset` types to shared-types with full TypeScript export
- Extended subtitleStore with `speakerLanes`, `overlapGap`, `maxVisibleRows` fields and five new actions (`setSpeakerLane`, `setOverlapGap`, `setMaxVisibleRows`, `initSpeakerLanes`, `loadLaneLayout`)
- Replaced greedy `assignSlots()` algorithm in SubtitleOverlay with deterministic `getLanePosition()` fixed-lane lookup
- Plumbed lane fields through `SubtitleCompositionProps` → `SubtitleComposition` → `SubtitleOverlay` → `PreviewPanel.inputProps`
- Auto-distribution initializes on diarization complete and on page-refresh job load

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, store extension, and undo support for speaker lanes** - `b35fed7` (feat)
2. **Task 2: SubtitleOverlay lane-based positioning and PreviewPanel inputProps plumbing** - `0e0de8f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/shared-types/src/index.ts` - Added SpeakerLane, LaneLayout, LanePreset type exports
- `packages/frontend/src/store/subtitleStore.ts` - Lane fields + 5 new actions, initSpeakerLanes called from setJob
- `packages/frontend/src/store/undoMiddleware.ts` - StateSnapshot extended with speakerLanes/overlapGap/maxVisibleRows
- `packages/frontend/src/pages/SubtitlesPage.tsx` - handleUndo/handleRedo/timeShift snapshots include lane fields; diarization-done effect calls initSpeakerLanes
- `packages/remotion-composition/src/types.ts` - speakerLanes/overlapGap/maxVisibleRows added to SubtitleCompositionProps
- `packages/remotion-composition/src/SubtitleOverlay.tsx` - getLanePosition() replaces assignSlots(); maxVisibleRows cap; lane fields added to SubtitleOverlayProps
- `packages/remotion-composition/src/SubtitleComposition.tsx` - Passes new props through to SubtitleOverlay
- `packages/frontend/src/components/PreviewPanel.tsx` - Imports and passes speakerLanes/overlapGap/maxVisibleRows in inputProps useMemo

## Decisions Made
- `speakerLanes` is a standalone field separate from `speakerStyles.verticalPosition` — keeps lane positions authoritative and avoids confusion with legacy per-speaker style overrides
- `assignSlots()` removed entirely (not kept as fallback) — the fixed-lane model is strictly better for this use case
- `loadLaneLayout` maps by position order descending, not speaker ID — speaker IDs don't match across different videos
- Optional fields in `SubtitleCompositionProps` for full backward compatibility with AnimationBuilder

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- `tsconfig.build.json` exists at root (no `tsconfig.json`) so `npx tsc --build --noEmit` from root fails with project references + noEmit conflict — verified each package independently with `npx tsc --noEmit` instead.

## Next Phase Readiness
- Foundation complete: store has lane state, overlay uses fixed positions, inputProps wired
- Ready for Plan 02: LaneControlsPanel UI with numeric inputs, proximity warnings, and preset management
- Ready for Plan 03: LaneDragOverlay drag handles on the Remotion Player preview

---
*Phase: 09-speaker-lane-layout*
*Completed: 2026-03-25*
