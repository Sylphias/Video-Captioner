---
phase: 11-text-editor-enhancements
plan: "02"
subsystem: frontend-ui
tags: [react, multi-select, keyboard-shortcuts, confidence-underline, bulk-actions]
dependency_graph:
  requires: [11-01]
  provides: [selectedPhraseIndices, BulkActionsToolbar, handleEditorKeyDown, CONFIDENCE_THRESHOLD]
  affects:
    - packages/frontend/src/components/TextEditor/TextEditor.tsx
    - packages/frontend/src/components/TextEditor/TextEditor.css
    - packages/frontend/src/components/TextEditor/BulkActionsToolbar.tsx
    - packages/frontend/src/components/TextEditor/BulkActionsToolbar.css
tech_stack:
  added: []
  patterns: [controlled-checkbox, contenteditable-keyboard-nav, click-outside-dismiss, confidence-threshold-span]
key_files:
  created:
    - packages/frontend/src/components/TextEditor/BulkActionsToolbar.tsx
    - packages/frontend/src/components/TextEditor/BulkActionsToolbar.css
  modified:
    - packages/frontend/src/components/TextEditor/TextEditor.tsx
    - packages/frontend/src/components/TextEditor/TextEditor.css
decisions:
  - BulkActionsToolbar hidden when confirmDeleteCount is active to avoid overlapping toolbars
  - Checkbox opacity:0 (not display:none) when no selection to prevent layout shift in flex row
  - Speaker dropdown uses mousedown listener (not click) for click-outside dismiss to avoid event ordering issues
  - Row click handler checks contentEditable ancestry before toggling selection to prevent conflicts with text editing
  - findReplaceOpen state scoped to TextEditor (not Zustand) — transient UI state, no cross-component sharing needed
metrics:
  duration: ~4min
  completed: 2026-03-28
---

# Phase 11 Plan 02: Multi-Select UI, Keyboard Shortcuts, and Confidence Underlines Summary

**One-liner:** Multi-select with checkboxes, Shift+click range select, BulkActionsToolbar (merge/delete/reassign), full D-08 keyboard shortcut set, and low-confidence word dotted underlines with tooltip.

## What Was Built

### Task 1: Multi-select state, keyboard shortcuts, and confidence underlines (TextEditor.tsx + TextEditor.css)

- **selectedPhraseIndices** — `Set<number>` local React state tracking selected phrase indices
- **lastClickedIndex** — anchors Shift+click range selection
- **Checkboxes per row** — 16x16px native checkbox with `accent-color: var(--color-accent-green)`; opacity:0 when no selection (space always reserved)
- **Shift+click range select** — clicking any part of a row (not contentEditable) with Shift held range-selects from anchor to target
- **handleEditorKeyDown** on outer `.text-editor` div — all shortcuts guarded with `!inContentEditable` where needed:
  - Ctrl+H — toggle find/replace (findReplaceOpen state, Plan 03 placeholder)
  - Ctrl+A — select all phrases
  - Ctrl+M — merge selected (2+ required)
  - Delete/Backspace — delete selected (inline confirmation if >3)
  - Ctrl+D — duplicate single selected phrase
  - Ctrl+Shift+Up/Down — move selected phrases, update indices
  - ArrowUp/Down in contentEditable at line boundary — navigate to prev/next phrase
  - Tab/Shift+Tab — navigate between contentEditables
  - Escape — clear selection + close find/replace
- **CONFIDENCE_THRESHOLD = 0.7** — words below threshold rendered as `<span class="text-editor__word--low-confidence">` with dotted warning-color underline and `title="Confidence: N%"` tooltip
- **confirmDeleteCount state** — when >3 phrases targeted for delete, inline bar shows "Delete N phrases?" with confirm/dismiss buttons
- **findReplaceOpen placeholder** — `<div class="find-replace-bar">Find/Replace placeholder</div>` rendered when open; Plan 03 replaces with FindReplaceBar component

### Task 2: BulkActionsToolbar component (BulkActionsToolbar.tsx + BulkActionsToolbar.css)

- **BulkActionsToolbar** — renders above phrase list when `selectedPhraseIndices.size >= 2` and `confirmDeleteCount === null`
- Elements: count label, separator, Merge Phrases button (disabled when count < 2), Delete Phrases button (destructive hover), Reassign Speaker dropdown, keyboard hint (margin-left: auto)
- **Speaker dropdown** — `<ul>` positioned absolute below button; each `<li>` fires `onReassignSpeaker(speakerId)` and closes dropdown; click-outside dismisses via mousedown listener
- Appearance: `opacity 0 → 1` via CSS `@keyframes bulk-toolbar-appear` over 100ms; no exit animation
- Wired into TextEditor.tsx with all three action callbacks using `mergePhrases`, `deletePhrases`, `reassignPhraseSpeaker` from store

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- **findReplaceOpen + `.find-replace-bar` placeholder** — intentional stub for Plan 03. The `findReplaceOpen` state is wired and Ctrl+H toggles it. Plan 03 will replace the placeholder div with the full `FindReplaceBar` component.

## Self-Check: PASSED

- FOUND: packages/frontend/src/components/TextEditor/TextEditor.tsx (selectedPhraseIndices, CONFIDENCE_THRESHOLD, handleEditorKeyDown, BulkActionsToolbar import+usage)
- FOUND: packages/frontend/src/components/TextEditor/TextEditor.css (.text-editor__line--selected, .text-editor__word--low-confidence, .text-editor__delete-confirm)
- FOUND: packages/frontend/src/components/TextEditor/BulkActionsToolbar.tsx (Merge Phrases, Delete Phrases, Reassign Speaker)
- FOUND: packages/frontend/src/components/TextEditor/BulkActionsToolbar.css (.bulk-actions-toolbar)
- FOUND: commit 7e0cc4d (Task 1)
- FOUND: commit ae3f1f8 (Task 2)
- TypeScript: only pre-existing laneGap error in subtitleStore.ts, no new errors
- Tests: 35/35 passed (no regressions)
