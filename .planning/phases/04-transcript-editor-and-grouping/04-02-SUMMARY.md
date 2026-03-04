---
phase: 04-transcript-editor-and-grouping
plan: 02
subsystem: ui
tags: [react, zustand, typescript, karaoke, transcript-editor, inline-editing]

# Dependency graph
requires:
  - phase: 04-transcript-editor-and-grouping/plan-01
    provides: two-layer Zustand store (updateWord/splitPhrase/mergePhrase/addWord/deleteWord), buildSessionPhrases, SessionWord/SessionPhrase types, PreviewPanel with onSeekReady/onGetTimeReady

provides:
  - WordCell component: inline-editable word text + start/end timestamp inputs, click-to-seek
  - PhraseRow component: phrase label, word cells, split buttons between words, merge-with-next button
  - TranscriptEditor component: reads session.phrases from Zustand, renders PhraseRow list with add-phrase button
  - SubtitlesPage: TranscriptEditor replaces TranscriptView; seekToTime wired from PreviewPanel; go-to-subtitle button

affects:
  - 05-render (composition receives phrases[] — no change needed from this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "WordCell uses local useState for text/timestamps — controlled inputs synced from prop on key reset, not on every render"
    - "key={wordIndex + '-' + word.word} on WordCell resets local state when external word prop changes (re-transcribe scenario)"
    - "Split buttons hidden by default (opacity:0), revealed on .phrase-row:hover — avoids visual clutter on dense transcripts"
    - "onDeleteWord/onAddWord extra props beyond plan spec added as Rule 2 auto-fixes for editing completeness"
    - "go-to-subtitle binary-searches session.words for word active at current player time, scrolls with smooth behavior + flash animation"

key-files:
  created:
    - packages/frontend/src/components/TranscriptEditor/WordCell.tsx
    - packages/frontend/src/components/TranscriptEditor/PhraseRow.tsx
    - packages/frontend/src/components/TranscriptEditor/TranscriptEditor.tsx
    - packages/frontend/src/components/TranscriptEditor/TranscriptEditor.css
  modified:
    - packages/frontend/src/pages/SubtitlesPage.tsx
    - packages/frontend/src/pages/SubtitlesPage.css
    - packages/frontend/src/store/subtitleStore.ts

key-decisions:
  - "seekToTime stored as ((timeSec: number) => void) | null in useState — wrapped in arrow on set to prevent React from calling it as initializer"
  - "WordCell click seeks to word.start time (not midpoint) — click registers intent to play from that word's beginning"
  - "Split button splitBeforeWordIndex is phrase-local (0-based within phrase) — PhraseRow passes this to store's splitPhrase which uses phraseIndex+local to compute global"
  - "addWord/deleteWord/addPhrase added to store beyond plan spec — completing editing CRUD required for usable transcript editor"
  - "go-to-subtitle uses data-word-index DOM attribute for scroll target — avoids React ref arrays, consistent with existing word-cell pattern"

patterns-established:
  - "TranscriptEditor directory holds all three component files + single CSS — co-located, tree-shakeable unit"
  - "onDeleteWord/onAddWord thread through PhraseRow to WordCell — avoids prop-drilling store into leaf components"

# Metrics
duration: ~1 day (implementation pre-existed from prior session; this session: verification + docs)
completed: 2026-03-04
---

# Phase 4 Plan 02: Transcript Editor UI Summary

**Inline-editable transcript editor with word text + timestamp inputs, phrase split/merge controls, word-click-to-seek, and go-to-subtitle — human-verified end-to-end**

## Performance

- **Duration:** Implementation completed in prior session; checkpoint verified 2026-03-04
- **Started:** 2026-03-03
- **Completed:** 2026-03-04T11:23:56Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- Built WordCell with inline text editing (click-to-edit, blur/Enter commits), start/end timestamp number inputs, and word-click-to-seek
- Built PhraseRow with phrase label (#N), word cells, split buttons between words (hover to reveal), and "Merge with next" button
- Built TranscriptEditor reading session.phrases from Zustand, rendering PhraseRow list, exposing add-phrase action
- Wired TranscriptEditor into SubtitlesPage replacing read-only TranscriptView; seekToTime flows from PreviewPanel
- Added go-to-subtitle button that binary-searches current playback position and scrolls + flashes the matching word in the editor
- Extended store with addWord, addPhrase, deleteWord actions (beyond plan spec) to complete CRUD editing capability
- Human verification confirmed: word editing, timestamp adjustment, phrase display, split, merge, seek all working end-to-end

## Task Commits

1. **Task 1: Create TranscriptEditor components (WordCell, PhraseRow, TranscriptEditor)** - `e9718c0` (feat)
2. **Task 2: Wire TranscriptEditor into SubtitlesPage replacing TranscriptView** - `aae4326` (feat)
3. **Task 2+: Editor UX enhancements (go-to-subtitle, add/delete word, phrase seek)** - `c5594dd` (feat)
4. **Task 3: Human verification approved** — checkpoint passed (no commit needed)

## Files Created/Modified

- `packages/frontend/src/components/TranscriptEditor/WordCell.tsx` - Inline-editable word: text input + start/end timestamp inputs, click-to-seek, delete button
- `packages/frontend/src/components/TranscriptEditor/PhraseRow.tsx` - Phrase container: label, word cells, split buttons between words, merge-with-next button, add-word button
- `packages/frontend/src/components/TranscriptEditor/TranscriptEditor.tsx` - Top-level: reads session.phrases from Zustand, renders PhraseRow list, add-phrase button, phrase/word counts header
- `packages/frontend/src/components/TranscriptEditor/TranscriptEditor.css` - Co-located styles using only design tokens; split button hover reveal pattern
- `packages/frontend/src/pages/SubtitlesPage.tsx` - TranscriptEditor replaces TranscriptView; seekToTime + getCurrentTime wired from PreviewPanel; go-to-subtitle button
- `packages/frontend/src/pages/SubtitlesPage.css` - `.subtitles-page__editor-section` replaces `.subtitles-page__transcript-section`; go-to-subtitle button style
- `packages/frontend/src/store/subtitleStore.ts` - Added addWord, addPhrase, deleteWord actions beyond original plan spec

## Decisions Made

- `seekToTime` stored as `((timeSec: number) => void) | null` in `useState` — wrapped in arrow on set (`setSeekToTime(() => fn)`) to prevent React from calling it as a state initializer
- `WordCell` click seeks to `word.start` (not midpoint) — clicking a word signals intent to play from its beginning
- Split button `splitBeforeWordIndex` is phrase-local (1-indexed within phrase) — PhraseRow passes it directly to `store.splitPhrase(phraseIndex, localIndex)` which computes the global split point
- `addWord`, `deleteWord`, `addPhrase` added to store and wired through components — plan specified text+timestamp editing and split/merge, but a transcript editor without add/delete is not usable in practice (Rule 2)
- `go-to-subtitle` uses `document.querySelector('[data-word-index="${idx}"]')` for the scroll target — avoids React ref arrays; consistent with `data-word-index` attribute already on WordCell div

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added word delete and add-word buttons to WordCell/PhraseRow**
- **Found during:** Task 1 (WordCell implementation)
- **Issue:** Plan specified editing word text and timestamps, split/merge — but without delete and add, users cannot fix hallucinated words or add missing ones. A transcript editor without CRUD is not functionally complete.
- **Fix:** Added `onDeleteWord` prop to WordCell (small "x" button, absolute-positioned top-right, opacity:0 revealed on hover); added `onAddWord` prop to PhraseRow ("+" button at end of word row); added `addWord`, `deleteWord`, `addPhrase` actions to Zustand store with correct global index shifting and manual split index adjustment
- **Files modified:** `WordCell.tsx`, `PhraseRow.tsx`, `TranscriptEditor.tsx`, `TranscriptEditor.css`, `subtitleStore.ts`
- **Verification:** TypeScript compiles cleanly; human verification confirmed delete/add work in browser
- **Committed in:** `e9718c0` (Task 1), `c5594dd` (UX enhancements)

**2. [Rule 2 - Missing Critical] Added go-to-subtitle navigation button**
- **Found during:** Task 2 (SubtitlesPage wiring)
- **Issue:** With 50vh scrollable editor and a long transcript, users have no way to find the word currently playing in the video. The editor and preview become disconnected during playback.
- **Fix:** Added "Go to subtitle" button in SubtitlesPage that reads current player time via `getCurrentTime()` (exposed via `onGetTimeReady` prop on PreviewPanel), binary-searches `session.words` for the matching word index, then scrolls the corresponding `[data-word-index]` element into view with a 1s green flash animation
- **Files modified:** `SubtitlesPage.tsx`, `SubtitlesPage.css`, `PreviewPanel.tsx` (added `onGetTimeReady` prop)
- **Verification:** Human verification confirmed go-to-subtitle scrolls and highlights correctly during playback
- **Committed in:** `aae4326`, `c5594dd`

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical functionality)
**Impact on plan:** Both additions essential for usable transcript editing. No scope creep — they complete the editing workflow rather than extending it.

## Issues Encountered

None — implementation was complete and TypeScript-clean before verification checkpoint.

## User Setup Required

None — no external service configuration required.

## Future UX Improvements (Noted by User, Deferred)

The following were noted during human verification but deferred to a future plan:
- **Drag-to-adjust timestamps**: Click-drag on timestamp inputs to scrub the value (more ergonomic than typing)
- **Split button usability**: Split buttons are hard to click when words are closely spaced — wider hit area or alternative interaction needed

## Next Phase Readiness

- Transcript editor is complete and human-verified; all four requirements satisfied (EDIT-01, EDIT-02, GROUP-01, GROUP-02)
- Phase 4 (Transcript Editor and Grouping) is fully complete — both plans done
- Phase 5 (Render): `renderMedia()` API signature and `onProgress` callback shape should be verified against current remotion.dev/docs before implementation; `session.phrases` already available in the store for the render pipeline

---
*Phase: 04-transcript-editor-and-grouping*
*Completed: 2026-03-04*

## Self-Check: PASSED

Files verified:
- `packages/frontend/src/components/TranscriptEditor/WordCell.tsx` — EXISTS (94 lines)
- `packages/frontend/src/components/TranscriptEditor/PhraseRow.tsx` — EXISTS (86 lines)
- `packages/frontend/src/components/TranscriptEditor/TranscriptEditor.tsx` — EXISTS (62 lines)
- `packages/frontend/src/components/TranscriptEditor/TranscriptEditor.css` — EXISTS (255 lines)
- `packages/frontend/src/pages/SubtitlesPage.tsx` — EXISTS, imports TranscriptEditor
- `packages/frontend/src/pages/SubtitlesPage.css` — EXISTS, contains `.subtitles-page__editor-section`

Commits verified in git log: `e9718c0`, `aae4326`, `c5594dd` all present.
TypeScript compilation: exits 0 (`npx tsc --build tsconfig.build.json`).
Human verification: approved — "Yep they all work."
