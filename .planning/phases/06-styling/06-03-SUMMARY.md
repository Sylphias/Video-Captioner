---
phase: 06-styling
plan: 03
subsystem: ui
tags: [react, typescript, css, tab-navigation, stage-workflow, speaker-diarization]

# Dependency graph
requires:
  - phase: 06-01
    provides: StyleProps types, speakerStyles store, design tokens
  - phase: 06-02
    provides: StylePanel, SpeakerStylePanel components, TranscriptEditor

provides:
  - StageTabBar: 4-tab navigation (Text/Timing/Speakers/Styling) with active + suggested-next indicator
  - SpeakersStage: self-contained speaker assignment stage with legend, diarize controls, phrase list
  - PreviewPanel collapse/expand via collapsed prop + onToggleCollapse callback
  - SubtitlesPage: stage-conditional rendering shell (all 4 stages wired)
affects:
  - 06-04: Text Editor stage plugs into 'text' slot in SubtitlesPage
  - 06-05: Timing Editor stage plugs into 'timing' slot in SubtitlesPage

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Stage navigation: StageId union type ('text'|'timing'|'speakers'|'styling') passed as prop to StageTabBar
    - Suggested-next-stage: visual indicator (green dot) on stage immediately after active, purely decorative
    - Collapsed panel: collapsed boolean prop controls render mode; thin 32px bar with expand button vs full player

key-files:
  created:
    - packages/frontend/src/components/StageTabBar.tsx
    - packages/frontend/src/components/StageTabBar.css
    - packages/frontend/src/components/SpeakersStage.tsx
    - packages/frontend/src/components/SpeakersStage.css
  modified:
    - packages/frontend/src/pages/SubtitlesPage.tsx
    - packages/frontend/src/pages/SubtitlesPage.css
    - packages/frontend/src/components/PreviewPanel.tsx
    - packages/frontend/src/components/PreviewPanel.css
    - packages/frontend/src/components/TranscriptEditor/TranscriptEditor.tsx
    - packages/frontend/src/components/TranscriptEditor/TranscriptEditor.css
    - packages/frontend/src/components/TranscriptEditor/WordCell.tsx

key-decisions:
  - "StageId type exported from StageTabBar.tsx so SubtitlesPage imports both component and type from one location"
  - "diarizeState/diarize/numSpeakers/setNumSpeakers passed as explicit props from SubtitlesPage to SpeakersStage — not read from Zustand since useDiarize is hook-scoped state"
  - "Preview collapse button: opacity 0 by default, shown on hover (using CSS :hover) — keeps UI clean"
  - "Text stage renders TranscriptEditor as temporary fallback beneath placeholder — app stays functional before Plan 04"
  - "Old SubtitlesPage tab bar CSS removed; StageTabBar.css provides replacement styles"

patterns-established:
  - "Stage components are self-contained: SpeakersStage receives all non-store state via explicit props"
  - "PreviewPanel collapse: thin 32px bar renders expand button; full mode shows collapse button on hover in corner"

# Metrics
duration: 25min
completed: 2026-03-08
---

# Phase 6 Plan 03: Stage Navigation Shell Summary

**4-stage workflow tab navigation (Text/Timing/Speakers/Styling) with collapsible preview panel, speaker assignment stage, and stage-conditional rendering in SubtitlesPage**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-08T00:00:00Z
- **Completed:** 2026-03-08T00:25:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- StageTabBar renders 4 tabs with active state (green underline) and suggested-next-stage green dot indicator
- SpeakersStage: speaker legend with editable names, diarize controls, phrase speaker assignment list with dropdown
- PreviewPanel: collapsed prop renders thin 32px bar with expand button; hover reveals collapse button when expanded
- SubtitlesPage: old 2-tab (Transcript/Style) replaced by 4-stage navigation; stage-conditional rendering complete
- Text stage falls back to existing TranscriptEditor so app remains functional before Plan 04

## Task Commits

Each task was committed atomically:

1. **Task 1: Create StageTabBar and SpeakersStage components** - `47c1182` (feat)
2. **Task 2: Restructure SubtitlesPage with stage navigation and collapsible preview** - `7c5105e` (feat)

**Plan metadata:** committed with docs commit

## Files Created/Modified

- `packages/frontend/src/components/StageTabBar.tsx` - 4-tab stage navigation component; exports StageId type
- `packages/frontend/src/components/StageTabBar.css` - Tab bar styles matching dark theme with green active indicator
- `packages/frontend/src/components/SpeakersStage.tsx` - Speaker assignment stage: legend, diarize controls, phrase list with badge dropdowns
- `packages/frontend/src/components/SpeakersStage.css` - Speaker stage styles with speaker-color lane tints
- `packages/frontend/src/pages/SubtitlesPage.tsx` - Restructured to 4-stage layout; previewCollapsed state added
- `packages/frontend/src/pages/SubtitlesPage.css` - Removed old tab bar styles; added stage-placeholder and collapsed-top modifier
- `packages/frontend/src/components/PreviewPanel.tsx` - Added collapsed + onToggleCollapse props; conditional render modes
- `packages/frontend/src/components/PreviewPanel.css` - Added collapsed bar style and collapse button hover states
- `packages/frontend/src/components/TranscriptEditor/TranscriptEditor.tsx` - Added insert-phrase-btn between rows
- `packages/frontend/src/components/TranscriptEditor/TranscriptEditor.css` - Insert phrase button styles; removed max-height constraint
- `packages/frontend/src/components/TranscriptEditor/WordCell.tsx` - Timestamp drag clamp: start < end-0.01, end > start+0.01

## Decisions Made

- **StageId exported from StageTabBar**: SubtitlesPage imports `type StageId` and `StageTabBar` from one import
- **Explicit props to SpeakersStage**: `useDiarize()` returns hook-scoped state, not Zustand — must flow through props
- **Preview collapse button visibility**: `opacity: 0` by default, `opacity: 1` on `.preview-panel:hover` — avoids cluttering the video player UI
- **Text stage keeps TranscriptEditor**: Placeholder alone would break editing workflow; TranscriptEditor renders as fallback under the placeholder text

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Included uncommitted TranscriptEditor and WordCell changes in Task 2 commit**
- **Found during:** Task 2 commit staging
- **Issue:** TranscriptEditor insert-phrase-btn and WordCell timestamp clamp were in working tree from prior 06-02 work, unstaged
- **Fix:** Included them in Task 2 commit — they're part of the same feature set and TypeScript-verified
- **Files modified:** TranscriptEditor.tsx, TranscriptEditor.css, WordCell.tsx
- **Verification:** TypeScript passes, part of Task 2 commit 7c5105e

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical commit)
**Impact on plan:** No scope creep. Pre-existing work from 06-02 checkpoint that needed to be committed.

## Issues Encountered

None — TypeScript compiled cleanly on both tasks.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Stage navigation shell complete; Plan 04 (Text Editor) plugs into the `activeStage === 'text'` slot in SubtitlesPage, replacing the placeholder + TranscriptEditor fallback
- Plan 05 (Timing Editor) plugs into the `activeStage === 'timing'` slot
- Speakers and Styling stages are fully functional today using existing components

## Self-Check: PASSED

- FOUND: packages/frontend/src/components/StageTabBar.tsx (48 lines, min 25)
- FOUND: packages/frontend/src/components/SpeakersStage.tsx (180 lines, min 40)
- FOUND: packages/frontend/src/pages/SubtitlesPage.tsx (restructured with stage navigation)
- FOUND commit: 47c1182 (Task 1 — StageTabBar + SpeakersStage)
- FOUND commit: 7c5105e (Task 2 — SubtitlesPage restructure + PreviewPanel collapse)
- TypeScript: passes clean (0 errors)

---
*Phase: 06-styling*
*Completed: 2026-03-08*
