# Phase 12: UI/UX Layout Improvements - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the SubtitlesPage controls layout: reorganize the toolbar buttons into logical groups, convert the Global Styling overlay drawer into an inline right panel, style the stage tabs properly, and resize the text editor buttons. No new features — purely layout and styling improvements to existing controls.

</domain>

<decisions>
## Implementation Decisions

### Toolbar Reorganization
- **D-01:** Toolbar stays between preview and editor (current position), reorganized into grouped button bar with visual separators
- **D-02:** Button groups: [Undo/Redo] [Save] [Time Shift + Apply/Reset] | [Render MP4 / Download] | [Re-transcribe, Replace Video, Upload new]
- **D-03:** Buttons use consistent compact sizing with logical grouping

### Stage Tabs
- **D-04:** Stage tabs (Text Edit, Word Timing, Animation) styled as proper tabs — active tab highlighted, inactive muted, consistent sizing, matching the app's dark theme

### Text Editor Buttons
- **D-05:** Upload SRT and Go to subtitle buttons stay in the text editor area but resized as compact inline buttons, styled consistently with other controls

### Global Styling Placement
- **D-06:** Global Styling moves from overlay drawer to the right side panel (always visible, not collapsible by default)
- **D-07:** The overlay drawer component (StyleDrawer with backdrop) is removed entirely
- **D-08:** The "Global Styling" button in the toolbar is removed (panel is always visible)

### Right Panel Behavior
- **D-09:** Right panel is a single slot — shows Global Style by default
- **D-10:** When user clicks a phrase/speaker to edit overrides, the right panel content swaps to show Phrase/Speaker/Word style override controls
- **D-11:** Override view has a close button (x or "Back to Global") that returns to Global Styling view
- **D-12:** Clicking away does NOT auto-return to Global — only the close button does

### Panel Layout Strategy
- **D-13:** Full-height side panels — Lane panel (left) and Style panel (right) span the entire page height, with preview + toolbar + editor sitting in the center column between them
- **D-14:** Lane panel is visible on ALL stages (Text Edit, Word Timing, Animation) — not hidden on any stage
- **D-15:** Both side panels have fixed width (~200-250px), not resizable. Collapsible via toggle button but not drag-resizable

### Claude's Discretion
- Exact pixel widths for side panels (within the ~200-250px range)
- Visual separator style between toolbar button groups
- Tab styling details (border, highlight color, font weight)
- Compact button sizing and spacing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Existing Components (read for patterns)
- `packages/frontend/src/pages/SubtitlesPage.tsx` — Main page layout, toolbar, panel orchestration
- `packages/frontend/src/pages/SubtitlesPage.css` — Current layout CSS
- `packages/frontend/src/components/StyleDrawer/StyleDrawer.tsx` — Current overlay drawer (to be replaced)
- `packages/frontend/src/components/StyleDrawer/StyleDrawer.css` — Drawer CSS (to be removed)
- `packages/frontend/src/components/LaneSidePanel.tsx` — Left panel pattern (collapsible, fixed width)
- `packages/frontend/src/components/LaneSidePanel.css` — Left panel CSS
- `packages/frontend/src/components/PhraseStyleSidePanel.tsx` — Right panel pattern (phrase/speaker override)
- `packages/frontend/src/components/PhraseStyleSidePanel.css` — Right panel CSS
- `packages/frontend/src/components/StageTabBar.tsx` — Stage tabs component
- `packages/frontend/src/components/StylePanel/StylePanel.tsx` — Global style controls (reused in new right panel)
- `packages/frontend/src/components/StylePanel/SpeakerStylePanel.tsx` — Speaker style controls (reused in new right panel)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StylePanel` + `SpeakerStylePanel`: Already separate components — can be composed into the new right panel directly
- `PhraseStylePanel`: Already exists for phrase-level overrides
- `LaneSidePanel`: Pattern for collapsible side panel with toggle button — reuse same CSS pattern for right panel

### Established Patterns
- Side panels use a `--collapsed` modifier class for toggle state
- Panels have a `__toggle` button with arrow indicator
- CSS uses BEM naming (`component__element--modifier`)
- Layout uses flexbox with percentage-based heights for top/bottom split

### Integration Points
- `SubtitlesPage.tsx` orchestrates all panels via state (`drawerMode`, `rightPanelMode`)
- `drawerMode` state can be removed once StyleDrawer overlay is replaced
- `rightPanelMode` state needs extension to include a `'global'` type as default
- `StageTabBar` component needs CSS-only changes (no logic changes expected)

</code_context>

<specifics>
## Specific Ideas

- Right panel should feel like a natural permanent fixture, not a toggled drawer
- The current LaneSidePanel toggle pattern (arrow + label) works well — use similar for right panel
- Toolbar should feel organized and intentional, not like a random collection of buttons

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-ui-ux-layout-improvements*
*Context gathered: 2026-04-07*
