---
phase: 11-text-editor-enhancements
plan: "03"
subsystem: frontend-ui
tags: [react, find-replace, modal, bulk-actions, tdd, zustand]
dependency_graph:
  requires: [11-01, 11-02]
  provides: [FindReplaceBar, findMatches, applyReplacements, replaceAllPhraseTexts]
  affects:
    - packages/frontend/src/components/TextEditor/FindReplaceBar.tsx
    - packages/frontend/src/components/TextEditor/FindReplaceBar.css
    - packages/frontend/src/components/TextEditor/findReplace.ts
    - packages/frontend/src/components/TextEditor/findReplace.test.ts
    - packages/frontend/src/components/TextEditor/TextEditor.tsx
    - packages/frontend/src/components/TextEditor/TextEditor.css
    - packages/frontend/src/store/subtitleStore.ts
tech_stack:
  added: []
  patterns: [debounced-search, preview-modal, single-undo-bulk, regex-escape, highlightText-split]
key_files:
  created:
    - packages/frontend/src/components/TextEditor/FindReplaceBar.tsx
    - packages/frontend/src/components/TextEditor/FindReplaceBar.css
    - packages/frontend/src/components/TextEditor/findReplace.ts
    - packages/frontend/src/components/TextEditor/findReplace.test.ts
  modified:
    - packages/frontend/src/components/TextEditor/TextEditor.tsx
    - packages/frontend/src/components/TextEditor/TextEditor.css
    - packages/frontend/src/store/subtitleStore.ts
decisions:
  - findMatches is case-insensitive substring match using RegExp with gi flags — covers "the"/"THE"/"The" and "there" matching "the"
  - replaceAllPhraseTexts processes replacements in reverse phraseIndex order to keep global word offset computation accurate across iterations
  - highlightText splits on regex boundaries to render <mark> spans inline inside React nodes (not dangerouslySetInnerHTML)
  - Placeholder .find-replace-bar CSS removed from TextEditor.css — real styles live in FindReplaceBar.css
  - Match count uses singular "1 match" vs plural "N matches" per Copywriting Contract
metrics:
  duration: ~4min
  completed: 2026-03-28
---

# Phase 11 Plan 03: Find/Replace Bar Summary

**One-liner:** FindReplaceBar floating toolbar with 300ms debounced match counting, Replace All preview modal (before/after with highlighted terms), and replaceAllPhraseTexts bulk store action for single-undo replace.

## What Was Built

### Task 1: findReplace utility with TDD tests (findReplace.ts + findReplace.test.ts)

- **findMatches(phrases, findTerm, replaceTerm): FindReplaceMatch[]** — case-insensitive substring match over `SessionPhrase[]`; returns `{ phraseIndex, phraseText, replacedText }` for each matching phrase; empty findTerm returns `[]`
- **applyReplacements(matches): Array<{phraseIndex, newWords[]}>** — converts match results into store-ready replacement instructions splitting `replacedText` on whitespace
- **escapeRegex** — private helper to safely escape special characters in user-supplied find term before constructing RegExp
- **9 test cases** covering: substring match across multiple phrases, empty term, no match, correct phraseText/replacedText values, multi-occurrence within single phrase, case-insensitive matching (lowercase find on mixed-case), uppercase find on lowercase phrase, applyReplacements output shape, empty matches

### Task 2: FindReplaceBar component, preview modal, TextEditor wiring

**FindReplaceBar.tsx:**
- Floating sticky toolbar: "Find:" label + find input (autoFocus), "Replace:" label + replace input, match count badge, "Replace All" button, close (×) button
- Match count badge: "N match" / "N matches" / "No matches" (red when 0 and findTerm non-empty)
- 300ms debounce via `useEffect` + `setTimeout` on findTerm/replaceTerm changes
- Escape key on container `onKeyDown` → calls `onClose()`
- Replace All button disabled when 0 matches; opens preview modal when clicked

**Replace All Preview Modal:**
- Fixed overlay with `rgba(0,0,0,0.6)` backdrop; click-outside closes modal
- 520px wide modal, max-height 70vh, flex column layout
- Header: "Replace All Preview" (18px semibold) + close button
- Scrollable body: list of match rows showing line number, before text (find term in warning-tinted `<mark>`), → arrow, after text (replace term in green-muted `<mark>`)
- Footer note: "Note: Replacing text may redistribute word timestamps if word count changes." (italic)
- Footer buttons: "Dismiss Preview" (secondary) and "Confirm Replace All" (green primary)
- Confirm handler calls `applyReplacements(matches)` → `onReplace(replacements)` → `setShowPreview(false)`

**FindReplaceBar.css:**
- `find-replace-bar` sticky top with `find-replace-slide-down` animation (150ms ease)
- Input focus: `border-color: var(--color-accent-green)`
- Before `<mark>`: `color-mix(in srgb, var(--color-warning) 30%, transparent)`
- After `<mark>`: `color-mix(in srgb, var(--color-accent-green-muted) 60%, transparent)`
- Modal overlay, header, body, footer per UI-SPEC dimensions

**subtitleStore.ts — replaceAllPhraseTexts:**
- Single `pushUndo` before processing all replacements
- Processes replacements in reverse phraseIndex order to keep global word offsets accurate
- Applies same timestamp redistribution logic as `updatePhraseText` inline (same word count: preserve timestamps; different word count: redistribute evenly)
- Calls `buildSessionPhrases` once after all replacements applied

**TextEditor.tsx:**
- Imports `FindReplaceBar` and `replaceAllPhraseTexts`
- Replaces `{findReplaceOpen && <div className="find-replace-bar">Find/Replace placeholder</div>}` with real component
- `onReplace` callback calls `replaceAllPhraseTexts(replacements)` then `setFindReplaceOpen(false)`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: packages/frontend/src/components/TextEditor/findReplace.ts (findMatches, applyReplacements)
- FOUND: packages/frontend/src/components/TextEditor/findReplace.test.ts (9 test cases, 44 total tests passing)
- FOUND: packages/frontend/src/components/TextEditor/FindReplaceBar.tsx (Replace All Preview, Confirm Replace All, Dismiss Preview, findMatches import)
- FOUND: packages/frontend/src/components/TextEditor/FindReplaceBar.css (find-replace-bar selector)
- FOUND: packages/frontend/src/store/subtitleStore.ts replaceAllPhraseTexts (interface + implementation)
- FOUND: commit 6b5b3b1 (Task 1)
- FOUND: commit 99135e1 (Task 2)
- TypeScript: only pre-existing laneGap error in subtitleStore.ts, no new errors from this plan
- Tests: 44/44 passed (no regressions)
