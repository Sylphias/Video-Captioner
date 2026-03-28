---
phase: 10-srt-import-and-text-correction
plan: "01"
subsystem: ui
tags: [vitest, srt-parser-2, diff, srt, alignment, transcript, testing]

# Dependency graph
requires:
  - phase: 04-transcript-editor-and-grouping
    provides: SessionWord, SessionPhrase, buildSessionPhrases from grouping.ts
  - phase: 06-styling
    provides: subtitleStore with pushUndo/buildSessionPhrases mutation pattern
provides:
  - parseSrt: parses raw SRT content into SrtCue[] (HTML stripping, multiline join, empty skip)
  - alignSrtToWhisper: matches SRT cues to Whisper phrases by time overlap, returns AlignedPhrase[] with proportional timing
  - applySrtPhrase: store action replacing phrase words with undo support and manual split adjustment
  - useSrtImport: hook orchestrating file import, alignment against original transcript, accept/reject per phrase
  - vitest + srtAlignment.test.ts: 20 unit tests covering all alignment edge cases
affects: [10-02-ui, future transcript import features]

# Tech tracking
tech-stack:
  added:
    - vitest@4.1.2 (unit test runner for frontend)
    - "@vitest/coverage-v8"
    - srt-parser-2 (SRT file parsing)
    - diff (text diff library, available for 10-02 UI)
    - "@types/diff"
  patterns:
    - TDD red-green: failing tests written first, then implementation to pass them
    - Pure-function alignment library with store action separation
    - useCallback hook wrapping all returned functions (useTranscribe pattern)
    - Original-vs-session alignment: D-12 requirement to align SRT against original Whisper timestamps

key-files:
  created:
    - packages/frontend/vitest.config.ts
    - packages/frontend/src/lib/srtAlignment.ts
    - packages/frontend/src/lib/srtAlignment.test.ts
    - packages/frontend/src/hooks/useSrtImport.ts
  modified:
    - packages/frontend/package.json (vitest/test scripts, srt-parser-2/diff deps)
    - packages/frontend/src/store/subtitleStore.ts (applySrtPhrase action)

key-decisions:
  - "vitest run npm script added to frontend package.json; vitest hoisted to root node_modules as workspace dep"
  - "distributeTimings uses end=start+perWord (not independently computed) to guarantee exact per-word duration respecting IEEE 754"
  - "Test minimum duration uses toBeGreaterThanOrEqual(0.01-1e-10) epsilon to handle IEEE 754 floating point edge cases"
  - "useSrtImport.acceptPhrase uses timestamp-based overlap matching to find current phrase index after previous accepts cause drift"
  - "SRT alignment runs against store.original (not session) per D-12 so re-import always anchors to original Whisper timestamps"

patterns-established:
  - "Pure function alignment lib (srtAlignment.ts) tested independently of React — zero React imports in lib"
  - "Hook (useSrtImport) orchestrates store access via useSubtitleStore.getState() to avoid stale closures"
  - "Reset-first pattern in importFile: reset() called before async work to clear previous state per D-12"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-03-28
---

# Phase 10 Plan 01: SRT Import Logic Summary

**SRT parsing and Whisper alignment as pure functions with 20 vitest unit tests, plus applySrtPhrase store action and useSrtImport hook**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T04:06:01Z
- **Completed:** 2026-03-28T04:12:00Z
- **Tasks:** 3 (Task 0, Task 1, Task 2)
- **Files modified:** 6

## Accomplishments

- Installed vitest with frontend npm test script; 20 unit tests cover parseSrt and alignSrtToWhisper edge cases
- parseSrt: strips HTML tags, joins multiline text, skips empty/whitespace cues, returns SrtCue[]
- alignSrtToWhisper: two-stage time-overlap matching producing AlignedPhrase[] with proportionally-timed replacement words, speaker labels preserved from dominantSpeaker, identical-text phrases skipped
- applySrtPhrase store action: replaces phrase words, adjusts manualSplitWordIndices with delta shift, pushes undo
- useSrtImport hook: importFile aligns against original Whisper transcript (D-12), acceptPhrase uses timestamp-based matching to handle index drift after previous accepts, reset clears file input for re-import

## Task Commits

1. **Task 0: Install vitest and create test infrastructure + unit tests (RED phase)** - `cbda3b8` (test)
2. **Task 1: Install SRT/diff deps and create srtAlignment.ts (GREEN phase)** - `184815d` (feat)
3. **Task 2: applySrtPhrase store action + useSrtImport hook** - `863203b` (feat)

## Files Created/Modified

- `packages/frontend/vitest.config.ts` - Vitest config: node environment, src/**/*.test.ts include
- `packages/frontend/src/lib/srtAlignment.ts` - SRT parsing and alignment pure functions (parseSrt, alignSrtToWhisper, SrtCue, AlignedPhrase)
- `packages/frontend/src/lib/srtAlignment.test.ts` - 20 unit tests covering all alignment edge cases
- `packages/frontend/src/hooks/useSrtImport.ts` - SRT import state machine hook (SrtImportState, useSrtImport)
- `packages/frontend/src/store/subtitleStore.ts` - Added applySrtPhrase to interface and implementation
- `packages/frontend/package.json` - Added vitest/test scripts and srt-parser-2/diff/types deps

## Decisions Made

- **vitest discovery**: Tests run via `npm run test` from workspace root; vitest binary hoisted to root node_modules — discovered that `npx vitest run --config path/to/config` fails with rolldown UNRESOLVED_ENTRY when CWD differs from config location; added `test` script to package.json as workaround
- **IEEE 754 minimum duration**: `distributeTimings` computes `end = start + perWord` (not `phraseStart + (i+1)*perWord`) so `end - start` equals `perWord` exactly; test uses `toBeGreaterThanOrEqual(0.01 - 1e-10)` to handle floating point accumulation
- **srt-parser-2 API**: Library exports default `Parser` class with `fromSrt(data)` returning entries with `startSeconds`/`endSeconds` fields (not `startSec`/`endSec`) — plan assumed custom field names; mapped correctly in parseSrt

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed IEEE 754 floating point in distributeTimings end calculation**
- **Found during:** Task 1 (srtAlignment.ts implementation)
- **Issue:** Computing `end = phraseStart + (i+1)*perWord` independently from `start = phraseStart + i*perWord` causes `end - start` to differ from `perWord` due to floating point accumulation (e.g., `0.03 - 0.02 = 0.009999...` in IEEE 754)
- **Fix:** Changed to `end = start + perWord` so subtraction equals `perWord` exactly; test uses epsilon tolerance `toBeGreaterThanOrEqual(0.01 - 1e-10)` for edge cases
- **Files modified:** srtAlignment.ts, srtAlignment.test.ts
- **Verification:** All 20 tests pass with no floating point failures
- **Committed in:** 184815d (Task 1 feat commit)

**2. [Rule 3 - Blocking] Added npm test script to frontend package.json**
- **Found during:** Task 0 (vitest setup)
- **Issue:** `npx vitest run --config packages/frontend/vitest.config.ts` fails with rolldown UNRESOLVED_ENTRY when CWD is project root; vitest config path resolution broken cross-directory
- **Fix:** Added `"test": "vitest run"` script to frontend package.json; run via `npm run test --workspace packages/frontend`
- **Files modified:** packages/frontend/package.json
- **Verification:** Tests run and discover src/**/*.test.ts files correctly
- **Committed in:** cbda3b8 (Task 0 test commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness and executability. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in KeyframePreview.tsx, AnimationPreview.tsx, and subtitleStore.ts DEFAULT_STYLE (`laneGap` missing from StyleProps) — out of scope, logged to deferred-items.md

## Known Stubs

None — all pure functions are fully implemented and tested. No placeholder data flows to UI.

## Next Phase Readiness

- Plan 10-02 (SRT diff UI) can import: `useSrtImport` from `hooks/useSrtImport.ts`, `AlignedPhrase` type from `lib/srtAlignment.ts`
- `state.alignedPhrases` provides the diff list; `acceptPhrase(index)` / `rejectPhrase(index)` are the accept/reject callbacks
- `diff` package is installed and available for word-level diff rendering in the UI

---
*Phase: 10-srt-import-and-text-correction*
*Completed: 2026-03-28*
