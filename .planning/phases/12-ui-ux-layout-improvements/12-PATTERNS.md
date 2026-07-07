# Phase 12: UI/UX Layout Improvements - Pattern Map

**Mapped:** 2026-07-02
**Files analyzed:** 8 (modified/removed) + 2 (new)
**Analogs found:** 10 / 10 (all changes are refactors of existing code — analogs are the files themselves plus one sibling pattern to copy)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `packages/frontend/src/components/GlobalStyleSidePanel.tsx` (NEW) | component (side panel) | request-response (state swap on click) | `packages/frontend/src/components/LaneSidePanel.tsx` (structure) + `packages/frontend/src/components/PhraseStyleSidePanel.tsx` (mode-swap pattern) + `packages/frontend/src/components/StyleDrawer/StyleDrawer.tsx` (content to migrate) | exact (composite of 3 existing patterns) |
| `packages/frontend/src/components/GlobalStyleSidePanel.css` (NEW) | config/style | — | `packages/frontend/src/components/LaneSidePanel.css` | exact |
| `packages/frontend/src/components/PhraseStyleSidePanel.tsx` (MODIFIED) | component (side panel) | request-response | itself (extend `RightPanelMode` union) | exact — self-modification |
| `packages/frontend/src/components/LaneSidePanel.css` (MODIFIED) | config/style | — | itself (position:absolute → flex-flow conversion) | exact — self-modification |
| `packages/frontend/src/components/PhraseStyleSidePanel.css` (MODIFIED) | config/style | — | modified `LaneSidePanel.css` (same flow conversion) | exact |
| `packages/frontend/src/pages/SubtitlesPage.tsx` (MODIFIED) | page/controller (orchestrator) | request-response + local state | itself | exact — self-modification |
| `packages/frontend/src/pages/SubtitlesPage.css` (MODIFIED) | config/style | — | itself (layout model change: column → 3-col row) | exact — self-modification |
| `packages/frontend/src/components/StageTabBar.tsx` (MODIFIED — labels only) | component | request-response | itself | exact — no logic changes |
| `packages/frontend/src/components/StageTabBar.css` (MODIFIED — cosmetic) | config/style | — | itself | exact — cosmetic only |
| `packages/frontend/src/components/StyleDrawer/StyleDrawer.tsx` + `.css` (REMOVED) | component (overlay drawer) | — | n/a (deletion) | n/a |
| `packages/frontend/src/components/TextEditor/TextEditor.tsx` (MODIFIED — button sizing only, `.srt-import-btn` class) | component | request-response | `packages/frontend/src/pages/SubtitlesPage.css` `.subtitles-page__goto-btn` (compact button style reference) | role-match |

## Pattern Assignments

### `packages/frontend/src/components/GlobalStyleSidePanel.tsx` (NEW component)

**Analog 1 — structural skeleton:** `packages/frontend/src/components/LaneSidePanel.tsx` (full file, 96 lines)

Toggle button + collapsible content wrapper pattern (lines 29-40):
```tsx
return (
  <div className={`lane-side-panel${collapsed ? ' lane-side-panel--collapsed' : ''}`}>
    <button
      type="button"
      className="lane-side-panel__toggle"
      onClick={() => setCollapsed((c) => !c)}
    >
      <span>Lanes</span>
      <span className="lane-side-panel__toggle-arrow">{collapsed ? '▶' : '◀'}</span>
    </button>

    <div className="lane-side-panel__content">
      {/* ...content... */}
    </div>
  </div>
)
```
Local `collapsed` state (line 25): `const [collapsed, setCollapsed] = useState(false)`

**Analog 2 — mode-swap pattern:** `packages/frontend/src/components/PhraseStyleSidePanel.tsx` (full file, 39 lines)

```tsx
export type RightPanelMode =
  | { type: 'phrase'; phraseIndex: number }
  | { type: 'speaker'; speakerId: string }

interface StyleSidePanelProps {
  mode: RightPanelMode
  onClose: () => void
}

export function StyleSidePanel({ mode, onClose }: StyleSidePanelProps) {
  const title = mode.type === 'phrase' ? 'Phrase Style' : 'Speaker Style'
  return (
    <div className="phrase-side-panel" key={`${mode.type}-${mode.type === 'phrase' ? mode.phraseIndex : mode.speakerId}`}>
      <button type="button" className="phrase-side-panel__toggle" onClick={onClose}>
        <span>{title}</span>
        <span className="phrase-side-panel__toggle-arrow">{'▶'}</span>
      </button>
      <div className="phrase-side-panel__content">
        {mode.type === 'phrase' && <PhraseStylePanel phraseIndex={mode.phraseIndex} />}
        {mode.type === 'speaker' && <SpeakerStylePanel singleSpeakerId={mode.speakerId} />}
      </div>
    </div>
  )
}
```
Copy this exact conditional-render-by-`mode.type` structure for `GlobalStyleSidePanel`, adding a `{ type: 'global' }` branch. RESEARCH.md already specifies the target component shape (lines 340-377) — use it verbatim as the starting point, but note it imports `StylePanel`/`SpeakerStylePanel` for global mode and `PhraseStylePanel`/`SpeakerStylePanel` for override modes.

**Analog 3 — content to migrate:** `packages/frontend/src/components/StyleDrawer/StyleDrawer.tsx` (full file, 45 lines)

```tsx
import { StylePanel } from '../StylePanel/StylePanel.tsx'
import { SpeakerStylePanel } from '../StylePanel/SpeakerStylePanel.tsx'
...
<div className="style-drawer__body">
  <StylePanel />
  <SpeakerStylePanel />
</div>
```
This is the exact content block to move into `GlobalStyleSidePanel`'s `isGlobal` branch. After migration, delete `StyleDrawer.tsx` and `StyleDrawer.css` entirely (D-07).

---

### `packages/frontend/src/components/GlobalStyleSidePanel.css` (NEW)

**Analog:** `packages/frontend/src/components/LaneSidePanel.css` (full file, 175 lines) — copy the toggle/content/collapsed BEM structure wholesale, renaming `lane-side-panel` → `global-style-panel`, and mirror on the right (no `position: absolute; left: 0`, use flow layout per Pattern 2 below).

Toggle + collapsed-state CSS (lines 24-64):
```css
.lane-side-panel__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--color-surface-secondary);
  border: none;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: color var(--transition-fast);
  width: 100%;
  text-align: left;
}
.lane-side-panel--collapsed .lane-side-panel__toggle {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  padding: 10px 6px;
  justify-content: flex-start;
  gap: 6px;
  height: 100%;
  border-bottom: none;
  border-right: 1px solid var(--color-border);
}
```
Content scroll region (lines 66-94):
```css
.lane-side-panel__content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}
.lane-side-panel--collapsed .lane-side-panel__content {
  display: none;
}
```

---

### `packages/frontend/src/components/PhraseStyleSidePanel.tsx` (MODIFY — extend type + close behavior)

**Self-analog, current state** (lines 5-7, 14-15, 19-26):
```typescript
export type RightPanelMode =
  | { type: 'phrase'; phraseIndex: number }
  | { type: 'speaker'; speakerId: string }
```
```tsx
export function StyleSidePanel({ mode, onClose }: StyleSidePanelProps) {
  const title = mode.type === 'phrase' ? 'Phrase Style' : 'Speaker Style'
  ...
  <button type="button" className="phrase-side-panel__toggle" onClick={onClose}>
    <span>{title}</span>
    <span className="phrase-side-panel__toggle-arrow">{'▶'}</span>
  </button>
```

**Target (per RESEARCH.md lines 107-111):**
```typescript
export type RightPanelMode =
  | { type: 'global' }
  | { type: 'phrase'; phraseIndex: number }
  | { type: 'speaker'; speakerId: string }
```
Note: If `GlobalStyleSidePanel.tsx` becomes the single consolidated component per RESEARCH.md's recommendation (rendering all three modes itself), `PhraseStyleSidePanel.tsx`'s `StyleSidePanel` export may be superseded — decide in planning whether to merge `StyleSidePanel` logic directly into `GlobalStyleSidePanel` (recommended, since D-09 requires a single always-visible right-panel slot) or keep `StyleSidePanel` as a sub-component invoked conditionally. Recommend merging into one component to avoid two panels occupying the same visual slot.

---

### `packages/frontend/src/components/LaneSidePanel.css` (MODIFY — absolute → flow)

**Self-analog, current state** (lines 3-22):
```css
.lane-side-panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  width: 200px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  transition: width 0.2s ease;
}

.lane-side-panel--collapsed {
  width: 28px;
  bottom: auto;
}
```

**Target** (per RESEARCH.md lines 391-404):
```css
.lane-side-panel {
  position: relative;
  flex-shrink: 0;
  width: 220px;
  height: 100%;
  z-index: auto;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  transition: width 0.2s ease;
}

.lane-side-panel--collapsed {
  width: 28px;
}
```
All other selectors in this file (toggle, content, checkbox, speaker inputs — lines 24-175) are unaffected and should be left as-is.

---

### `packages/frontend/src/components/PhraseStyleSidePanel.css` (MODIFY — mirror LaneSidePanel.css conversion, remove slide-in overlay animation)

**Self-analog, current state** (lines 3-22):
```css
.phrase-side-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  width: 240px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  animation: phrase-side-panel-slide-in 0.2s ease;
}

@keyframes phrase-side-panel-slide-in {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
```
Apply the same `position: absolute` → `position: relative; flex-shrink: 0; height: 100%` conversion as `LaneSidePanel.css`. The slide-in keyframe animation may be dropped or kept only for the phrase/speaker override transition within the now-permanent panel (not for mount/unmount, since the panel no longer mounts/unmounts).

If consolidating into `GlobalStyleSidePanel.css` (recommended — single panel, single CSS file), this file may be deleted and its rules folded into the new file, using `global-style-panel` BEM prefix throughout instead of two separate prefixes (`lane-side-panel` pattern + `phrase-side-panel` pattern).

---

### `packages/frontend/src/pages/SubtitlesPage.tsx` (MODIFY — layout restructure + state changes)

**Self-analog, current state:**

Imports (lines 9, 19-20):
```typescript
import { StyleDrawer, type DrawerMode } from '../components/StyleDrawer/StyleDrawer.tsx'
...
import { LaneSidePanel } from '../components/LaneSidePanel.tsx'
import { StyleSidePanel, type RightPanelMode } from '../components/PhraseStyleSidePanel.tsx'
```
Change to:
```typescript
import { LaneSidePanel } from '../components/LaneSidePanel.tsx'
import { GlobalStyleSidePanel, type RightPanelMode } from '../components/GlobalStyleSidePanel.tsx'
```

State (lines 53-54):
```typescript
const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null)
const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode | null>(null)
```
Change to:
```typescript
const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>({ type: 'global' })
```

JSX top-row wrapping (lines 686-719) — this is the exact section to convert to a 3-column flex row per RESEARCH.md "Outer layout change" (lines 298-330). Current:
```tsx
<div className="subtitles-page subtitles-page--preview" ref={containerRef}>
  <div className={`subtitles-page__top${previewCollapsed ? ' subtitles-page__top--collapsed' : ''}`} style={...}>
    <div className="subtitles-page__top-row">
      {!previewCollapsed && (
        <LaneSidePanel .../>
      )}
      <PreviewPanel .../>
      {!previewCollapsed && rightPanelMode !== null && (
        <StyleSidePanel mode={rightPanelMode} onClose={() => setRightPanelMode(null)} />
      )}
    </div>
    {!previewCollapsed && <div className="subtitles-page__top-controls">...</div>}
  </div>
  {!previewCollapsed && <div className="subtitles-page__resize-handle" .../>}
  <div className="subtitles-page__bottom" style={...}>...</div>
  <StyleDrawer mode={drawerMode} onClose={() => setDrawerMode(null)} />
  {projectId && <AutoSaveIndicator status={saveStatus} />}
</div>
```
Per D-13/D-14, `LaneSidePanel` must move OUT of the `!previewCollapsed` gate and out of `top-row` to become a permanent outer-level sibling (RESEARCH.md Pitfall 3, lines 256-268). `GlobalStyleSidePanel` similarly moves to outer level, replacing `StyleDrawer` at the bottom of the tree (line 959) AND replacing `StyleSidePanel` inside `top-row` (lines 713-718) — these become one component instance.

Toolbar "Global Styling" button removal (D-08) — exact lines to delete (818-824):
```tsx
<button
  className="subtitles-page__styling-btn"
  type="button"
  onClick={() => setDrawerMode({ type: 'global' })}
>
  Global Styling
</button>
```

Toolbar group boundaries for D-02 reorganization — existing buttons in `subtitles-page__top-controls` (lines 722-873) in current order: Go to subtitle (724-728), Undo/Redo (731-748), Save (750-759), Time Shift (761-790), Render/Download (792-816), [Global Styling — remove], Re-transcribe (826-831), Replace Video (833-850), Upload new (852-857). Wrap these in `<div className="subtitles-page__toolbar-group">` + `<div className="subtitles-page__toolbar-separator" />` per D-02 grouping: `[Undo/Redo][Save][Time Shift]` | `[Render/Download]` | `[Re-transcribe, Replace Video, Upload new]`. "Go to subtitle" placement is Claude's discretion per RESEARCH.md line 205 — recommend keeping with Undo/Redo group as a leading item.

Right panel `onClose`/edit-trigger call sites to update (lines 924, 935, 945-946): these already call `setRightPanelMode({ type: 'speaker'/'phrase', ... })` — no change needed, since `RightPanelMode` still accepts these variants. Only the panel's own close/back button changes to call `setRightPanelMode({ type: 'global' })` instead of `null`.

---

### `packages/frontend/src/pages/SubtitlesPage.css` (MODIFY — layout model change)

**Self-analog, current state** (lines 13-58):
```css
.subtitles-page--preview {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin: 0 auto;
  padding: 1rem 1.5rem;
  height: 100%;
  overflow: hidden;
}

.subtitles-page__top { display: flex; flex-direction: column; gap: 0.5rem; min-height: 0; overflow: hidden; }

.subtitles-page__top-row {
  position: relative;
  display: flex;
  justify-content: center;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
```

**Target** — `subtitles-page--preview` changes `flex-direction: column` → `flex-direction: row`; a new `.subtitles-page__center` wrapper (flex: 1, flex-column, min-width: 0) holds the old `.subtitles-page__top` + `.subtitles-page__resize-handle` + `.subtitles-page__bottom`. `.subtitles-page__top-row`'s `position: relative` / `justify-content: center` centering hack is removable once `LaneSidePanel`/`GlobalStyleSidePanel` are no longer absolutely positioned inside it — `PreviewPanel` becomes the sole child, or `top-row` is removed and `PreviewPanel` sits directly in `.subtitles-page__top`. Use RESEARCH.md "Outer layout change" (lines 298-330) as the exact target shape.

Toolbar button base pattern to reuse for `subtitles-page__toolbar-group`/`subtitles-page__toolbar-separator` — analog is existing `.subtitles-page__goto-btn` (lines 264-278):
```css
.subtitles-page__goto-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast);
}
.subtitles-page__goto-btn:hover {
  border-color: var(--color-accent-green);
  color: var(--color-text-primary);
}
```
This compact bordered-button style is the pattern to apply consistently across all D-03 "compact sizing" toolbar buttons.

---

### `packages/frontend/src/components/StageTabBar.tsx` / `.css` (MODIFY — cosmetic only)

**Self-analog, current state** — `StageTabBar.tsx` full file (47 lines) already implements active/suggested/hover states correctly (D-04 mostly satisfied). Only label strings may shorten (line 9: `'Text Edit View'` → `'Text Edit'`) and CSS padding/sizing polish in `StageTabBar.css` (lines 14-39):
```css
.stage-tab-bar__tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
  margin-bottom: -1px;
  transition: color var(--transition-fast), border-bottom-color var(--transition-fast);
}
.stage-tab-bar__tab--active {
  color: var(--color-text-primary);
  border-bottom-color: var(--color-accent-green);
  font-weight: 500;
}
```
No component logic changes — only tune padding/font-weight/opacity values per D-04 discretion.

---

### `packages/frontend/src/components/TextEditor/TextEditor.tsx` (MODIFY — button sizing only)

The "Upload SRT" button uses class `srt-import-btn` (line 635) and "Go to subtitle" lives in `SubtitlesPage.tsx` (already covered above, stays put per D-05). Apply the same compact bordered-button visual treatment as `.subtitles-page__goto-btn` (see excerpt above) to `.srt-import-btn` in `TextEditor.css`/inline styles — no analog file search needed beyond this cross-reference since both buttons should look visually consistent per D-05.

## Shared Patterns

### Collapsible Side Panel (BEM toggle + content)
**Source:** `packages/frontend/src/components/LaneSidePanel.tsx` (lines 29-40) and `LaneSidePanel.css` (lines 1-64)
**Apply to:** `GlobalStyleSidePanel.tsx`/`.css` (new right panel)
```tsx
<div className={`{prefix}${collapsed ? ' {prefix}--collapsed' : ''}`}>
  <button type="button" className="{prefix}__toggle" onClick={() => setCollapsed((c) => !c)}>
    <span>{label}</span>
    <span className="{prefix}__toggle-arrow">{collapsed ? '▶' : '◀'}</span>
  </button>
  <div className="{prefix}__content">{children}</div>
</div>
```

### Full-Height Flow Side Panel CSS (replaces position:absolute overlay)
**Source:** RESEARCH.md lines 391-404 (derived from `LaneSidePanel.css` lines 3-22)
**Apply to:** `LaneSidePanel.css`, `PhraseStyleSidePanel.css` / `GlobalStyleSidePanel.css`
```css
.{panel} {
  position: relative;
  flex-shrink: 0;
  width: 220px; /* 200-250px range per D-15 */
  height: 100%;
  z-index: auto;
  display: flex;
  flex-direction: column;
  ...
}
.{panel}--collapsed { width: 28px; }
```

### Mode-Discriminated Union State for Panel Content
**Source:** `packages/frontend/src/components/PhraseStyleSidePanel.tsx` (lines 5-7)
**Apply to:** `GlobalStyleSidePanel.tsx` — extend with `{ type: 'global' }` variant, conditionally render sub-panel by `mode.type`

### Compact Bordered Toolbar Button
**Source:** `packages/frontend/src/pages/SubtitlesPage.css` lines 264-278 (`.subtitles-page__goto-btn`)
**Apply to:** All toolbar buttons under D-03 compact sizing requirement, and `.srt-import-btn` in TextEditor per D-05

### Toolbar Group + Separator (new pattern, no existing analog — from RESEARCH.md)
**Source:** RESEARCH.md lines 407-422 (proposed, not yet in codebase)
**Apply to:** `subtitles-page__top-controls` restructure (D-01, D-02)
```css
.subtitles-page__toolbar-group { display: flex; align-items: center; gap: var(--spacing-xs); }
.subtitles-page__toolbar-separator { width: 1px; height: 20px; background: var(--color-border); flex-shrink: 0; align-self: center; }
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `subtitles-page__toolbar-group` / `subtitles-page__toolbar-separator` CSS classes | style utility | — | No existing grouped-toolbar-with-separators pattern in codebase; RESEARCH.md proposes the CSS from scratch (simple, low risk) |
| Three-column full-height flex layout at `.subtitles-page--preview` level | layout | — | No existing 3-column full-height panel layout elsewhere in the app; this is a novel layout composition (though built from two existing panel components) |

## Metadata

**Analog search scope:** `packages/frontend/src/pages/SubtitlesPage.tsx`, `packages/frontend/src/pages/SubtitlesPage.css`, `packages/frontend/src/components/LaneSidePanel.{tsx,css}`, `packages/frontend/src/components/PhraseStyleSidePanel.{tsx,css}`, `packages/frontend/src/components/StyleDrawer/StyleDrawer.{tsx,css}`, `packages/frontend/src/components/StageTabBar.{tsx,css}`, `packages/frontend/src/components/TextEditor/TextEditor.tsx`
**Files scanned:** 10
**Pattern extraction date:** 2026-07-02
