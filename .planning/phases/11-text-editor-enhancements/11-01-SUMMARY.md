---
phase: 11-text-editor-enhancements
plan: "01"
subsystem: frontend-store
tags: [zustand, undo, bulk-operations, tdd, store]
dependency_graph:
  requires: []
  provides: [mergePhrases, deletePhrases, duplicatePhrase, movePhraseUp, movePhraseDown]
  affects: [packages/frontend/src/store/subtitleStore.ts]
tech_stack:
  added: []
  patterns: [direct-array-manipulation, single-snapshot-undo, tdd-red-green]
key_files:
  created:
    - packages/frontend/src/store/subtitleStore.test.ts
  modified:
    - packages/frontend/src/store/subtitleStore.ts
decisions:
  - Direct phrase array manipulation instead of buildSessionPhrases for bulk ops to avoid timing-based re-grouping
  - mergePhrases preserves non-contiguous phrase merging by flatMapping words and storing as-is
  - duplicatePhrase uses direct splice into phrases array with isManualSplit:true on clone
  - movePhraseUp/Down swaps phrases array entries directly, not flat word blocks
metrics:
  duration: 6min
  completed: 2026-03-28
---

# Phase 11 Plan 01: Bulk Store Actions Summary

**One-liner:** Five bulk subtitle store actions (merge/delete/duplicate/move phrases) with single-snapshot undo semantics and 14-case TDD test coverage.

## What Was Built

Added 5 new actions to `subtitleStore` in both the worktree and main project:

- **`mergePhrases(indices: number[])`** — Merge multiple phrases by index into one, placed at the lowest index. Handles non-contiguous selections. Single undo snapshot. No-op if <2 indices.
- **`deletePhrases(indices: number[])`** — Delete multiple phrases. Guards against deleting all phrases. Adjusts `manualSplitWordIndices`. Single undo snapshot.
- **`duplicatePhrase(phraseIndex: number)`** — Clones a phrase immediately after the source. Uses direct phrase array insertion (not `buildSessionPhrases`) to preserve phrase boundaries.
- **`movePhraseUp(phraseIndex: number)`** — Swaps with predecessor. No-op at index 0.
- **`movePhraseDown(phraseIndex: number)`** — Swaps with successor. No-op at last index.

## TDD Execution

**RED:** Created `subtitleStore.test.ts` with 14 test cases. All failed because actions didn't exist.

**GREEN:** Implemented all 5 actions. Initial `duplicatePhrase`, `movePhraseUp`, `movePhraseDown` used `buildSessionPhrases` which caused re-grouping based on timing — non-contiguous merged words were re-split, swapped words were re-grouped. Fixed by switching to direct phrase array manipulation.

**All 35 tests pass** (21 pre-existing srtAlignment tests + 14 new bulk action tests).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] buildSessionPhrases re-groups after bulk operations**
- **Found during:** Task 1 GREEN phase (tests failing after initial implementation)
- **Issue:** `duplicatePhrase`, `movePhraseUp`, `movePhraseDown` called `buildSessionPhrases` which re-groups words by timing gaps. Non-contiguous merged phrase words have timing gaps that triggered unwanted re-splits. Swapped phrase word blocks were re-merged by auto-grouper.
- **Fix:** Replaced `buildSessionPhrases` with direct phrase array manipulation for these three operations. The `phrases` array is treated as the authoritative structure; `words` is derived from it via `flatMap`. `manualSplitWordIndices` is rebuilt from `isManualSplit` flags on phrases.
- **Files modified:** `packages/frontend/src/store/subtitleStore.ts`
- **Commit:** 0714cd7

**2. [Rule 3 - Blocking] Plan file and phase directory missing in worktree**
- **Found during:** Initial read
- **Issue:** Worktree was checked out without phase 11 files (they exist on main branch but not in worktree's checkout)
- **Fix:** `git checkout main -- .planning/phases/11-text-editor-enhancements/11-01-PLAN.md ...` to restore from main branch
- **Files:** Plan and context files checked out from main

**3. [Rule 3 - Blocking] VideoMetadata type mismatch between main project and worktree**
- **Found during:** Task 1 test file creation
- **Issue:** Test used `durationMs` and `normalized` fields from worktree's shared-types, but main project's shared-types uses `duration` (seconds) and `codec` instead
- **Fix:** Updated test mock to use `{ duration: 10, fps: 30, width: 1920, height: 1080, codec: 'h264' }`

## Known Stubs

None — all actions are fully implemented and tested.

## Self-Check: PASSED

- FOUND: packages/frontend/src/store/subtitleStore.ts
- FOUND: packages/frontend/src/store/subtitleStore.test.ts
- FOUND: commit 0714cd7
