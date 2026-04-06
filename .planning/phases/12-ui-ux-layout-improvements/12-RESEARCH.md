# Phase 12: UI/UX Layout Improvements - Research

**Researched:** 2026-04-06
**Domain:** React layout restructuring, CSS flexbox panels, component refactoring
**Confidence:** HIGH

## Summary

Phase 12 is a pure layout and styling refactor of `SubtitlesPage`. No new features, no new backend routes, no new dependencies. The work falls into four distinct areas: (1) reorganize the toolbar into logical button groups with visual separators, (2) replace the overlay `StyleDrawer` with a permanent right side panel that shows Global Styling by default and swaps to override controls on phrase/speaker selection, (3) style the `StageTabBar` more distinctly (though it already has active/suggested states — mainly sizing/visual polish), and (4) resize the text editor inline buttons.

The codebase already has the pattern infrastructure: `LaneSidePanel` is the reference implementation for a collapsible fixed-width side panel (BEM CSS, `--collapsed` modifier, vertical toggle button). `PhraseStyleSidePanel` (`StyleSidePanel` component) exists as the right-panel infrastructure but currently only appears when a phrase/speaker is selected. `StylePanel` and `SpeakerStylePanel` components already exist and are composed inside `StyleDrawer` — they can be moved directly into the new right panel. The biggest state change is extending `RightPanelMode` to add a `'global'` default and removing the `drawerMode` / `StyleDrawer` entirely.

The main structural risk is the layout model for the "top row" in `SubtitlesPage`. Currently, `subtitles-page__top-row` uses `position: relative` with the left panel (`LaneSidePanel`) and right panel (`StyleSidePanel`) absolutely positioned. Moving to full-height side panels that span the entire page height (D-13) requires converting the outer `subtitles-page--preview` layout from `flex-direction: column` to a three-column `flex-direction: row` with the center column holding all the current vertical content.

**Primary recommendation:** Implement as three sequential plans — (1) right panel infrastructure + state change + removal of StyleDrawer overlay, (2) toolbar reorganization, (3) tab styling and text editor button sizing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Toolbar stays between preview and editor (current position), reorganized into grouped button bar with visual separators
- **D-02:** Button groups: [Undo/Redo] [Save] [Time Shift + Apply/Reset] | [Render MP4 / Download] | [Re-transcribe, Replace Video, Upload new]
- **D-03:** Buttons use consistent compact sizing with logical grouping
- **D-04:** Stage tabs (Text Edit, Word Timing, Animation) styled as proper tabs — active tab highlighted, inactive muted, consistent sizing, matching the app's dark theme
- **D-05:** Upload SRT and Go to subtitle buttons stay in the text editor area but resized as compact inline buttons, styled consistently with other controls
- **D-06:** Global Styling moves from overlay drawer to the right side panel (always visible, not collapsible by default)
- **D-07:** The overlay drawer component (StyleDrawer with backdrop) is removed entirely
- **D-08:** The "Global Styling" button in the toolbar is removed (panel is always visible)
- **D-09:** Right panel is a single slot — shows Global Style by default
- **D-10:** When user clicks a phrase/speaker to edit overrides, the right panel content swaps to show Phrase/Speaker/Word style override controls
- **D-11:** Override view has a close button (x or "Back to Global") that returns to Global Styling view
- **D-12:** Clicking away does NOT auto-return to Global — only the close button does
- **D-13:** Full-height side panels — Lane panel (left) and Style panel (right) span the entire page height, with preview + toolbar + editor sitting in the center column between them
- **D-14:** Lane panel is visible on ALL stages (Text Edit, Word Timing, Animation) — not hidden on any stage
- **D-15:** Both side panels have fixed width (~200-250px), not resizable. Collapsible via toggle button but not drag-resizable

### Claude's Discretion
- Exact pixel widths for side panels (within the ~200-250px range)
- Visual separator style between toolbar button groups
- Tab styling details (border, highlight color, font weight)
- Compact button sizing and spacing

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.x | UI rendering | Existing project stack |
| CSS (co-located) | — | Component styling | Project convention: no CSS modules, no styled-components |
| Flexbox | — | Layout primitive | Established layout approach throughout project |

### No new dependencies needed
This phase is purely restructuring existing components and CSS. No npm installs required.

## Architecture Patterns

### Current Layout Model (to change)

```
subtitles-page--preview  [flex-column, full-height]
  subtitles-page__top  [flex-column, topPercent height]
    subtitles-page__top-row  [position:relative, flex-row, justify:center]
      LaneSidePanel  [position:absolute, left:0]    ← overlay, not flow
      PreviewPanel   [centered in flow]
      StyleSidePanel [position:absolute, right:0]   ← overlay, not flow
    subtitles-page__top-controls  [toolbar row]
  resize-handle
  subtitles-page__bottom  [flex-column, remaining height]
    StageTabBar
    MiniTimeline
    editor-scroll
      editor-section
```

### Target Layout Model (after Phase 12)

```
subtitles-page--preview  [flex-row, full-height]
  LaneSidePanel  [flex-none, fixed width ~220px, full-height, flow position]
  subtitles-page__center  [flex-1, flex-column, full-height, min-width:0]
    subtitles-page__top  [flex-column, topPercent height]
      PreviewPanel  [centered in flow]
      subtitles-page__top-controls  [toolbar row — grouped]
    resize-handle
    subtitles-page__bottom  [flex-column, remaining height]
      StageTabBar
      MiniTimeline
      editor-scroll
  GlobalStyleSidePanel  [flex-none, fixed width ~240px, full-height, flow position]
```

### Pattern 1: Right Panel as Default-Global, Swap-on-Edit

The `PhraseStyleSidePanel.tsx` exports `StyleSidePanel` with `RightPanelMode` type currently:
```typescript
export type RightPanelMode =
  | { type: 'phrase'; phraseIndex: number }
  | { type: 'speaker'; speakerId: string }
```

Needs extension:
```typescript
export type RightPanelMode =
  | { type: 'global' }
  | { type: 'phrase'; phraseIndex: number }
  | { type: 'speaker'; speakerId: string }
```

`SubtitlesPage` state changes:
- Remove: `const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null)`
- Change init: `const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>({ type: 'global' })`
- Right panel `onClose` handler now sets `{ type: 'global' }` instead of `null`
- Remove `<StyleDrawer />` from JSX
- Remove `StyleDrawer` import

### Pattern 2: Full-Height Side Panels (Flow, Not Absolute)

Current problem: `LaneSidePanel` uses `position: absolute` with `left:0; top:0; bottom:0` — it overlays on top of content instead of taking space in flow. The right panel (`phrase-side-panel`) also uses `position: absolute; right:0`.

Target: Both panels are `flex-none` siblings in a three-column flex row at the page level. The `LaneSidePanel.css` and `PhraseStyleSidePanel.css` changes needed:

```css
/* Before */
.lane-side-panel {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 200px;
  ...
}

/* After */
.lane-side-panel {
  position: relative;   /* or static — no longer absolute */
  flex-shrink: 0;
  width: 220px;         /* within 200-250px discretionary range */
  height: 100%;         /* fills parent flex row height */
  ...
}

.lane-side-panel--collapsed {
  width: 28px;
  /* remove: bottom: auto */
}
```

The `subtitles-page__top-row` `position: relative` container and `justify-content: center` approach for centering the preview can be replaced with the center column's own layout.

### Pattern 3: New GlobalStyleSidePanel Component

Create `GlobalStyleSidePanel.tsx` + `GlobalStyleSidePanel.css` following the LaneSidePanel pattern:
- Toggle button with collapse behavior (mirroring `lane-side-panel__toggle` pattern)
- Content area rendering `<StylePanel />` + `<SpeakerStylePanel />` (extracted from StyleDrawer body)
- Header: "Global Styling" label
- Collapsed state: width shrinks to 28px, content hidden, toggle shows vertically
- This is distinct from `PhraseStyleSidePanel` which remains for override mode

The `StyleSidePanel` component in `PhraseStyleSidePanel.tsx` needs its `onClose` to return to global (not null). Its header close arrow (`\u25B6`) becomes a "back to global" close button.

### Pattern 4: Toolbar Button Groups with Separators

Current `subtitles-page__top-controls` is a flat flex row with `gap: var(--spacing-md)`. Target: grouped sections with visual dividers.

Two implementation approaches:
1. **CSS `::before` pseudo-element** on group wrapper divs — pure CSS, no markup change
2. **`<div class="toolbar-separator">` elements** — explicit markup, simpler to place

Recommendation: explicit separator elements. A 1px vertical line with reduced opacity:
```css
.subtitles-page__toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  flex-shrink: 0;
  align-self: center;
}
```

Groups in JSX:
```jsx
<div className="subtitles-page__toolbar-group">
  {/* Undo/Redo */}
</div>
<div className="subtitles-page__toolbar-separator" />
<div className="subtitles-page__toolbar-group">
  {/* Save + AutoSaveIndicator */}
</div>
<div className="subtitles-page__toolbar-separator" />
<div className="subtitles-page__toolbar-group">
  {/* Time Shift label + input + Apply + Reset */}
</div>
<div className="subtitles-page__toolbar-separator" />
<div className="subtitles-page__toolbar-group">
  {/* Render MP4 + Download */}
</div>
<div className="subtitles-page__toolbar-separator" />
<div className="subtitles-page__toolbar-group">
  {/* Re-transcribe + Replace Video + Upload new */}
</div>
```

Note: D-02 puts "Upload new" in the last group. "Go to subtitle" is in the first group per D-05 interpretation — it currently lives in `top-controls`. Recommend keeping it in the first group alongside Undo/Redo, or as a standalone item before the separator. Planner should decide exact placement.

### Pattern 5: StageTabBar Styling

The tab bar already has solid implementation: active tab gets green bottom border + `font-weight: 500`, suggested tab gets slightly brighter text + a green dot, hover elevates text color. The CSS in `StageTabBar.css` is functional.

D-04 asks for "proper tabs — active tab highlighted, inactive muted, consistent sizing". The current implementation already satisfies most of this. Changes needed are cosmetic:
- Increase padding for consistent sizing feel
- Ensure inactive tabs feel sufficiently muted vs active
- Background treatment (current: transparent on inactive, `bg-base` on bar background)

The tab labels are currently "Text Edit View", "Word Timing", "Animation" — these may be renamed to shorter versions ("Text Edit", "Word Timing", "Animation") for compact sizing consistency.

### Anti-Patterns to Avoid

- **Breaking `position: relative` containing blocks:** When removing absolute positioning from panels, ensure no children rely on those panels as containing blocks for their own absolute elements.
- **Center column width thrash:** After moving to three-column flex, the `PreviewPanel` uses a `ResizeObserver` for responsive sizing — it will adapt, but the center column needs `min-width: 0` to allow flex shrinking.
- **Right panel always-visible collision with collapse:** D-06 says "not collapsible by default" — the toggle button should still exist (D-15 says collapsible via toggle) but starts expanded. Initialize `collapsed` state as `false`.
- **`topPercent` resize still functional:** The drag resize handle adjusts the `top`/`bottom` split. After moving to three columns, the resize handle is inside the center column — the percentage-based height calculation must reference the center column height, not full page. Currently the `containerRef` on the outer div drives the percentage calculation. This containerRef should move to the center column div.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsible side panel | Custom animation system | Reuse LaneSidePanel CSS pattern | Pattern already proven in production |
| Overlay drawer for global styling | Keep StyleDrawer | Convert to inline GlobalStyleSidePanel | D-07 explicitly removes overlay |
| Tab underline indicator | SVG/Canvas | CSS `border-bottom` on active tab | Already works in StageTabBar.css |
| Toolbar separators | Gradient/complex separator | 1px `background: var(--color-border)` div | Matches existing border token usage |

## Common Pitfalls

### Pitfall 1: Absolute-Positioned Panels Breaking When Converted to Flow

**What goes wrong:** `LaneSidePanel` uses `position: absolute; top:0; bottom:0` — removing this without setting up the parent flex row correctly causes the panel to collapse to 0 height or overflow the page.

**Why it happens:** The panel currently relies on the `subtitles-page__top-row` container for height. After moving to full-height panels, they need to sit at the `subtitles-page--preview` level (the outermost flex container), not inside `top-row`.

**How to avoid:** The three-column flex layout goes at the `subtitles-page--preview` level. `LaneSidePanel` and `GlobalStyleSidePanel` are direct children of this outer container. The center column (`subtitles-page__center`) is a new intermediate wrapper that holds everything currently in the `subtitles-page--preview` div body (the top section, resize handle, and bottom section).

**Warning signs:** If the panel height is 0 or the preview panel overflows its container, the flex hierarchy is wrong.

### Pitfall 2: containerRef for Resize Calculation

**What goes wrong:** `containerRef` on `subtitles-page--preview` (outer div) drives the percentage calculation for the resize handle (`onMove` uses `container.getBoundingClientRect().height`). If panels are now full-height siblings outside the center column, the outer container height is the same, so the calculation remains correct. However, if `containerRef` moves, the calculation breaks.

**Why it happens:** The outer `--preview` div's height equals the viewport minus the header, which is correct. The resize should keep `containerRef` on the outer div or move it to the center column — both have the same height since side panels don't change the column height in a row layout.

**How to avoid:** Keep `containerRef` on the outermost `--preview` div (or move to center column — same result). Do not put it on the side panel row container.

**Warning signs:** The resize handle dragging produces wrong percentages or the top/bottom ratio flies to 0% or 100% immediately.

### Pitfall 3: LaneSidePanel Visibility on All Stages (D-14)

**What goes wrong:** Currently, `LaneSidePanel` is conditionally rendered inside the `!previewCollapsed` block:
```jsx
{!previewCollapsed && (
  <LaneSidePanel ... />
)}
```
This means it already disappears when the preview is collapsed, and it's inside the `top-row` which is conceptually "preview section."

**Why it happens:** D-14 says the lane panel should be visible on ALL stages. Currently it may already be visible on all stages when preview is expanded, but after the layout restructure it must remain visible even when preview is collapsed.

**How to avoid:** Move `LaneSidePanel` to the outer three-column level (not gated by `!previewCollapsed`). It should be a permanent fixture regardless of preview or stage state.

### Pitfall 4: Right Panel rightPanelMode Initialization

**What goes wrong:** `rightPanelMode` initialized as `null` currently — after Phase 12 it must initialize as `{ type: 'global' }`. If the component uses `null` checks to hide the panel, those checks will break.

**Why it happens:** The existing `StyleSidePanel` checks `if (!mode) return null`. After extending `RightPanelMode`, null is no longer a valid mode. The right panel is always shown.

**How to avoid:** Initialize `rightPanelMode` as `{ type: 'global' }`. The `StyleSidePanel`/`GlobalStyleSidePanel` components should not render null for `global` mode — they always show. The conditional `{!previewCollapsed && rightPanelMode !== null && <StyleSidePanel>}` needs to become `<GlobalStyleSidePanel>` (always rendered at outer level).

### Pitfall 5: StyleDrawer Import Removal

**What goes wrong:** `StyleDrawer` is imported in `SubtitlesPage.tsx` alongside `DrawerMode` type. Removing `StyleDrawer` without removing the import causes a TypeScript error.

**How to avoid:** Remove the import of `StyleDrawer` and `DrawerMode` from `SubtitlesPage.tsx`. Also remove the `drawerMode` state and `setDrawerMode` calls. The "Global Styling" button in the toolbar (line ~819) must also be removed (D-08).

## Code Examples

### Current SubtitlesPage state to remove/change
```typescript
// REMOVE:
const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null)

// CHANGE:
// Before:
const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode | null>(null)
// After:
const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>({ type: 'global' })
```

### Outer layout change
```tsx
// Before: single flex-column div
<div className="subtitles-page subtitles-page--preview" ref={containerRef}>
  <div className="subtitles-page__top" ...>
    <div className="subtitles-page__top-row">  {/* position:relative, panels absolute inside */}
      <LaneSidePanel .../>       {/* absolute left */}
      <PreviewPanel />
      <StyleSidePanel />         {/* absolute right */}
    </div>
    <toolbar />
  </div>
  <resize-handle />
  <subtitles-page__bottom />
</div>

// After: three-column flex-row outer, center column holds old vertical content
<div className="subtitles-page subtitles-page--preview" ref={containerRef}>
  <LaneSidePanel ... />                    {/* flow, flex-none, full height */}
  <div className="subtitles-page__center"> {/* flex:1, flex-column, min-width:0 */}
    <div className="subtitles-page__top" ...>
      <PreviewPanel />
      <toolbar />
    </div>
    <resize-handle />
    <subtitles-page__bottom />
  </div>
  <GlobalStyleSidePanel
    mode={rightPanelMode}
    onBack={() => setRightPanelMode({ type: 'global' })}
  />
</div>
```

### New RightPanelMode type
```typescript
export type RightPanelMode =
  | { type: 'global' }
  | { type: 'phrase'; phraseIndex: number }
  | { type: 'speaker'; speakerId: string }
```

### GlobalStyleSidePanel structure (new component)
```tsx
// packages/frontend/src/components/GlobalStyleSidePanel.tsx
import { StylePanel } from './StylePanel/StylePanel.tsx'
import { SpeakerStylePanel } from './StylePanel/SpeakerStylePanel.tsx'
import { PhraseStylePanel } from './StyleDrawer/PhraseStylePanel.tsx'
import { type RightPanelMode } from './PhraseStyleSidePanel.tsx'
import './GlobalStyleSidePanel.css'

interface GlobalStyleSidePanelProps {
  mode: RightPanelMode
  onBack: () => void  // returns to 'global' mode
  collapsed: boolean
  onToggleCollapse: () => void
}

export function GlobalStyleSidePanel({ mode, onBack, collapsed, onToggleCollapse }: GlobalStyleSidePanelProps) {
  const isGlobal = mode.type === 'global'
  const title = isGlobal ? 'Global Styling' : (mode.type === 'phrase' ? 'Phrase Style' : 'Speaker Style')

  return (
    <div className={`global-style-panel${collapsed ? ' global-style-panel--collapsed' : ''}`}>
      <button type="button" className="global-style-panel__toggle" onClick={isGlobal ? onToggleCollapse : onBack}>
        <span>{title}</span>
        <span className="global-style-panel__toggle-arrow">
          {isGlobal ? (collapsed ? '\u25C0' : '\u25B6') : '\u00D7'}
        </span>
      </button>
      <div className="global-style-panel__content">
        {isGlobal && <StylePanel />}
        {isGlobal && <SpeakerStylePanel />}
        {mode.type === 'phrase' && <PhraseStylePanel phraseIndex={mode.phraseIndex} />}
        {mode.type === 'speaker' && <SpeakerStylePanel singleSpeakerId={mode.speakerId} />}
      </div>
    </div>
  )
}
```

### LaneSidePanel CSS changes
```css
/* Before: */
.lane-side-panel {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  z-index: 10;
  width: 200px;
  ...
}

/* After: */
.lane-side-panel {
  position: relative;
  flex-shrink: 0;
  width: 220px;
  height: 100%;
  z-index: auto;
  ...
}

/* Collapsed: remove bottom: auto — height:100% handles it */
.lane-side-panel--collapsed {
  width: 28px;
  /* remove: bottom: auto */
}
```

### Toolbar group CSS
```css
.subtitles-page__toolbar-group {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
}

.subtitles-page__toolbar-separator {
  width: 1px;
  height: 20px;
  background: var(--color-border);
  flex-shrink: 0;
  align-self: center;
}
```

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. This phase is purely frontend CSS/TSX changes.

## Validation Architecture

`workflow.nyquist_validation` key is absent from `.planning/config.json` — treated as enabled. However, this project has no automated test infrastructure (no jest.config, no pytest.ini, no test/ directory). All validation is manual/visual.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — visual verification only |
| Config file | None |
| Quick run command | `cd packages/frontend && npm run build` (TypeScript check via Vite) |
| Full suite command | Same — no automated UI tests |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 through D-15 | Layout and visual behavior | manual | `npm run build` (type safety only) | N/A |

All acceptance criteria are visual — requires human inspection of the running app.

### Wave 0 Gaps
None — existing TypeScript build is the only automated gate. Human verification via `just dev` and browser inspection.

## Sources

### Primary (HIGH confidence)
- Direct source code reading of `SubtitlesPage.tsx`, `LaneSidePanel.tsx/.css`, `PhraseStyleSidePanel.tsx/.css`, `StyleDrawer/StyleDrawer.tsx/.css`, `StageTabBar.tsx/.css`, `SubtitlesPage.css`, `tokens.css`
- CONTEXT.md decisions document — verified all decisions against existing code

### Secondary (MEDIUM confidence)
- CSS flexbox behavior for three-column full-height layouts — standard browser behavior, no external verification needed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, verified existing stack
- Architecture: HIGH — decisions directly reference existing code; current code fully read
- Pitfalls: HIGH — identified from actual current code structure, not speculation

**Research date:** 2026-04-06
**Valid until:** Not time-sensitive (no external libraries involved)
