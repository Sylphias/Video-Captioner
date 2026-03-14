---
phase: 08-keyframe-position-animation
plan: 03
subsystem: ui, animation
tags: [remotion, zustand, react, typescript, keyframe, drag-interaction, motion-path]

# Dependency graph
requires:
  - phase: 08-keyframe-position-animation/08-01
    provides: KeyframeTrack, KeyframeableProperty, KeyframeEasing, MotionKeyframe types in shared-types
  - phase: 07-text-animation-creator
    provides: AnimationPreset interface, SubtitleOverlay, useAnimationPresets hook, @remotion/player Player
provides:
  - useBuilderStore Zustand store with full Animation Builder local state management
  - KeyframePreview component: Remotion Player preview with drag-to-position keyframe creation, aspect ratio switching, sample text, motion path toggle
  - MotionPathOverlay SVG component: dotted path + diamond markers connecting keyframe positions
  - AnimationBuilderPage root layout: preset selector, Save/Save As/New CRUD, preview + timeline placeholder
affects:
  - 08-04-keyframe-timeline
  - 08-05-verification

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RAF-based playhead polling: requestAnimationFrame loop reads Player.getCurrentFrame(), normalizes to phraseProgress (0-1) for keyframe sync
    - Drag-to-position: pointerdown + setPointerCapture on overlay div, pointermove computes % position from getBoundingClientRect, calls addKeyframe('x'/'y', progress, pct)
    - Inner composition pattern: BuilderPreviewComposition defined outside KeyframePreview to avoid recreation; cast as ComponentType<Record<string,unknown>> for Remotion Player generic
    - Sorted keyframe insertion: addKeyframe uses findIndex to insert at correct position, maintains easings.length = keyframes.length - 1
    - SVG motion path: viewBox matches composition dimensions, % keyframe values mapped via (value/100) * dimension for coordinate conversion

key-files:
  created:
    - packages/frontend/src/components/AnimationBuilder/useBuilderStore.ts
    - packages/frontend/src/components/AnimationBuilder/KeyframePreview.tsx
    - packages/frontend/src/components/AnimationBuilder/KeyframePreview.css
    - packages/frontend/src/components/AnimationBuilder/MotionPathOverlay.tsx
    - packages/frontend/src/components/AnimationBuilder/AnimationBuilderPage.tsx
    - packages/frontend/src/components/AnimationBuilder/AnimationBuilderPage.css
  modified: []

key-decisions:
  - "RAF polling reads getCurrentFrame() from PlayerRef — Remotion Player does not expose a frame-change event, so polling is the correct approach"
  - "Drag overlay uses setPointerCapture on pointerdown — ensures pointermove/pointerup fire even when pointer leaves overlay bounds during fast drag"
  - "addKeyframe deduplicates by time (within 0.01 tolerance) — drag-while-paused always updates the same keyframe rather than creating duplicates"
  - "MotionPathOverlay takes explicit compositionWidth/Height props — avoids coupling to store, makes it reusable and testable"
  - "AnimationBuilderPage initializes store from first preset on mount via hasInitialized guard — prevents re-loading on parent re-renders"

patterns-established:
  - "Builder store pattern: local Zustand store per page-level feature (useBuilderStore); separate from global subtitleStore to avoid coupling"
  - "Overlay stacking order: Player (base) → MotionPathOverlay (z-index 5, pointer-events none) → drag overlay (z-index 10, pointer-events auto)"

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 8 Plan 03: Keyframe Preview Canvas and Animation Builder Page Summary

**Remotion Player preview with drag-to-position keyframe creation, aspect ratio switching, motion path SVG overlay, and AnimationBuilderPage root layout with preset CRUD management.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T01:50:43Z
- **Completed:** 2026-03-14T01:54:23Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Built `useBuilderStore` Zustand store managing all Animation Builder state: preset, keyframeTracks (with sorted insertion and easing invariant maintenance), aspectRatio, sampleText, showMotionPath, playheadProgress, selection
- Built `KeyframePreview` with Remotion Player (3 switchable aspect ratios), drag-to-position interaction via pointer capture overlay, RAF-based playhead sync to phraseProgress (0-1), sample text input, motion path toggle
- Built `MotionPathOverlay` SVG component that draws dotted path + diamond markers connecting position keyframe coordinates, pointer-events none so drag interaction passes through
- Built `AnimationBuilderPage` root layout with useAnimationPresets hook integration, preset selector, Save/Save As/New CRUD buttons, KeyframePreview as main content, 200px timeline placeholder

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useBuilderStore and KeyframePreview with drag-to-position** - `a3ab786` (feat)
2. **Task 2: Create AnimationBuilderPage root layout** - `8da5240` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `packages/frontend/src/components/AnimationBuilder/useBuilderStore.ts` - Zustand store with full builder state and keyframe mutation operations
- `packages/frontend/src/components/AnimationBuilder/KeyframePreview.tsx` - Remotion Player with drag overlay, RAF playhead sync, aspect ratio controls, sample text input
- `packages/frontend/src/components/AnimationBuilder/KeyframePreview.css` - Preview canvas layout, aspect ratio button group, drag overlay positioning, progress bar
- `packages/frontend/src/components/AnimationBuilder/MotionPathOverlay.tsx` - SVG dotted path + diamond markers from x/y keyframe tracks
- `packages/frontend/src/components/AnimationBuilder/AnimationBuilderPage.tsx` - Page root with preset selector, Save/Save As/New actions, KeyframePreview, timeline placeholder
- `packages/frontend/src/components/AnimationBuilder/AnimationBuilderPage.css` - Flex column layout with preview filling space and 200px fixed timeline area

## Decisions Made
- RAF polling reads `getCurrentFrame()` from `PlayerRef` — Remotion Player has no frame-change callback event
- `setPointerCapture` on drag overlay `pointerdown` — ensures pointermove fires even when pointer leaves overlay during fast gesture
- `addKeyframe` deduplicates at same time (within 0.01s tolerance) — prevents creating duplicate keyframes during drag-while-paused
- `MotionPathOverlay` accepts compositionWidth/Height as props (not from store) — decoupled, reusable
- `AnimationBuilderPage` uses `hasInitialized` guard to initialize store from first preset once on mount

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type error in MotionPathOverlay.tsx**
- **Found during:** Task 1 verification (TypeScript check)
- **Issue:** `lookupValue(track: typeof xTrack, ...)` — TypeScript inferred `xTrack` as `KeyframeTrack | undefined` since `find()` can return undefined; `track.keyframes` then errored as property access on `undefined`
- **Fix:** Imported `KeyframeTrack` from `@eigen/shared-types` and typed the parameter explicitly as `KeyframeTrack`
- **Files modified:** `packages/frontend/src/components/AnimationBuilder/MotionPathOverlay.tsx`
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** `a3ab786` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug - TypeScript type annotation)
**Impact on plan:** Minimal — single-line fix to explicit type annotation, no behavior change.

## Issues Encountered
None beyond the TypeScript type error noted above.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- useBuilderStore, KeyframePreview, MotionPathOverlay, and AnimationBuilderPage are complete and TypeScript-verified
- AnimationBuilderPage can be wired into app routing to expose the builder as a real page
- Ready for Phase 8 Plan 04: Keyframe Timeline editor (the bottom panel placeholder will be replaced with actual keyframe track editing UI)
- The store's selectedProperty / selectedKeyframeIndex fields are ready for the timeline to use for selection state

## Self-Check: PASSED

Files verified:
- packages/frontend/src/components/AnimationBuilder/useBuilderStore.ts: FOUND
- packages/frontend/src/components/AnimationBuilder/KeyframePreview.tsx: FOUND
- packages/frontend/src/components/AnimationBuilder/KeyframePreview.css: FOUND
- packages/frontend/src/components/AnimationBuilder/MotionPathOverlay.tsx: FOUND
- packages/frontend/src/components/AnimationBuilder/AnimationBuilderPage.tsx: FOUND
- packages/frontend/src/components/AnimationBuilder/AnimationBuilderPage.css: FOUND

Commits verified:
- a3ab786: feat(08-03): useBuilderStore, KeyframePreview, MotionPathOverlay — FOUND
- 8da5240: feat(08-03): AnimationBuilderPage root layout with preset management — FOUND

TypeScript workspace build: PASSED (npx tsc --build tsconfig.build.json with zero errors)

---
*Phase: 08-keyframe-position-animation*
*Completed: 2026-03-14*
