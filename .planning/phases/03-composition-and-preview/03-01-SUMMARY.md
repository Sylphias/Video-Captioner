---
phase: 03-composition-and-preview
plan: 01
subsystem: ui
tags: [remotion, react, typescript, karaoke, subtitles, video, zustand]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: TypeScript workspace setup, project references, shared-types package
  - phase: 02-transcription
    provides: TranscriptWord type from shared-types used by SubtitleOverlay words prop

provides:
  - Pure props-driven SubtitleComposition Remotion component (OffthreadVideo + SubtitleOverlay layers)
  - SubtitleOverlay with binary search word activation and 1.5s phrase grouping
  - StyleProps and SubtitleCompositionProps TypeScript interfaces
  - @eigen/remotion-composition workspace package ready for browser Player (Phase 3) and server renderMedia (Phase 5)

affects:
  - 03-composition-and-preview (subsequent plans use SubtitleComposition in Remotion Player)
  - 05-render (server-side renderMedia uses SubtitleComposition)

# Tech tracking
tech-stack:
  added:
    - remotion@4.0.379 (exact pin, no ^)
    - "@remotion/player@4.0.379 in frontend"
    - zustand@5.x in frontend (state management for Phase 3+)
  patterns:
    - Pure composition pattern: no hooks/state/side-effects in SubtitleComposition (works in browser and renderMedia)
    - Binary search word activation: O(log n) lookup per frame, karaoke UX (last-started word stays highlighted during gaps)
    - Gap-based phrase grouping: 1.5s threshold splits transcript into display phrases
    - Remotion hooks (useCurrentFrame, useVideoConfig) used instead of React hooks directly
    - allowImportingTsExtensions + noEmit in tsconfigs for Vite/Node runtimes that handle TS directly

key-files:
  created:
    - packages/remotion-composition/src/types.ts
    - packages/remotion-composition/src/SubtitleComposition.tsx
    - packages/remotion-composition/src/SubtitleOverlay.tsx
  modified:
    - packages/remotion-composition/src/index.ts (replaced stub with real exports)
    - packages/remotion-composition/tsconfig.json (added module ESNext, moduleResolution bundler, jsx react-jsx)
    - packages/frontend/tsconfig.json (added remotion-composition project reference, allowImportingTsExtensions, noEmit)
    - packages/backend/tsconfig.json (added allowImportingTsExtensions, noEmit)
    - packages/frontend/package.json (added @remotion/player, remotion, zustand, @eigen/remotion-composition)
    - packages/remotion-composition/package.json (added remotion@4.0.379 exact)
    - packages/frontend/src/hooks/useUpload.ts (type cast fix for status field)

key-decisions:
  - "remotion@4.0.379 pinned with exact (no ^) in both remotion-composition and frontend — all remotion packages must match exactly"
  - "No react in remotion-composition/package.json dependencies — peer dep only, avoids duplicate React in monorepo"
  - "allowImportingTsExtensions + noEmit added to frontend and backend tsconfigs — both runtimes (Vite, Node --experimental-strip-types) handle TS directly, tsc used only for type checking"
  - "Binary search word activation holds highlight during intra-phrase gaps (no -1 return during gaps) — prevents karaoke flicker"
  - "PHRASE_GAP_SEC = 1.5s for both phrase splitting and active phrase display window extension"

patterns-established:
  - "Composition purity: SubtitleComposition has zero hooks/state/side-effects — structurally pure for dual browser/server use"
  - "Remotion hooks over React hooks: useCurrentFrame/useVideoConfig from 'remotion', not 'react', in composition components"
  - "Workspace package imports: @eigen/remotion-composition resolved via npm workspaces flat node_modules symlink"

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 3 Plan 01: Remotion Composition Package Summary

**Pure props-driven `@eigen/remotion-composition` package with karaoke SubtitleOverlay using binary search word activation and 1.5s phrase grouping, ready for browser Player and server renderMedia**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T07:34:13Z
- **Completed:** 2026-03-02T07:37:34Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- `SubtitleComposition` — pure stateless component rendering OffthreadVideo + SubtitleOverlay layers inside AbsoluteFill, zero side effects
- `SubtitleOverlay` — karaoke overlay with binary search word activation (O(log n) per frame), 1.5s gap-based phrase grouping, text shadow for legibility
- `@eigen/remotion-composition` workspace package wired into frontend with remotion@4.0.379 exact pins and Zustand state management dep
- Full workspace TypeScript build clean after fixing pre-existing tsconfig and type errors

## Task Commits

1. **Task 1: Install Remotion dependencies and configure packages** - `88ef8cc` (chore)
2. **Task 2: Create SubtitleComposition, SubtitleOverlay, and types** - `b5573b4` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/remotion-composition/src/types.ts` - StyleProps and SubtitleCompositionProps interfaces
- `packages/remotion-composition/src/SubtitleComposition.tsx` - Pure OffthreadVideo + SubtitleOverlay composition
- `packages/remotion-composition/src/SubtitleOverlay.tsx` - Karaoke overlay with binary search and phrase grouping
- `packages/remotion-composition/src/index.ts` - Re-exports all public API: SubtitleComposition, SubtitleOverlay, StyleProps, SubtitleCompositionProps, COMPOSITION_ID
- `packages/remotion-composition/tsconfig.json` - Added module ESNext, moduleResolution bundler, jsx react-jsx
- `packages/remotion-composition/package.json` - Added remotion@4.0.379 exact dep
- `packages/frontend/tsconfig.json` - Added remotion-composition reference, allowImportingTsExtensions, noEmit
- `packages/frontend/package.json` - Added @remotion/player@4.0.379, remotion@4.0.379, zustand, @eigen/remotion-composition workspace dep
- `packages/backend/tsconfig.json` - Added allowImportingTsExtensions, noEmit (pre-existing TS5097 errors fixed)
- `packages/frontend/src/hooks/useUpload.ts` - Type cast for job.status to UploadState['status'] (pre-existing type mismatch fixed)

## Decisions Made

- remotion@4.0.379 exact pin (no `^`) across all packages — Remotion's strict same-version requirement
- No `react` in remotion-composition dependencies — peer dep only to avoid duplicate React in workspace
- `allowImportingTsExtensions: true` + `noEmit: true` in frontend and backend tsconfigs — both use runtime-native TS (Vite, Node `--experimental-strip-types`), not tsc output
- Binary search holds highlight during gaps (never returns -1 during intra-phrase gaps) — prevents karaoke flicker UX

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TS5097 extension import errors in frontend and backend tsconfigs**
- **Found during:** Task 2 (full workspace `tsc --build` verification)
- **Issue:** frontend and backend used `.ts`/`.tsx` extensions in imports (valid for their runtimes — Vite and Node `--experimental-strip-types`) but `tsc --build` rejected them without `allowImportingTsExtensions: true`
- **Fix:** Added `allowImportingTsExtensions: true` + `noEmit: true` to both packages/frontend/tsconfig.json and packages/backend/tsconfig.json
- **Files modified:** packages/frontend/tsconfig.json, packages/backend/tsconfig.json
- **Verification:** `npx tsc --build tsconfig.build.json` exits 0 with no errors
- **Committed in:** b5573b4 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed pre-existing type mismatch in useUpload.ts**
- **Found during:** Task 2 (full workspace `tsc --build` verification)
- **Issue:** `job.status` is `JobStatus` (includes `'transcribing'` and `'transcribed'`) but `UploadState.status` is narrower — setState callback return type mismatch
- **Fix:** Added `as UploadState['status']` cast on line 83 — safe because SSE during upload phase only emits upload-lifecycle statuses
- **Files modified:** packages/frontend/src/hooks/useUpload.ts
- **Verification:** `npx tsc --build packages/frontend/tsconfig.json` exits 0
- **Committed in:** b5573b4 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - pre-existing bugs)
**Impact on plan:** Both fixes required for plan's success criterion ("TypeScript compiles cleanly across all workspace packages"). No scope creep.

## Issues Encountered

None beyond the pre-existing type errors auto-fixed above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `@eigen/remotion-composition` package fully built and type-checked — ready for Phase 3 Plan 02 (Remotion Player integration in browser)
- `@remotion/player` already installed in frontend — player wiring can begin immediately
- Zustand installed in frontend — ready for player state management
- Remaining Phase 3 concern from STATE.md: verify React 19 / Remotion 4.x compatibility (React 18.3.x is pinned in frontend — should be compatible)

---
*Phase: 03-composition-and-preview*
*Completed: 2026-03-02*

## Self-Check: PASSED

All created files verified present on disk. Both commits (88ef8cc, b5573b4) verified in git log.
