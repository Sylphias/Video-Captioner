---
phase: 07-text-animation-creator
plan: 01
subsystem: animation
tags: [remotion, typescript, animation, react, zustand]

# Dependency graph
requires:
  - phase: 06-styling
    provides: StyleProps, SpeakerStyleOverride, SubtitleOverlay rendering pipeline, Zustand store with undo middleware
provides:
  - AnimationPreset type hierarchy in shared-types (AnimationScope, EnterExitType, ActiveType, EasingType, AnimationPhaseConfig, ActivePhaseConfig, AnimationPreset)
  - CompositionPhrase type extending TranscriptPhrase with per-phrase animationPreset field
  - animations.ts pure computation engine with computeAnimationStyles and computeWordAnimationStyles
  - SubtitleOverlay integrated with animation system: per-phrase override support, phrase/word scope, all enter/active/exit types
  - Store fields activeAnimationPresetId and phraseAnimationPresetIds with undo-safe actions
affects:
  - 07-02-PLAN (preset CRUD backend — already complete, types now available)
  - 07-03-PLAN (animation picker UI — depends on store fields added here)
  - 07-04-PLAN (composition integration — animationPreset prop now on SubtitleCompositionProps)
  - 07-05-PLAN (server render — SubtitleCompositionProps.animationPreset flows to render pipeline)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure animation computation: animations.ts has no React hooks or side effects — pure frame-in, CSS-out functions"
    - "Serialization boundary pattern: frontend resolves preset IDs to full AnimationPreset objects before passing to Remotion Player (CompositionPhrase carries resolved preset)"
    - "Frame clamping: enter+exit each capped at 45% of phrase duration to prevent overlap on short phrases"
    - "Typewriter text slicing via --textSliceProgress CSS custom property marker (not real CSS, read and stripped in SubtitleOverlay)"

key-files:
  created:
    - packages/remotion-composition/src/animations.ts
  modified:
    - packages/shared-types/src/index.ts
    - packages/remotion-composition/src/types.ts
    - packages/remotion-composition/src/index.ts
    - packages/remotion-composition/src/SubtitleOverlay.tsx
    - packages/remotion-composition/src/SubtitleComposition.tsx
    - packages/frontend/src/store/subtitleStore.ts
    - packages/frontend/src/components/StyleDrawer/PhraseStylePanel.tsx
    - packages/frontend/src/components/StylePanel/SpeakerStylePanel.tsx

key-decisions:
  - "SpeakerStyleOverride is now Partial<StyleProps> only — animationType removed. Per-speaker animation is handled via AnimationPreset, not a legacy enum field"
  - "CompositionPhrase extends TranscriptPhrase with resolved animationPreset: AnimationPreset — frontend resolves IDs at serialization boundary, composition receives full objects"
  - "animations.ts uses --textSliceProgress as a special CSS property marker (cast as any) for typewriter/letter-by-letter — cleaner than mixing text logic into pure computation helpers"
  - "Word-scope stagger: exit phase has no stagger (all words exit together); only enter phase staggers per staggerFrames param"
  - "mergeStyles helper safely concatenates CSS transform strings to avoid one transform clobbering another"

patterns-established:
  - "Animation computation: import computeAnimationStyles / computeWordAnimationStyles from './animations', pass phraseStart/End, preset, frame, fps, width, height — returns CSSProperties to spread"
  - "Per-phrase override wiring: effectivePreset = phrase.animationPreset ?? animationPreset (prop)"
  - "Phrase-scope: spread animStyles onto container div; Word-scope: spread per-word styles onto each span"

# Metrics
duration: 6min
completed: 2026-03-10
---

# Phase 7 Plan 01: Animation Type System and Computation Engine Summary

**AnimationPreset type hierarchy in shared-types, CompositionPhrase serialization boundary type, and frame-accurate animations.ts engine rendering all 10+ enter/4 active/exit types in SubtitleOverlay with per-phrase preset override support**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-10T14:57:41Z
- **Completed:** 2026-03-10T15:03:54Z
- **Tasks:** 2
- **Files modified:** 9 (8 modified, 1 created)

## Accomplishments
- Full AnimationPreset type hierarchy exported from shared-types with 14 enter types, 4 active types, 11 easing options
- CompositionPhrase type with per-phrase animationPreset field at serialization boundary — frontend resolves IDs to full objects before handing to Remotion Player
- Pure animations.ts module: frame-accurate enter/active/exit computation with clamping, easing, spring physics
- SubtitleOverlay integrated: `phrase.animationPreset ?? animationPreset` per-phrase override, phrase-scope and word-scope paths, typewriter text slicing
- Old AnimationType enum fully removed project-wide from 6 source files

## Task Commits

1. **Task 1: Define AnimationPreset type system and clean up old AnimationType** - `a5fc3c7` (feat)
2. **Task 2: Build animation computation engine and integrate into SubtitleOverlay** - `8c34493` (feat)

## Files Created/Modified
- `packages/shared-types/src/index.ts` - Added AnimationPreset type hierarchy + animationPresetId on TranscriptPhrase
- `packages/remotion-composition/src/types.ts` - Removed AnimationType, added CompositionPhrase, updated SubtitleCompositionProps
- `packages/remotion-composition/src/index.ts` - Exports CompositionPhrase instead of AnimationType
- `packages/remotion-composition/src/animations.ts` - NEW: pure animation computation engine
- `packages/remotion-composition/src/SubtitleOverlay.tsx` - Integrated animation system with per-phrase override
- `packages/remotion-composition/src/SubtitleComposition.tsx` - Pass animationPreset prop to SubtitleOverlay
- `packages/frontend/src/store/subtitleStore.ts` - Removed AnimationType, added activeAnimationPresetId + phraseAnimationPresetIds fields + actions
- `packages/frontend/src/components/StyleDrawer/PhraseStylePanel.tsx` - Removed old animation dropdown
- `packages/frontend/src/components/StylePanel/SpeakerStylePanel.tsx` - Removed old animation dropdown

## Decisions Made
- SpeakerStyleOverride is now `Partial<StyleProps>` only — animation is handled by AnimationPreset at the system level, not per-speaker type enum
- CompositionPhrase carries a resolved `AnimationPreset` object (not an ID) because the Remotion composition runs at a serialization boundary where hooks/stores/APIs are inaccessible
- Typewriter/letter-by-letter enter types use `--textSliceProgress` as a special marker in the returned CSSProperties object; SubtitleOverlay reads and strips it for text slicing
- Word-scope exit has no stagger (all words exit simultaneously); only enter staggers via `staggerFrames` param
- `mergeStyles()` helper combines multiple CSSProperties objects by collecting transform strings and joining them

## Deviations from Plan

None — plan executed exactly as written. The only additional change was updating `SubtitleComposition.tsx` to pass the new `animationPreset` prop through to `SubtitleOverlay`, which was a natural consequence of the prop addition (not an unplanned deviation).

## Issues Encountered
None — zero TypeScript errors across full workspace build. All verification criteria passed.

## Next Phase Readiness
- Animation type system is the foundation everything else builds on
- Plan 02 (SQLite preset storage) was already committed (`eae1f9b`) — backend route file `presets.ts` exists as untracked and references the `fastify.db` decoration from that commit
- Plan 03 (animation picker UI) can now use `activeAnimationPresetId`, `phraseAnimationPresetIds`, `setActiveAnimationPresetId`, `setPhraseAnimationPresetId` from the store
- Plan 04 (composition integration) can now pass `animationPreset` on `SubtitleCompositionProps`

---
*Phase: 07-text-animation-creator*
*Completed: 2026-03-10*
