# Phase 12: UI/UX Layout Improvements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 12-ui-ux-layout-improvements
**Areas discussed:** Toolbar reorganization, Global Styling placement, Style drawer behavior, Panel layout strategy, Stage tabs, Text editor buttons

---

## Toolbar Reorganization

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped button bar | Group by function with visual separators, icon buttons for compact controls | ✓ |
| Compact icon toolbar | All buttons become small icon-only with tooltips | |
| Overflow menu | Primary actions visible, secondary in overflow menu | |

**User's choice:** Grouped button bar
**Notes:** None

### Toolbar Position

| Option | Description | Selected |
|--------|-------------|----------|
| Keep between preview & editor | Current position, just make more compact and organized | ✓ |
| Move into a side panel | Render/Re-transcribe/Replace go into right-side action panel | |
| Split: common inline, rare in menu bar | Undo/Redo/Save inline, others in header | |

**User's choice:** Keep between preview & editor
**Notes:** None

---

## Stage Tabs

| Option | Description | Selected |
|--------|-------------|----------|
| Style as proper tabs | Proper tab appearance — active highlighted, inactive muted, consistent sizing | ✓ |
| Style as pill/segment buttons | Rounded pill-style segmented control | |
| You decide | Claude picks best approach | |

**User's choice:** Style as proper tabs
**Notes:** None

---

## Text Editor Buttons

| Option | Description | Selected |
|--------|-------------|----------|
| Compact inline buttons | Keep in text editor area, make smaller, styled consistently | ✓ |
| Move to toolbar | Move Upload SRT and Go to subtitle to main toolbar | |
| Move SRT to overflow, keep Go to subtitle | SRT rarely used — overflow it | |

**User's choice:** Compact inline buttons
**Notes:** None

---

## Global Styling Placement

**User's choice:** Right panel — always visible. Shows Global Style by default, swaps to Phrase/Speaker/Word overrides when selected. Close button on override returns to Global.
**Notes:** User clarified before options were presented that Global Style should take the right drawer, with phrase/speaker/word overrides replacing the content when selected.

### Back to Global

| Option | Description | Selected |
|--------|-------------|----------|
| Close button on override view | Override panel has × or 'Back to Global' button | ✓ |
| Click away / deselect | Clicking outside deselects and returns to Global | |
| Both | Close button AND clicking away both work | |

**User's choice:** Close button on override view
**Notes:** None

---

## Panel Layout Strategy

### Panel Span

| Option | Description | Selected |
|--------|-------------|----------|
| Full height | Side panels span full page height, editor sits between them | ✓ |
| Top section only | Side panels only flank preview, editor gets full width below | |

**User's choice:** Full height
**Notes:** None

### Lane Panel Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| All stages | Lane panel always visible regardless of active stage | ✓ |
| Text Edit + Word Timing only | Hide during Animation stage | |
| Text Edit only | Only during Text Edit stage | |

**User's choice:** All stages
**Notes:** User confirmed: "we do need the lane options for all 3"

### Panel Width

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed width | Both panels ~200-250px, collapsible but not resizable | ✓ |
| Resizable with drag handle | Users can drag panel edges to resize | |
| You decide | Claude picks | |

**User's choice:** Fixed width
**Notes:** None

---

## Claude's Discretion

- Exact pixel widths for side panels
- Visual separator style between toolbar button groups
- Tab styling details
- Compact button sizing and spacing

## Deferred Ideas

None — discussion stayed within phase scope
