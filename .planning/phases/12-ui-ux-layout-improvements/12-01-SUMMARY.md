---
phase: 12-ui-ux-layout-improvements
plan: 01
subsystem: ui
tags: [react, css, flexbox, layout-refactor, subtitles-editor]

# Dependency graph
requires:
  - phase: 06-styling
    provides: StylePanel and SpeakerStylePanel components (global styling controls)
  - phase: 09-lane-based-positioning
    provides: LaneSidePanel collapsible side panel pattern (BEM toggle/content structure)
provides:
  - Permanent, always-visible right-side GlobalStyleSidePanel replacing the overlay StyleDrawer
  - Single-slot right panel mode swap (global default -> phrase/speaker override -> back to global)
  - Three-column full-height flex layout for SubtitlesPage (LaneSidePanel | center | GlobalStyleSidePanel)
  - Lane panel now permanently visible across all editor stages, independent of preview collapse
affects: [12-02 toolbar reorganization, 12-03 tab/button styling polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-height flow side panels (position: relative, flex-shrink: 0, height: 100%) replacing position:absolute overlay panels"
    - "Single-slot discriminated-union panel state ({ type: 'global' | 'phrase' | 'speaker' }) driving one component's rendered content instead of mounting/unmounting separate panel components"

key-files:
  created:
    - packages/frontend/src/components/GlobalStyleSidePanel.tsx
    - packages/frontend/src/components/GlobalStyleSidePanel.css
  modified:
    - packages/frontend/src/components/LaneSidePanel.css
    - packages/frontend/src/pages/SubtitlesPage.tsx
    - packages/frontend/src/pages/SubtitlesPage.css
  removed:
    - packages/frontend/src/components/PhraseStyleSidePanel.tsx
    - packages/frontend/src/components/PhraseStyleSidePanel.css
    - packages/frontend/src/components/StyleDrawer/StyleDrawer.tsx
    - packages/frontend/src/components/StyleDrawer/StyleDrawer.css

key-decisions:
  - "Consolidated StyleSidePanel (phrase/speaker override) and StyleDrawer (global) into one GlobalStyleSidePanel component per D-09's single-slot requirement, rather than keeping two panel components that could visually collide"
  - "Kept StyleDrawer/PhraseStylePanel.tsx (the override control body) — only the overlay drawer chrome (StyleDrawer.tsx/.css) was removed"
  - "Removed the now-orphaned .subtitles-page__styling-btn CSS rule alongside its JSX button (Rule 1 hygiene — dead code from the deleted toolbar button)"

patterns-established:
  - "Full-height flanking side panel: position: relative; flex-shrink: 0; width: <200-250px>; height: 100% as direct sibling of a flex:1 center column in a flex-direction: row container"
  - "Panel toggle button doubles as back-control: onClick is onToggleCollapse in default/global mode, onBack in override mode"

requirements-completed: [D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15]

coverage:
  - id: D1
    description: "GlobalStyleSidePanel component created as single consolidated right-panel with global/phrase/speaker mode swap, LaneSidePanel.css converted to full-height flow layout"
    requirement: "D-06, D-09, D-10, D-11, D-13, D-15"
    verification:
      - kind: other
        ref: "npx tsc --noEmit -p packages/frontend/tsconfig.json"
        status: pass
      - kind: other
        ref: "grep acceptance criteria (exports, RightPanelMode union, no absolute positioning/keyframes in GlobalStyleSidePanel.css, .lane-side-panel flow layout)"
        status: pass
    human_judgment: true
    rationale: "Visual layout correctness (panel widths, collapse toggle behavior, no overlap/overflow) requires human inspection in the running app per the phase's Plan 02 human-verify checkpoint"
  - id: D2
    description: "SubtitlesPage restructured into three-column full-height layout; StyleDrawer overlay, PhraseStyleSidePanel, and the Global Styling toolbar button removed; rightPanelMode initializes to global"
    requirement: "D-07, D-08, D-12, D-14"
    verification:
      - kind: other
        ref: "npx tsc --noEmit -p packages/frontend/tsconfig.json && npm run build (vite build)"
        status: pass
      - kind: other
        ref: "grep acceptance criteria (no StyleDrawer/drawerMode/styling-btn references, GlobalStyleSidePanel imported, rightPanelMode inits to global, subtitles-page__center present in tsx+css, flex-direction: row)"
        status: pass
    human_judgment: true
    rationale: "Full click-through verification (clicking phrase/speaker swaps panel, back button returns to global, lane panel visible on all three stages, no click-away auto-close) requires a running app and human interaction — covered by the phase's Plan 02 human-verify checkpoint"

duration: 15min
completed: 2026-07-02
status: complete
---

# Phase 12 Plan 01: Permanent Style/Lane Side Panels Summary

**Converted SubtitlesPage from a single-column layout with absolutely-positioned overlay panels into a three-column full-height flex layout with a permanent left LaneSidePanel and a permanent right GlobalStyleSidePanel that swaps between Global/Phrase/Speaker styling controls, removing the StyleDrawer overlay entirely.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-02T12:57:22Z
- **Tasks:** 2 completed
- **Files modified:** 3 modified, 2 created, 4 deleted

## Accomplishments
- New `GlobalStyleSidePanel` component: single always-visible right panel that defaults to Global Styling (`StylePanel` + `SpeakerStylePanel`) and swaps to `PhraseStylePanel`/`SpeakerStylePanel` override controls when a phrase or speaker is selected, with a toggle button that acts as collapse (global mode) or back-to-global (override mode)
- `LaneSidePanel.css` and the new `GlobalStyleSidePanel.css` both converted to full-height flow layout (`position: relative; flex-shrink: 0; height: 100%`) instead of `position: absolute` overlay panels
- `SubtitlesPage.tsx` restructured: `LaneSidePanel` and `GlobalStyleSidePanel` are now permanent outer-level siblings of a new `subtitles-page__center` wrapper (holding the preview/toolbar/resize-handle/editor content), so the lane panel is visible on all three stages regardless of preview-collapse state
- `rightPanelMode` now initializes to `{ type: 'global' }` (never `null`); removed `drawerMode`/`setDrawerMode` state entirely
- Removed the overlay `StyleDrawer` component/CSS, the superseded `PhraseStyleSidePanel.tsx/.css`, and the "Global Styling" toolbar button (and its now-orphaned CSS rule)
- `SubtitlesPage.css` `.subtitles-page--preview` changed from `flex-direction: column` to `flex-direction: row`; added `.subtitles-page__center` wrapper rule

## Task Commits

Each task was committed atomically:

1. **Task 1: Create consolidated GlobalStyleSidePanel and convert LaneSidePanel to flow layout** - `bed12bf` (feat)
2. **Task 2: Restructure SubtitlesPage into three-column layout and remove StyleDrawer overlay** - `1bbca22` (feat)

_Note: `containerRef` for the resize-handle percentage calculation was intentionally left on the outer `subtitles-page--preview` div — its height is unchanged by the panels becoming row siblings, so no code change was needed there (per RESEARCH.md Pitfall 2)._

## Files Created/Modified
- `packages/frontend/src/components/GlobalStyleSidePanel.tsx` - New consolidated right-panel component (global/phrase/speaker mode swap)
- `packages/frontend/src/components/GlobalStyleSidePanel.css` - New stylesheet, full-height flow layout, BEM prefix `global-style-panel`
- `packages/frontend/src/components/LaneSidePanel.css` - Converted from `position: absolute` overlay to full-height flow layout
- `packages/frontend/src/pages/SubtitlesPage.tsx` - Three-column layout restructure, state changes, StyleDrawer/PhraseStyleSidePanel removal
- `packages/frontend/src/pages/SubtitlesPage.css` - `.subtitles-page--preview` row layout, new `.subtitles-page__center` rule, removed orphaned `.subtitles-page__styling-btn`
- `packages/frontend/src/components/PhraseStyleSidePanel.tsx` (deleted) - Superseded by GlobalStyleSidePanel
- `packages/frontend/src/components/PhraseStyleSidePanel.css` (deleted) - Superseded by GlobalStyleSidePanel.css
- `packages/frontend/src/components/StyleDrawer/StyleDrawer.tsx` (deleted) - Overlay drawer removed per D-07
- `packages/frontend/src/components/StyleDrawer/StyleDrawer.css` (deleted) - Overlay drawer removed per D-07

## Decisions Made
- Consolidated the two existing right-panel infrastructures (`StyleSidePanel`'s mode-swap pattern and `StyleDrawer`'s global-styling body) into one `GlobalStyleSidePanel` component rather than keeping them separate, satisfying D-09's single-slot requirement without risking two panels occupying the same visual space
- Retained `StyleDrawer/PhraseStylePanel.tsx` (the override control body) since it is still consumed by `GlobalStyleSidePanel` in phrase mode — only the drawer chrome was removed
- Removed the orphaned `.subtitles-page__styling-btn` CSS rule when its JSX button was deleted (minor Rule 1 hygiene cleanup, not left as dead code)

## Deviations from Plan

None - plan executed exactly as written. Toolbar button grouping (D-01/D-02/D-03) was explicitly out of scope for this plan per its own instructions ("Do NOT reorganize the remaining toolbar buttons — that is Plan 02's scope") and was left untouched.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `GlobalStyleSidePanel` and the three-column layout are in place and typecheck/build clean; Plan 02 (toolbar reorganization with `subtitles-page__toolbar-group`/`subtitles-page__toolbar-separator`) and Plan 03 (tab bar + text editor button styling) can build directly on this structure
- Full interactive/visual verification (panel swap on phrase/speaker click, back-to-global button, no click-away auto-close, lane panel visible across all three stages) is deferred to the phase's human-verify checkpoint in Plan 02, per the plan's own verification note

---
*Phase: 12-ui-ux-layout-improvements*
*Completed: 2026-07-02*

## Self-Check: PASSED

All created/modified files verified present, all four deleted files confirmed absent, both task commit hashes (`bed12bf`, `1bbca22`) verified present in git log.
