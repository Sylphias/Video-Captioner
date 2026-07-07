---
phase: 12-ui-ux-layout-improvements
plan: 03
subsystem: ui
tags: [react, css, toolbar, word-timing, transcription-options]

requires:
  - phase: 12-ui-ux-layout-improvements (plan 01)
    provides: Center-column layout with Global Styling button removed from toolbar
  - phase: 12-ui-ux-layout-improvements (plan 02)
    provides: Compact bordered control pattern (goto-btn / srt-import-btn visual language)
provides:
  - Toolbar between preview and editor reorganized into labelled logical button groups with vertical separators (D-02 order)
  - Compact consistent toolbar button sizing via subtitles-page__toolbar-group / subtitles-page__toolbar-separator
  - Word Timing stage upgrades from checkpoint feedback - editable phrase start/end, drag-to-scrub time inputs, edge-drag phrase chunks, playhead auto-centering, same-speaker phrase nav with ArrowLeft/ArrowRight hotkeys
  - Transcription options dialog (max words / max chars per line) on upload and re-transcribe; char cap held as session state and applied in all regrouping
  - App header title navigates back to the projects page
affects: [13-project-persistence, future editor phases touching SubtitlesPage toolbar or TimingEditor]

tech-stack:
  added: []
  patterns:
    - "Toolbar grouping: subtitles-page__toolbar-group divs with tight internal gap, subtitles-page__toolbar-separator 1px dividers at major cluster boundaries"
    - "Drag-to-scrub numeric inputs with a single undo entry per gesture (TimingEditor)"
    - "Transcription prefs persisted via lib/transcriptionPrefs.ts and seeded into dialogs"

key-files:
  created:
    - packages/frontend/src/components/TranscriptionOptionsDialog.tsx
    - packages/frontend/src/components/TranscriptionOptionsDialog.css
    - packages/frontend/src/lib/transcriptionPrefs.ts
  modified:
    - packages/frontend/src/pages/SubtitlesPage.tsx
    - packages/frontend/src/pages/SubtitlesPage.css
    - packages/frontend/src/components/TimingEditor/TimingEditor.tsx
    - packages/frontend/src/components/TimingEditor/TimingEditor.css
    - packages/frontend/src/store/subtitleStore.ts
    - packages/frontend/src/lib/grouping.ts
    - packages/frontend/src/pages/ProjectsPage.tsx
    - packages/frontend/src/components/Header.tsx

key-decisions:
  - "Go to Subtitle control removed from the toolbar entirely per checkpoint feedback (superseded the D-05 'goto leads first group' placement)"
  - "Char cap promoted to session state in subtitleStore so it participates in every regrouping, not just initial transcription"
  - "Re-transcribe flows (toolbar and projects page) prompt with a TranscriptionOptionsDialog prefilled from the session's own caps"
  - "Default font weight Regular and highlight linger 0.4s per checkpoint feedback"

patterns-established:
  - "Toolbar group/separator pattern: group divs carry tight gaps, separators mark major cluster boundaries - reuse for any future toolbar additions"

requirements-completed: [D-01, D-02, D-03, D-05]

coverage:
  - id: D1
    description: "Toolbar organized into logical grouped clusters with two vertical separators in D-02 order, compact consistent button sizing"
    requirement: "D-01"
    verification:
      - kind: unit
        ref: "grep acceptance criteria in 12-03-PLAN.md Tasks 1-2 (group/separator classes in CSS and TSX, handlers preserved) + frontend tsc --noEmit"
        status: pass
    human_judgment: true
    rationale: "Visual grouping quality is a subjective appearance judgment; confirmed at the phase-level human-verify checkpoint"
  - id: D2
    description: "Full Phase 12 UI restructure (layout, panels, tabs, toolbar) passes human visual check in the running app"
    requirement: "D-02, D-03, D-05"
    verification: []
    human_judgment: true
    rationale: "Blocking checkpoint:human-verify - user tested the flow in the running app and approved on 2026-07-07"

duration: ~2 days (multiple checkpoint-feedback sessions)
completed: 2026-07-07
status: complete
---

# Phase 12 Plan 03: Grouped Toolbar + Phase-Level Human Verify Summary

**Reorganized the SubtitlesPage toolbar into grouped clusters with separators, then absorbed several rounds of checkpoint feedback (Word Timing editing upgrades, transcription options dialog, header nav) before the user approved the full Phase 12 restructure.**

## Performance

- **Duration:** ~2 days across sessions (2026-07-02 to 2026-07-03 implementation, approved 2026-07-07)
- **Started:** 2026-07-02T21:34:40+08:00
- **Completed:** 2026-07-07 (human-verify approval)
- **Tasks:** 2 auto + 1 blocking human-verify checkpoint, plus ~20 checkpoint-feedback commits
- **Files modified:** 23

## Accomplishments
- Toolbar wrapped into D-02 grouped clusters — [Undo/Redo] [Save] [Time Shift] | [Render/Download] | [Re-transcribe, Replace Video, Upload new] — with 1px separator dividers and compact bordered sizing
- Go to Subtitle control removed per checkpoint feedback (search superseded it)
- Word Timing stage substantially upgraded from feedback: editable phrase start/end (inline inputs at word-row ends), edge-drag phrase chunks on the timeline, drag-to-scrub on all time inputs (one undo per gesture), viewport auto-centering on playhead, same-speaker prev/next phrase nav (card header + ArrowLeft/ArrowRight hotkeys), Enter-split inherits source speaker
- Transcription options dialog (max words / max chars per line) shown before upload and re-transcribe on both the projects page and the toolbar; char cap became session state participating in all regrouping; dialogs prefill from the session's own caps
- App header title now navigates back to the projects page; Import SRT and Find & Replace buttons standardised to the compact bordered pattern; StageTabBar.css import fixed (unstyled tab rendering)

## Task Commits

1. **Task 1: Add toolbar group and separator CSS** - `5c8ded2` (feat)
2. **Task 2: Wrap toolbar buttons into logical groups per D-02** - `6a9e9ee` (feat)
3. **Task 3: Human-verify checkpoint feedback fixes** - `0cee065`..`21e8e1e` (~20 commits: Word Timing upgrades, transcription options dialog, header nav, styling standardisation)

## Files Created/Modified
- `packages/frontend/src/pages/SubtitlesPage.tsx/.css` - Toolbar grouping markup + group/separator CSS; Re-transcribe options flow
- `packages/frontend/src/components/TimingEditor/TimingEditor.tsx/.css` - Editable phrase times, drag-to-scrub, edge-drag chunks, auto-center, phrase nav
- `packages/frontend/src/components/TranscriptionOptionsDialog.tsx/.css` - New dialog for max words/chars per line
- `packages/frontend/src/lib/transcriptionPrefs.ts` - Persisted transcription option preferences
- `packages/frontend/src/store/subtitleStore.ts`, `lib/grouping.ts` - Char cap as session state, participates in regrouping
- `packages/frontend/src/pages/ProjectsPage.tsx` - Options dialog before upload/re-transcribe
- `packages/frontend/src/components/Header.tsx/.css` - Title navigates to projects page

## Decisions Made
- Removed Go to Subtitle from the toolbar entirely (checkpoint feedback) — deviates from the plan's original "goto leads Group A" structure; groups are now [Undo/Redo] [Save] [Time Shift] | [Render/Download] | [re-ingest cluster]
- Char cap stored in session state rather than only as a transcription-time parameter, so manual regrouping respects it
- Default font weight Regular and highlight linger 0.4s per checkpoint feedback

## Deviations from Plan
- Go to Subtitle control removed instead of leading the first toolbar group (user feedback during checkpoint)
- Checkpoint feedback expanded scope well beyond toolbar markup: Word Timing editing upgrades, transcription options dialog, header navigation — all committed atomically under 12-03

## Issues Encountered
- StageTabBar rendered unstyled because its CSS was never imported — fixed in `38d1435`

## User Setup Required

None.

## Next Phase Readiness
- Phase 12 fully human-verified (user tested the flow in the running app and approved)
- All three plans complete; phase ready to close

---
*Phase: 12-ui-ux-layout-improvements*
*Completed: 2026-07-07*

## Self-Check: PASSED
