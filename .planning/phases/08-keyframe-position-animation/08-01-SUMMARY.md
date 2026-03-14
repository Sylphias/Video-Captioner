---
phase: 08-keyframe-position-animation
plan: 01
subsystem: api, ui, animation
tags: [remotion, typescript, bezier-easing, keyframe, animation, shared-types]

# Dependency graph
requires:
  - phase: 07-text-animation-creator
    provides: AnimationPreset interface, animations.ts computeAnimationStyles, backend presets API
provides:
  - KeyframeableProperty, CubicBezierEasing, KeyframeEasing, MotionKeyframe, KeyframeTrack types in shared-types
  - computeKeyframeStyles() function in animations.ts for multi-point keyframe interpolation with per-segment easing
  - bezier-easing library integration for custom cubic bezier easing
  - AnimationPreset.keyframeTracks optional field (backward compatible)
  - Backend POST/PUT /api/presets routes pass keyframeTracks through params JSON column
affects:
  - 08-02-keyframe-timeline-ui
  - 08-03-keyframe-preview-integration
  - any future phase using AnimationPreset

# Tech tracking
tech-stack:
  added:
    - bezier-easing@^2.1.0 (ships own .d.ts types)
  patterns:
    - phraseProgress (0-1) used as normalized time axis for keyframe interpolation independent of fps
    - mergeStyles() used to safely concatenate transform strings from phase animations and keyframe overlays
    - Backward compatibility via keyframeTracks undefined check before computing any keyframe styles

key-files:
  created: []
  modified:
    - packages/shared-types/src/index.ts
    - packages/remotion-composition/src/animations.ts
    - packages/remotion-composition/src/index.ts
    - packages/remotion-composition/package.json
    - packages/backend/src/routes/presets.ts

key-decisions:
  - "bezier-easing ships its own TypeScript types (src/index.d.ts) — no @types/bezier-easing needed"
  - "x/y keyframe values are % units mapped to pixel offsets: (value/100)*width - width/2 for x, same with height for y"
  - "keyframeTracks field added at AnimationPreset level (not AnimationPhaseConfig) — applies across full phrase lifetime, independent of enter/active/exit phases"
  - "phraseProgress computed as frameIntoPhrase / totalPhraseFrames — single normalized time axis for all keyframe interpolation"
  - "keyframeStyles merged after phase styles using mergeStyles — keyframe transforms stack on top of enter/exit/active transforms"
  - "PUT /api/presets/:id preserves existing keyframeTracks when body.keyframeTracks is undefined (partial update semantics)"

patterns-established:
  - "Keyframe engine pattern: findKeyframeSegment -> applyKeyframeEasing -> interpolateTrack -> computeKeyframeStyles"
  - "Segment-based interpolation: easings array length = keyframes.length - 1, one easing per segment between keyframe pairs"

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 8 Plan 01: Keyframe Data Model and Interpolation Engine Summary

**Type-safe keyframe animation system with multi-segment cubic bezier interpolation, integrated into Remotion's enter/active/exit pipeline via phraseProgress normalization and mergeStyles composition.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T01:43:56Z
- **Completed:** 2026-03-14T01:47:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Defined complete keyframe type hierarchy: KeyframeableProperty, CubicBezierEasing, KeyframeEasing (9 built-in + custom bezier), MotionKeyframe, KeyframeTrack — all exported from shared-types
- Built interpolation engine: segment finding, easing application (including BezierEasing for custom cubic bezier), linear interpolation between keyframe pairs
- Integrated computeKeyframeStyles into both computeAnimationStyles and computeWordAnimationStyles — keyframe overlay stacks on top of phase animations via mergeStyles
- Updated backend POST/PUT /api/presets routes to pass keyframeTracks through params JSON column without schema changes
- Existing presets without keyframeTracks work identically (computeKeyframeStyles returns {} for undefined)

## Task Commits

Each task was committed atomically:

1. **Task 1: Define keyframe types in shared-types and install bezier-easing** - `d2708f6` (feat)
2. **Task 2: Build keyframe interpolation engine and integrate into animation pipeline** - `c7ac7d2` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `packages/shared-types/src/index.ts` - Added 5 keyframe types + optional keyframeTracks field on AnimationPreset
- `packages/remotion-composition/src/animations.ts` - Added interpolation engine (findKeyframeSegment, applyKeyframeEasing, interpolateTrack, computeKeyframeStyles) and integrated into both compute functions
- `packages/remotion-composition/src/index.ts` - Exported computeKeyframeStyles, computeAnimationStyles, computeWordAnimationStyles, mergeStyles from barrel
- `packages/remotion-composition/package.json` - Added bezier-easing@^2.1.0 dependency
- `packages/backend/src/routes/presets.ts` - Added keyframeTracks to CreatePresetBody/UpdatePresetBody, POST/PUT routes preserve keyframeTracks in params JSON

## Decisions Made
- bezier-easing ships its own TypeScript types — no @types/bezier-easing needed
- x/y keyframe values use % units mapped to pixel offsets: (value/100)*dimension - dimension/2 centers the coordinate system
- keyframeTracks applies at AnimationPreset level across full phrase lifetime, orthogonal to enter/active/exit phase config
- phraseProgress (0.0-1.0) is the single normalized time axis for keyframe interpolation, computed as frameIntoPhrase / totalPhraseFrames

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Keyframe data model and interpolation engine are complete and type-safe
- Any component can import computeKeyframeStyles and get CSS properties for a given phraseProgress and keyframe tracks
- Backend API passes keyframeTracks through without breaking existing presets
- Ready for Phase 8 Plan 02: Keyframe Timeline UI (adding keyframe editor controls)

## Self-Check: PASSED

Files verified:
- packages/shared-types/src/index.ts: FOUND (KeyframeTrack interface present)
- packages/remotion-composition/src/animations.ts: FOUND (computeKeyframeStyles export present)
- packages/remotion-composition/package.json: FOUND (bezier-easing dependency present)
- packages/backend/src/routes/presets.ts: FOUND (keyframeTracks handling present)

Commits verified:
- d2708f6: feat(08-01): define keyframe animation types — FOUND
- c7ac7d2: feat(08-01): build keyframe interpolation engine — FOUND

TypeScript workspace build: PASSED (npx tsc --build tsconfig.build.json with zero errors)

---
*Phase: 08-keyframe-position-animation*
*Completed: 2026-03-14*
