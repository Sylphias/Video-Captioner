# Phase 11: Text Editor Enhancements - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Improve the text editing view with multi-select phrase joining, find-and-replace for mass word correction, full keyboard shortcuts, contextual bulk actions toolbar, and low-confidence word hints. All changes are within the TextEditor component and subtitleStore.

</domain>

<decisions>
## Implementation Decisions

### Phrase Joining UX
- **D-01:** Multi-select + merge — select multiple phrase rows, then merge into one via button or keyboard shortcut
- **D-02:** Selection via both checkboxes per row AND Shift+click range select
- **D-03:** Extends existing Backspace-at-start merge (which remains as a quick shortcut)

### Find and Replace
- **D-04:** Simple text find/replace — no regex support
- **D-05:** Floating toolbar at top of text editor (like VS Code's Ctrl+H), stays visible while scrolling
- **D-06:** Preview dialog showing all matches with before/after preview before Replace All applies
- **D-07:** Keyboard shortcut Ctrl+H to toggle find/replace bar

### Editing Workflow
- **D-08:** Full keyboard shortcut set:
  - Ctrl+H — toggle find/replace
  - Ctrl+A — select all phrases
  - Delete/Backspace — delete selected phrases
  - Ctrl+M — merge selected phrases
  - Ctrl+D — duplicate phrase
  - Ctrl+Shift+Up/Down — move phrases up/down
  - Tab/Shift+Tab — navigate between phrases
  - Arrow keys — move between phrases
- **D-09:** Contextual toolbar appears above text editor when 2+ phrases selected, showing: Merge, Delete, Reassign Speaker. Disappears when selection cleared.

### Correction Suggestions
- **D-10:** Simple word frequency hints — highlight low-confidence words from Whisper confidence scores (no AI/NLP)
- **D-11:** Subtle dotted underline on words with confidence < 0.7, hover shows confidence score

### Claude's Discretion
- Exact styling/colors of the find-replace toolbar and contextual toolbar
- Animation/transition of toolbar appearance
- Threshold for confidence underline (0.7 suggested but adjustable)
- Merge behavior when selected phrases have different speakers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Existing Code
- `packages/frontend/src/components/TextEditor/TextEditor.tsx` — Current text editor with contentEditable, split/merge/add actions
- `packages/frontend/src/components/TextEditor/TextEditor.css` — Current styling
- `packages/frontend/src/store/subtitleStore.ts` — Session state, undo system, splitPhrase/mergePhrase/updatePhraseText/deletePhrase actions
- `packages/frontend/src/lib/grouping.ts` — Word-to-phrase grouping, buildSessionPhrases
- `packages/shared-types/src/index.ts` — TranscriptWord (has `confidence` field for D-10/D-11)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `subtitleStore` already has `mergePhrase`, `splitPhrase`, `deletePhrase`, `updatePhraseText` — multi-select merge calls `mergePhrase` in sequence
- `TranscriptWord.confidence` field already exists (0.0-1.0) — ready for low-confidence highlighting
- Undo/redo system supports batching — bulk operations can push a single undo snapshot
- `reassignPhraseSpeaker` action exists — contextual toolbar can reuse it

### Established Patterns
- `contentEditable` divs with `onBlur` commit and `onKeyDown` for split/merge
- Line-numbered rows with speaker indicator dots
- Store actions follow pushUndo → mutate → rebuild pattern

### Integration Points
- TextEditor.tsx is the only file rendering phrase text — all changes are here
- Find-replace toolbar renders above the phrase list within TextEditor
- Contextual toolbar renders conditionally based on selection state
- Low-confidence underlines render within the contentEditable phrase text

</code_context>

<specifics>
## Specific Ideas

- Find-and-replace should feel like VS Code's Ctrl+H — familiar to developers
- Multi-select should support both discoverable (checkboxes) and power-user (Shift+click) workflows
- Low-confidence hints are informational only — they don't auto-correct anything

</specifics>

<deferred>
## Deferred Ideas

- Custom correction dictionary (auto-apply common fixes like 'gonna' → 'going to') — could be its own phase
- AI-powered correction suggestions — too complex for this scope
- Regex find-and-replace — not needed for the primary use case

</deferred>

---

*Phase: 11-text-editor-enhancements*
*Context gathered: 2026-03-28*
