---
phase: 08-keyframe-position-animation
plan: 02
subsystem: ui
tags: [react, svg, bezier, easing, animation, pointer-events]

# Dependency graph
requires:
  - phase: 08-keyframe-position-animation plan 01
    provides: KeyframeEasing and CubicBezierEasing types in shared-types

provides:
  - BezierEditor: SVG cubic bezier curve editor with draggable p1/p2 control handles and pointer capture
  - EasingPicker: dropdown with 9 preset easing curve thumbnails plus custom BezierEditor inline

affects:
  - 08-04-PLAN (KeyframeTimeline) — will use EasingPicker for per-segment easing selection on each keyframe pair

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SVG + pointer events for drag interaction: onPointerDown setPointerCapture, onPointerMove on SVG container"
    - "Custom dropdown with SVG thumbnails using buttons (not native select) for visual options"
    - "useEffect with mousedown document listener for click-outside-to-close, cleaned up on unmount"

key-files:
  created:
    - packages/frontend/src/components/AnimationBuilder/BezierEditor.tsx
    - packages/frontend/src/components/AnimationBuilder/BezierEditor.css
    - packages/frontend/src/components/AnimationBuilder/EasingPicker.tsx
    - packages/frontend/src/components/AnimationBuilder/EasingPicker.css
  modified: []

key-decisions:
  - "Use actual CSS token names (--color-bg-elevated, --color-accent-green) not the shorthand names in the plan spec (--surface-2, --accent) — these match the actual tokens.css file"
  - "SVG viewBox '-10 -30 120 160' allows control handles to be dragged beyond the curve bounding box for overshoot bezier values"
  - "EasingPicker button-per-option (not option elements) to support embedded SVG thumbnails inside the dropdown"
  - "BezierEditor pointer capture on individual handle circles (not the SVG) so drag continues even when pointer leaves the circle"

patterns-established:
  - "AnimationBuilder component directory: packages/frontend/src/components/AnimationBuilder/"
  - "SVG coordinate mapping: bezier(0,0)=SVG(0,100), bezier(1,1)=SVG(100,0) — y-axis flip for natural interaction"

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 08 Plan 02: BezierEditor and EasingPicker Summary

**SVG cubic bezier curve editor with draggable handles (BezierEditor) and 9-preset easing dropdown with visual curve thumbnails (EasingPicker), composed as standalone reusable components**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T01:44:06Z
- **Completed:** 2026-03-14T01:47:00Z
- **Tasks:** 2
- **Files modified:** 4 created

## Accomplishments

- BezierEditor renders an SVG curve editor with draggable p1/p2 control points using pointer capture for smooth dragging, reference line, dashed handle arms, and calls onChange on every drag move
- EasingPicker renders a custom dropdown (not native select) with 9 preset easing curve thumbnails (Linear, Ease In/Out, Ease In-Out, Cubic variants, Bounce, Elastic) plus Custom option that shows BezierEditor inline
- Both components use dark theme token conventions and type-check cleanly against shared-types KeyframeEasing/CubicBezierEasing

## Task Commits

Each task was committed atomically:

1. **Task 1: Build BezierEditor SVG component** - `8c22e8d` (feat)
2. **Task 2: Build EasingPicker dropdown with curve thumbnails** - `979ecd4` (feat)

## Files Created/Modified

- `packages/frontend/src/components/AnimationBuilder/BezierEditor.tsx` - SVG cubic bezier curve editor, draggable control handles with pointer capture
- `packages/frontend/src/components/AnimationBuilder/BezierEditor.css` - Dark theme styles using CSS tokens
- `packages/frontend/src/components/AnimationBuilder/EasingPicker.tsx` - Custom dropdown with preset easing options (SVG thumbnails) and inline BezierEditor for custom curves
- `packages/frontend/src/components/AnimationBuilder/EasingPicker.css` - Dropdown, option row, and bezier container styles

## Decisions Made

- Used actual CSS token variable names from `tokens.css` (`--color-bg-elevated`, `--color-accent-green`, `--color-text-secondary`, etc.) rather than the shorthand aliases mentioned in the plan spec (`--surface-2`, `--accent`, `--text-muted`) — the actual tokens are what exist in the codebase
- BezierEditor viewBox is `"-10 -30 120 160"` to provide space for control handles that overshoot the 0-1 range (elastic/overshoot bezier curves)
- EasingPicker uses `<button>` elements for options (not `<option>` in `<select>`) to support inline SVG thumbnails in the dropdown list
- Pointer capture is set on the individual circle handle elements, with pointer move handled on the parent SVG element — this way drag works even when the pointer leaves the handle circle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rebuilt shared-types dist to expose KeyframeEasing and CubicBezierEasing**
- **Found during:** Task 2 (EasingPicker)
- **Issue:** EasingPicker imports `KeyframeEasing` and `CubicBezierEasing` from `@eigen/shared-types`. These types were added to shared-types source in Plan 01, but the dist had not been rebuilt, causing TypeScript errors: "Module '@eigen/shared-types' has no exported member 'KeyframeEasing'"
- **Fix:** Ran `cd packages/shared-types && npx tsc --build` to regenerate dist/index.d.ts with the new types
- **Files modified:** packages/shared-types/dist/ (gitignored, not committed)
- **Verification:** `npx tsc --noEmit` in frontend package passed with no errors
- **Committed in:** 979ecd4 (Task 2 commit — dist excluded since gitignored)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The shared-types rebuild was a necessary prerequisite that Plan 01 didn't commit (build artifacts are gitignored). No scope creep.

## Issues Encountered

None beyond the shared-types dist rebuild documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- BezierEditor and EasingPicker are self-contained, type-safe, and ready to be imported by:
  - Plan 04 (KeyframeTimeline): EasingPicker for selecting easing between keyframe pairs in the timeline UI
  - Any other component that needs easing selection (e.g. per-phase easing in AnimationEditor could use EasingPicker instead of plain select)
- No blockers for dependent plans

---
*Phase: 08-keyframe-position-animation*
*Completed: 2026-03-14*
