# Deferred Items — Phase 10 SRT Import

## Pre-existing TypeScript Errors (out of scope for 10-01)

These errors existed before plan 10-01 and are not caused by changes in this plan:

1. `packages/frontend/src/components/AnimationBuilder/KeyframePreview.tsx(30,7)`: `Property 'laneGap' is missing in type {...} but required in type 'StyleProps'`
2. `packages/frontend/src/components/AnimationEditor/AnimationPreview.tsx(14,7)`: Same `laneGap` missing error
3. `packages/frontend/src/store/subtitleStore.ts(73,7)`: `DEFAULT_STYLE` missing `laneGap` field in `StyleProps`

These appear to be from a `StyleProps` type update that added `laneGap` but didn't update all usage sites. Should be fixed in a separate plan.
