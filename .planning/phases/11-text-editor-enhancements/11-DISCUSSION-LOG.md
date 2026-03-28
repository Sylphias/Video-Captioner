# Phase 11: Text Editor Enhancements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 11-text-editor-enhancements
**Areas discussed:** Phrase joining UX, Find and replace, Editing workflow, Correction suggestions

---

## Phrase Joining UX

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-select + merge | Click/Shift+click to select, then merge button or shortcut | ✓ |
| Drag to reorder/merge | Drag rows to reorder, drop to merge | |
| Keep current only | Backspace-at-start is sufficient | |

**User's choice:** Multi-select + merge

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox per row | Each row gets a checkbox, bulk actions toolbar | |
| Shift+click range select | Click one, Shift+click another for range | |
| Both | Checkboxes + Shift+click | ✓ |

**User's choice:** Both

---

## Find and Replace

| Option | Description | Selected |
|--------|-------------|----------|
| Simple text find/replace | Toolbar with Find/Replace fields, highlight matches | ✓ |
| Regex-capable | Support regex patterns for power users | |
| You decide | Claude picks complexity level | |

**User's choice:** Simple text find/replace

| Option | Description | Selected |
|--------|-------------|----------|
| Highlight matches inline | Matches highlighted as you type, Replace All immediate | |
| Preview dialog | List all matches with before/after before applying | ✓ |
| Both | Highlight + optional preview | |

**User's choice:** Preview dialog

| Option | Description | Selected |
|--------|-------------|----------|
| Floating toolbar at top | Slim bar at top of text editor (like VS Code Ctrl+H) | ✓ |
| Side panel | Panel on right side | |
| You decide | Claude picks placement | |

**User's choice:** Floating toolbar at top

---

## Editing Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Essential set | Ctrl+H, Ctrl+A, Delete, Ctrl+M, Arrow keys | |
| Full editor shortcuts | All essential + Ctrl+D, Ctrl+Shift+Up/Down, Tab/Shift+Tab | ✓ |
| You decide | Claude picks set | |

**User's choice:** Full editor shortcuts

| Option | Description | Selected |
|--------|-------------|----------|
| Contextual toolbar | Slim bar when 2+ selected: Merge, Delete, Reassign Speaker | ✓ |
| Right-click context menu | Context menu on right-click | |
| Both | Toolbar + context menu | |

**User's choice:** Contextual toolbar

---

## Correction Suggestions

| Option | Description | Selected |
|--------|-------------|----------|
| Not in this phase | Focus on manual tools, defer auto-suggestions | |
| Simple word frequency hints | Highlight low-confidence words from Whisper scores | ✓ |
| Custom dictionary | User-built correction list | |

**User's choice:** Simple word frequency hints

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle underline | Dotted underline on confidence < 0.7, hover shows score | ✓ |
| Color-coded text | Different text color for low-confidence | |
| You decide | Claude picks treatment | |

**User's choice:** Subtle underline

---

## Claude's Discretion

- Styling of find-replace and contextual toolbars
- Merge behavior for mixed-speaker selections
- Confidence threshold (0.7 suggested)

## Deferred Ideas

- Custom correction dictionary — could be its own phase
- AI-powered correction suggestions
- Regex find-and-replace
