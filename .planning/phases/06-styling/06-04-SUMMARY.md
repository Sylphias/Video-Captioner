---
phase: 06-styling
plan: 04
subsystem: ui
tags: [react, typescript, css, text-editor, undo-redo, zustand, screenplay, contentEditable]

# Dependency graph
requires:
  - phase: 06-03
    provides: StageTabBar, SubtitlesPage 4-stage shell with text/timing/speakers/styling slots
  - phase: 06-01
    provides: subtitleStore with session/words/phrases/style/speakerNames/speakerStyles
  - phase: 04-01
    provides: SessionWord, SessionPhrase, buildSessionPhrases, splitPhrase, mergePhrase

provides:
  - TextEditor component: screenplay-style numbered-line phrase editor in Text stage
  - useUndoStore: separate Zustand store with past/future stacks, pushSnapshot, undo, redo
  - updatePhraseText action: text-only phrase editing with timestamp redistribution
  - restoreSnapshot: hydrates subtitle store from StateSnapshot
  - Global Cmd+Z / Cmd+Shift+Z keyboard shortcuts for undo/redo
affects:
  - 06-05: Timing Editor stage plugs into timing slot; undo/redo system is shared
  - Any future editing: pushUndo() now wired into all mutating subtitleStore actions

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Undo/redo via separate Zustand store (not middleware): useUndoStore holds past/future stacks; subtitleStore pushes snapshots via pushUndo() helper before each mutation
    - Snapshot pattern: StateSnapshot uses structuredClone + Set->Array serialization for safe deep-copy
    - contentEditable line editing: blur handler parses innerText to words, calls updatePhraseText; keydown handles Enter (split) and Backspace-at-start (merge)
    - Click-to-seek via line number buttons: phraseIndex -> phrase.words[0].start -> seekToTime()
    - Speaker dots via data-speaker-index CSS attribute (matches existing SpeakersStage pattern)

key-files:
  created:
    - packages/frontend/src/components/TextEditor/TextEditor.tsx
    - packages/frontend/src/components/TextEditor/TextEditor.css
    - packages/frontend/src/store/undoMiddleware.ts
  modified:
    - packages/frontend/src/store/subtitleStore.ts
    - packages/frontend/src/pages/SubtitlesPage.tsx
    - packages/frontend/src/pages/SubtitlesPage.css

key-decisions:
  - "useUndoStore is a separate Zustand store (not middleware on subtitleStore) — avoids circular complexity; subtitleStore calls useUndoStore.getState().pushSnapshot() before each mutation"
  - "undo(currentSnapshot)/redo(currentSnapshot) accept the current state at call time — pushed to the opposite stack before restoring target; caller (SubtitlesPage) provides current snapshot"
  - "StateSnapshot.manualSplitWordIndices stored as number[] (not Set) — structuredClone cannot clone Set; re-hydrated to Set in restoreSnapshot"
  - "updatePhraseText: same word count -> text-only update preserving original timestamps; different word count -> redistribute timestamps evenly across phrase time window"
  - "TextEditor uses contentEditable divs per phrase line — blur fires updatePhraseText; Enter/Backspace keydown handled before browser default"
  - "TranscriptEditor import removed from SubtitlesPage — replaced by TextEditor in text stage; no fallback needed"

patterns-established:
  - "Undo snapshot push is always done inside set() callback before the mutation returns, ensuring atomicity with the state update"
  - "Speaker indicator dot uses data-speaker-index CSS attribute matching existing SpeakersStage pattern for consistent speaker colors"

# Metrics
duration: 6min
completed: 2026-03-08
---

# Phase 6 Plan 04: Text Editor and Undo/Redo Summary

**Screenplay-style numbered-line phrase editor with inline text editing, Enter/Backspace split/merge, click-to-seek, and a snapshot-based undo/redo system wired into all subtitleStore mutations**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-08T10:55:49Z
- **Completed:** 2026-03-08T11:01:49Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- TextEditor renders all phrases as numbered lines — no timestamps, clean script-like view
- Click on a line number seeks the video preview to that phrase's start time
- Inline text editing via contentEditable; blur saves via updatePhraseText with timestamp redistribution for word count changes
- Enter key splits phrase at cursor word boundary; Backspace at line start merges with previous phrase
- Speaker indicator dots per line (when speakers are detected), colored by speaker index
- useUndoStore: separate Zustand store with past/future stacks (capped at 50), pushSnapshot/undo/redo
- All subtitleStore mutating actions (updateWord, splitPhrase, mergePhrase, addWord, addPhrase, deleteWord, setStyle, setSpeakerStyle, clearSpeakerStyle, renameSpeaker, reassignWordSpeaker, updatePhraseText) push snapshots to undo stack before applying
- Global Cmd+Z / Cmd+Shift+Z keyboard shortcuts in SubtitlesPage; Undo/Redo buttons in controls bar with disabled states

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement undo/redo middleware for Zustand store** - `9d378dd` (feat)
2. **Task 2: Build TextEditor component and wire into SubtitlesPage** - `2c87d95` (feat)

**Plan metadata:** committed with docs commit

## Files Created/Modified

- `packages/frontend/src/store/undoMiddleware.ts` - useUndoStore with past/future stacks, pushSnapshot, undo(currentSnapshot), redo(currentSnapshot); StateSnapshot type with number[] for manualSplitWordIndices
- `packages/frontend/src/store/subtitleStore.ts` - Added pushUndo() helper, updatePhraseText action, restoreSnapshot export; all mutating actions now push to undo stack before mutating
- `packages/frontend/src/components/TextEditor/TextEditor.tsx` - Screenplay-style editor: numbered lines, click-to-seek, speaker dots, contentEditable editing, Enter split, Backspace merge, add-line button
- `packages/frontend/src/components/TextEditor/TextEditor.css` - Dark theme styles: gutter numbers, speaker dots, green focus underline, active line class, dashed add-line button
- `packages/frontend/src/pages/SubtitlesPage.tsx` - Import TextEditor; wire into text stage (replacing placeholder + TranscriptEditor fallback); add Cmd+Z/Cmd+Shift+Z keyboard listener; add Undo/Redo buttons
- `packages/frontend/src/pages/SubtitlesPage.css` - Added .subtitles-page__undo-controls and .subtitles-page__undo-btn styles

## Decisions Made

- **Separate undo store**: `useUndoStore` is its own Zustand store rather than middleware. Avoids circular dependency where subtitleStore would need to reference itself. subtitleStore calls `useUndoStore.getState().pushSnapshot()` directly.
- **undo/redo accept currentSnapshot parameter**: SubtitlesPage captures current state, passes to `undo(currentSnapshot)` / `redo(currentSnapshot)` so they can push it to the opposite stack atomically.
- **StateSnapshot uses number[] for manualSplitWordIndices**: `structuredClone` cannot handle `Set`; serialized to Array in `captureSnapshot`, re-hydrated to `new Set(array)` in `restoreSnapshot`.
- **updatePhraseText timestamp redistribution**: Same word count -> preserve original timestamps (text-only); different word count -> distribute evenly across `[phrase.words[0].start, phrase.words[-1].end]` window.
- **TranscriptEditor removed from text stage**: No longer needed. TextEditor provides all editing functionality. The plan's "temporary fallback" from Plan 03 is replaced.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added restoreSnapshot as exported function**
- **Found during:** Task 1 (undo store design)
- **Issue:** Plan specified undo/redo call `useSubtitleStore.setState()` to restore snapshots, but without a dedicated helper, the SubtitlesPage would need to know internal store shape details
- **Fix:** Created `restoreSnapshot(snapshot: StateSnapshot)` as an exported function in subtitleStore.ts; handles Set re-hydration from number[], uses structuredClone for deep copy. SubtitlesPage calls this instead of directly calling setState.
- **Files modified:** packages/frontend/src/store/subtitleStore.ts
- **Verification:** TypeScript passes clean; restoreSnapshot correctly re-hydrates session with Set and all snapshot fields
- **Committed in:** 9d378dd (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing abstraction for clean API boundary)
**Impact on plan:** No scope creep. The restoreSnapshot helper is the correct way to encapsulate the snapshot restoration logic and handle the Set re-hydration concern.

## Issues Encountered

- TypeScript 2352 error: `structuredClone(state.style) as Record<string, unknown>` — StyleProps lacks index signature. Fixed by using `as unknown as Record<string, unknown>` double assertion. Same pattern applied for speakerStyles.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Text stage is fully functional: numbered lines, inline editing, split/merge, click-to-seek, undo/redo
- Timing Editor (Plan 05) plugs into `activeStage === 'timing'` slot in SubtitlesPage; undo/redo system is already shared and will cover timing edits too
- Undo/redo keyboard shortcuts and buttons are globally active for all editing stages

## Self-Check: PASSED

- FOUND: packages/frontend/src/components/TextEditor/TextEditor.tsx (214 lines, min 80)
- FOUND: packages/frontend/src/components/TextEditor/TextEditor.css (136 lines, min 40)
- FOUND: packages/frontend/src/store/undoMiddleware.ts (118 lines, min 40)
- FOUND commit: 9d378dd (Task 1 — undo/redo store + subtitleStore integration)
- FOUND commit: 2c87d95 (Task 2 — TextEditor + SubtitlesPage wiring)
- TypeScript: passes clean (0 errors)

---
*Phase: 06-styling*
*Completed: 2026-03-08*
