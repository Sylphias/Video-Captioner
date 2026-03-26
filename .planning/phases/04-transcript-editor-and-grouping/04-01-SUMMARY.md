---
phase: 04-transcript-editor-and-grouping
plan: 01
subsystem: ui
tags: [zustand, remotion, grouping, typescript, karaoke, state-management]

# Dependency graph
requires:
  - phase: 03-composition-and-preview/plan-02
    provides: subtitleStore with transcript/videoMetadata, PreviewPanel, SubtitleComposition, SubtitleOverlay with groupIntoPhrases

provides:
  - groupIntoPhrases() and buildSessionPhrases() in packages/frontend/src/lib/grouping.ts
  - Two-layer Zustand store (original + session) with updateWord, splitPhrase, mergePhrase, resetSession
  - TranscriptPhrase type in shared-types consumed by composition and store
  - SubtitleOverlay and SubtitleComposition now accept phrases[] instead of words[]
  - PlayerRef and seekToTime callback in PreviewPanel via onSeekReady prop

affects:
  - 04-02-transcript-editor (editor UI reads session.phrases, calls updateWord/splitPhrase/mergePhrase)
  - 05-render (server render uses SubtitleComposition with new phrases[] prop)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-layer store: original (immutable Whisper output) vs session (mutable user edits) — canonical editor pattern"
    - "buildSessionPhrases merges auto-grouping with manual split indices for consistent phrase reconstruction"
    - "Text-only updateWord updates word in-place within existing phrases (no rebuild) to preserve manual splits"
    - "SessionWord/SessionPhrase types defined in grouping.ts to avoid circular dependency with subtitleStore"

key-files:
  created:
    - packages/frontend/src/lib/grouping.ts
  modified:
    - packages/shared-types/src/index.ts
    - packages/remotion-composition/src/types.ts
    - packages/remotion-composition/src/SubtitleOverlay.tsx
    - packages/remotion-composition/src/SubtitleComposition.tsx
    - packages/remotion-composition/src/index.ts
    - packages/frontend/src/store/subtitleStore.ts
    - packages/frontend/src/components/PreviewPanel.tsx

key-decisions:
  - "SessionWord/SessionPhrase defined in grouping.ts (not store) to avoid circular import — store imports from lib, not vice versa"
  - "manualSplitWordIndices stored as Set<number> of global word indices — survives phrase rebuilds triggered by timestamp edits"
  - "Text-only updateWord skips phrase rebuild — updates word text in-place within existing SessionPhrase[] to prevent clobbering manual splits"
  - "buildSessionPhrases honors both auto-splits (gap/punctuation/max) and manual splits — manual splits add to auto splits, never replace them"
  - "phrases[] in composition replaces words[] — composition is now a pure renderer of pre-computed phrases (Pitfall #4 resolved)"

patterns-established:
  - "grouping.ts is the single source of phrase-grouping truth — used by store; composition receives pre-computed results"
  - "PreviewPanel exposes seekToTime via onSeekReady callback prop — playerRef stays co-located with Player, no Zustand anti-pattern"

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 4 Plan 01: Data Layer Refactor Summary

**Two-layer Zustand store (original + session) with groupIntoPhrases extracted to shared lib, manual split tracking via Set<number>, and composition refactored to render pre-computed phrases[]**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T18:10:07Z
- **Completed:** 2026-03-03T18:13:00Z
- **Tasks:** 2
- **Files modified:** 7 modified + 1 created

## Accomplishments

- Extracted `groupIntoPhrases()` and `buildSessionPhrases()` from SubtitleOverlay to `packages/frontend/src/lib/grouping.ts` — single source of phrase grouping truth
- Added `TranscriptPhrase` to shared-types; composition (`SubtitleCompositionProps`, `SubtitleOverlay`, `SubtitleComposition`) now accepts `phrases[]` instead of `words[]`
- Rewrote Zustand store with `original` (immutable) + `session` (mutable) layers; `session.manualSplitWordIndices: Set<number>` tracks user-forced splits by global word index
- Store actions: `updateWord` (with timestamp validation + text-only fast path), `splitPhrase`, `mergePhrase`, `resetSession`, `reset`
- PreviewPanel rewired to read `session.phrases`, map to `TranscriptPhrase[]`, pass to composition; `PlayerRef` added with `seekToTime` callback exposed via `onSeekReady` prop

## Task Commits

1. **Task 1: Extract grouping algorithm to lib and add TranscriptPhrase type** - `ec0380b` (feat)
2. **Task 2: Rewrite Zustand store with two-layer state and rewire PreviewPanel** - `9b904a5` (feat)

## Files Created/Modified

- `packages/frontend/src/lib/grouping.ts` - Created: groupIntoPhrases(), buildSessionPhrases(), SessionWord, SessionPhrase types, PHRASE_GAP_SEC, MAX_WORDS_PER_PHRASE, endsWithPunctuation()
- `packages/shared-types/src/index.ts` - Added TranscriptPhrase interface
- `packages/remotion-composition/src/types.ts` - SubtitleCompositionProps now uses phrases: TranscriptPhrase[]
- `packages/remotion-composition/src/SubtitleOverlay.tsx` - Removed internal groupIntoPhrases; accepts phrases[] prop; findActiveWordIndex retained and exported
- `packages/remotion-composition/src/SubtitleComposition.tsx` - Passes phrases to SubtitleOverlay
- `packages/remotion-composition/src/index.ts` - Added findActiveWordIndex to exports
- `packages/frontend/src/store/subtitleStore.ts` - Full rewrite: two-layer store with all required actions
- `packages/frontend/src/components/PreviewPanel.tsx` - Reads session.phrases, adds PlayerRef and seekToTime

## Decisions Made

- `SessionWord` and `SessionPhrase` defined in `grouping.ts` to avoid circular dependency: store imports from lib, lib has no import from store
- `manualSplitWordIndices: Set<number>` stores global word indices rather than phrase-relative indices — survives phrase array rebuilds triggered by timestamp edits
- Text-only `updateWord` (word text change, no start/end) updates word in-place within existing `session.phrases` structure without rebuilding — prevents manual splits from being clobbered
- `buildSessionPhrases` combines both auto-splits (gap/punctuation/max words) and manual splits: auto splits are always honored, manual splits add additional boundaries on top
- Timestamp validation in `updateWord` silently rejects invalid values (start >= end, overlap with neighbors) — no error surfacing in this plan; UI validation in plan 02

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Store is complete: `original + session` architecture with all required actions for the transcript editor UI
- `groupIntoPhrases` and `buildSessionPhrases` in `lib/grouping.ts` ready for plan 02's TranscriptEditor component
- `PreviewPanel` exposes `seekToTime` via `onSeekReady` — plan 02's WordCell click-to-seek can wire directly
- `session.phrases` drives the composition; no dual sources of phrase truth
- TypeScript compiles cleanly across all workspace packages

---
*Phase: 04-transcript-editor-and-grouping*
*Completed: 2026-03-03*

## Self-Check: PASSED

All files verified: grouping.ts, shared-types, types.ts, SubtitleOverlay, subtitleStore, PreviewPanel, SUMMARY.md.
Commits ec0380b and 9b904a5 confirmed in git log.
Full workspace TypeScript compilation exits 0.
