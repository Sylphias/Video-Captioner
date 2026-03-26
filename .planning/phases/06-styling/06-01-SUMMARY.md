---
phase: 06-styling
plan: 01
subsystem: ui
tags: [remotion, google-fonts, zustand, typescript, react, stroke, per-speaker-styles]

# Dependency graph
requires:
  - phase: 05-server-render-and-output
    provides: render pipeline with phrases/style passed from frontend to backend to Remotion
  - phase: 04.1-multi-speaker-diarization-and-speaker-lanes
    provides: dominantSpeaker on SessionPhrase, speakerNames in store

provides:
  - StyleProps extended with strokeColor, strokeWidth, verticalPosition (7 fields total)
  - SpeakerStyleOverride and AnimationType types in remotion-composition
  - dominantSpeaker optional field on TranscriptPhrase in shared-types
  - fonts.ts with 8 curated Google Fonts loaded at module level via @remotion/google-fonts
  - SubtitleOverlay renders stroke outline and configurable vertical position
  - SubtitleOverlay merges per-speaker style overrides at render time
  - Zustand store with speakerStyles record, setSpeakerStyle, clearSpeakerStyle actions
  - PreviewPanel memoized inputProps with speakerStyles and dominantSpeaker
  - Render pipeline propagates speakerStyles and dominantSpeaker to backend and worker

affects: [06-02-PLAN, styling-controls-ui, per-speaker-overrides]

# Tech tracking
tech-stack:
  added:
    - "@remotion/google-fonts@4.0.379 — module-level font loading for 8 curated fonts"
    - "react-colorful — color picker component (installed, used in plan 06-02)"
  patterns:
    - "Module-level loadFont() calls in fonts.ts — side effects fire on import, Remotion handles delayRender/continueRender internally"
    - "Per-speaker style merge: effectiveStyle = { ...globalStyle, ...speakerOverride } at SubtitleOverlay render time"
    - "useMemo for inputProps in Player components — prevents unnecessary Player re-renders on unrelated state changes"
    - "speakerStyles propagated as Record<string, SpeakerStyleOverride> through full stack: store → preview → render POST → backend → worker"

key-files:
  created:
    - "packages/remotion-composition/src/fonts.ts — 8 Google Fonts loaded at module level, exports FONTS, FontName, FONT_NAMES, getFontFamily"
  modified:
    - "packages/shared-types/src/index.ts — added dominantSpeaker?: string to TranscriptPhrase"
    - "packages/remotion-composition/src/types.ts — extended StyleProps (+3 fields), added AnimationType, SpeakerStyleOverride, updated SubtitleCompositionProps"
    - "packages/remotion-composition/src/index.ts — exports SpeakerStyleOverride, AnimationType, FontName, FONT_NAMES, getFontFamily; imports fonts for side effects"
    - "packages/remotion-composition/src/SubtitleOverlay.tsx — stroke, top+translateY vertical position, per-speaker merge"
    - "packages/remotion-composition/src/SubtitleComposition.tsx — imports fonts.ts, passes speakerStyles to SubtitleOverlay"
    - "packages/remotion-composition/src/Root.tsx — DEFAULT_PROPS updated with all 7 style fields + speakerStyles: {}"
    - "packages/frontend/src/store/subtitleStore.ts — speakerStyles state, setSpeakerStyle, clearSpeakerStyle, extended DEFAULT_STYLE"
    - "packages/frontend/src/components/PreviewPanel.tsx — useMemo for inputProps, speakerStyles selector, dominantSpeaker in phrases"
    - "packages/frontend/src/hooks/useRender.ts — reads speakerStyles from store, includes dominantSpeaker in phrases, sends speakerStyles in POST"
    - "packages/backend/src/routes/render.ts — imports SpeakerStyleOverride, extends RenderBody, passes speakerStyles to inputProps"

key-decisions:
  - "@remotion/google-fonts/FontName subpath imports used (e.g. @remotion/google-fonts/Inter) — matches ./* export pattern in package.json"
  - "loadFont() called at module level in fonts.ts — Remotion handles delayRender/continueRender; no async handling needed in component code"
  - "SpeakerStyleOverride = Partial<StyleProps> & { animationType?: AnimationType } — allows any subset of style overrides per speaker"
  - "fonts.ts imported in both SubtitleComposition.tsx (for browser Player) and index.ts barrel (for any other importer) — guarantees side effects fire"
  - "Root.tsx DEFAULT_PROPS updated during Task 1 (not Task 2) to fix blocking compile error — deviation Rule 3 applied"

patterns-established:
  - "Pattern: Full-stack style propagation — store → Preview inputProps → render POST body → backend → Remotion worker, all with identical type shape"
  - "Pattern: Speaker override merge is non-destructive — global style provides defaults, speaker overrides only replace specified fields"

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 6 Plan 01: Styling Data Layer Summary

**Extended StyleProps with stroke/position fields, wired per-speaker style overrides through full Remotion/Zustand/backend stack, and loaded 8 Google Fonts at module level**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-06T12:15:57Z
- **Completed:** 2026-03-06T12:21:12Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- StyleProps now has 7 fields: added strokeColor, strokeWidth, verticalPosition — SubtitleOverlay renders stroke outline via WebkitTextStroke and positions text via top + translateY(-50%)
- Per-speaker style override system implemented end-to-end: SpeakerStyleOverride type, Zustand speakerStyles record with setSpeakerStyle/clearSpeakerStyle actions, merged at SubtitleOverlay render time using activePhrase.dominantSpeaker
- 8 curated Google Fonts (Inter, Roboto, Montserrat, Oswald, Lato, Poppins, NotoSans, PlayfairDisplay) loaded at module level in fonts.ts via @remotion/google-fonts subpath imports
- Render pipeline fully updated: PreviewPanel memoized inputProps, useRender sends speakerStyles + dominantSpeaker in POST body, backend passes through to worker

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, extend types, and create fonts module** - `33446dd` (feat)
2. **Task 2: Update composition rendering with stroke, position, and per-speaker merge** - `4140fe4` (feat)
3. **Task 3: Extend store, memoize preview, and fix render pipeline** - `b3d28fb` (feat)

## Files Created/Modified

- `packages/remotion-composition/src/fonts.ts` - 8 Google Fonts loaded at module level, exports FONTS, FontName, FONT_NAMES, getFontFamily
- `packages/shared-types/src/index.ts` - Added dominantSpeaker?: string to TranscriptPhrase
- `packages/remotion-composition/src/types.ts` - Extended StyleProps, added AnimationType and SpeakerStyleOverride, updated SubtitleCompositionProps
- `packages/remotion-composition/src/index.ts` - Barrel exports for new types and font utilities, imports fonts.ts for side effects
- `packages/remotion-composition/src/SubtitleOverlay.tsx` - Stroke rendering, vertical position via top+translateY, per-speaker style merge
- `packages/remotion-composition/src/SubtitleComposition.tsx` - Imports fonts.ts, passes speakerStyles to SubtitleOverlay
- `packages/remotion-composition/src/Root.tsx` - DEFAULT_PROPS with all 7 style fields and empty speakerStyles
- `packages/frontend/src/store/subtitleStore.ts` - speakerStyles state, setSpeakerStyle/clearSpeakerStyle actions, extended DEFAULT_STYLE
- `packages/frontend/src/components/PreviewPanel.tsx` - useMemo for inputProps with speakerStyles and dominantSpeaker
- `packages/frontend/src/hooks/useRender.ts` - Sends speakerStyles and dominantSpeaker in render POST body
- `packages/backend/src/routes/render.ts` - Accepts and forwards speakerStyles through to Remotion worker inputProps

## Decisions Made

- Used `@remotion/google-fonts/FontName` subpath imports (e.g. `@remotion/google-fonts/Inter`) matching the `./*` export pattern in the package's package.json
- `loadFont()` called at module level — Remotion's implementation handles `delayRender`/`continueRender` internally so no async handling is needed in component code
- `SpeakerStyleOverride = Partial<StyleProps> & { animationType?: AnimationType }` — allows selective override of any style field per speaker without requiring all fields
- fonts.ts imported in both SubtitleComposition.tsx and the index.ts barrel to ensure side effects fire regardless of import path used

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated Root.tsx DEFAULT_PROPS during Task 1**
- **Found during:** Task 1 (TypeScript verification after types.ts changes)
- **Issue:** Root.tsx referenced the old StyleProps shape (4 fields) which caused compile errors blocking Task 1 verification
- **Fix:** Updated DEFAULT_PROPS with all 7 style fields and speakerStyles: {} — this was Task 2's planned work but moved up to unblock compilation
- **Files modified:** packages/remotion-composition/src/Root.tsx
- **Verification:** `npx tsc --noEmit` passed on remotion-composition before proceeding
- **Committed in:** 33446dd (Task 1 commit)

**2. [Rule 3 - Blocking] Built shared-types and remotion-composition dist before frontend/backend checks**
- **Found during:** Task 2 and Task 3 TypeScript verification
- **Issue:** Frontend and backend resolve types from dist folders; stale dist files caused false type errors about missing fields
- **Fix:** Ran `npx tsc --project tsconfig.json` in both shared-types and remotion-composition to regenerate dist before checking dependent packages
- **Files modified:** dist/ files (gitignored)
- **Verification:** Frontend and backend TypeScript checks passed after rebuild

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes required for TypeScript verification to pass. No scope creep — Root.tsx update was planned for Task 2 anyway.

## Issues Encountered

- shared-types and remotion-composition dist folders need rebuilding before dependent packages can type-check against new types — this is an inherent limitation of the workspace setup where tsc --noEmit on a consumer package reads from dist, not src

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full data and rendering foundation is in place for Plan 06-02 (Style Controls UI)
- Plan 06-02 can write directly to: `setStyle()` for global style, `setSpeakerStyle(speakerId, override)` for per-speaker overrides
- `FONT_NAMES` array is ready for use in font selector dropdown
- No blockers

---
*Phase: 06-styling*
*Completed: 2026-03-06*
