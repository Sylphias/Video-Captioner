# Phase 11: Text Editor Enhancements - Research

**Researched:** 2026-03-28
**Domain:** React contentEditable editor, keyboard shortcuts, text search/replace, confidence-based rendering
**Confidence:** HIGH — all decisions reference existing code that was read directly; no external libraries needed

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Multi-select + merge — select multiple phrase rows, then merge into one via button or keyboard shortcut
- **D-02:** Selection via both checkboxes per row AND Shift+click range select
- **D-03:** Extends existing Backspace-at-start merge (which remains as a quick shortcut)
- **D-04:** Simple text find/replace — no regex support
- **D-05:** Floating toolbar at top of text editor (like VS Code's Ctrl+H), stays visible while scrolling
- **D-06:** Preview dialog showing all matches with before/after preview before Replace All applies
- **D-07:** Keyboard shortcut Ctrl+H to toggle find/replace bar
- **D-08:** Full keyboard shortcut set: Ctrl+H (find/replace), Ctrl+A (select all phrases), Delete/Backspace (delete selected), Ctrl+M (merge selected), Ctrl+D (duplicate phrase), Ctrl+Shift+Up/Down (move phrases up/down), Tab/Shift+Tab (navigate between phrases), Arrow keys (move between phrases)
- **D-09:** Contextual toolbar appears above text editor when 2+ phrases selected, showing Merge, Delete, Reassign Speaker — disappears when selection cleared
- **D-10:** Simple word frequency hints — highlight low-confidence words from Whisper confidence scores (no AI/NLP)
- **D-11:** Subtle dotted underline on words with confidence < 0.7 (adjustable), hover shows confidence score

### Claude's Discretion

- Exact styling/colors of the find-replace toolbar and contextual toolbar
- Animation/transition of toolbar appearance
- Threshold for confidence underline (0.7 suggested but adjustable)
- Merge behavior when selected phrases have different speakers

### Deferred Ideas (OUT OF SCOPE)

- Custom correction dictionary (auto-apply common fixes like 'gonna' → 'going to')
- AI-powered correction suggestions
- Regex find-and-replace
</user_constraints>

---

## Summary

Phase 11 is a pure frontend enhancement to `TextEditor.tsx` and `subtitleStore.ts`. No new backend routes, no new packages, no database changes. The codebase already has all the primitives needed: `mergePhrase`, `deletePhrase`, `reassignPhraseSpeaker` in the store, `TranscriptWord.confidence` in the data model, and a working undo system that supports single-snapshot batching.

The three pillars are: (1) multi-select state layer that drives the contextual toolbar, (2) a find/replace toolbar component that operates over the phrase list in memory, and (3) confidence-score rendering in the `contentEditable` phrase text. Each pillar is independently shippable in its own plan wave.

The primary complexity is managing selection state correctly while coexisting with the existing `contentEditable` text editing. Selection must track phrase indices (not DOM), and keyboard shortcuts need to be scoped so they do not fire while a phrase text div has focus.

**Primary recommendation:** Build selection state as local React `useState` (not Zustand), since it is transient UI state. Implement store-level `mergePhrases(indices: number[])` and `deletePhrases(indices: number[])` as new bulk actions to ensure correct undo batching.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.3.1 | UI rendering | Project standard |
| TypeScript | 5.4.0 | Type safety | Project standard |
| Zustand | existing | Store for subtitleStore | Project standard |

### No New Dependencies
All Phase 11 features are implemented with existing project dependencies. No `npm install` required.

**Rationale:**
- Multi-select: plain React `useState<Set<number>>`
- Find/replace: `String.prototype.replaceAll()` — native, no library needed
- Confidence underlines: CSS `text-decoration` on `<span>` elements inside the phrase text
- Keyboard shortcuts: `onKeyDown` / `useEffect` on `document` — no library needed

---

## Architecture Patterns

### Recommended File Structure

```
packages/frontend/src/components/TextEditor/
├── TextEditor.tsx            # existing — receives selection state, shortcuts, renders rows
├── TextEditor.css            # existing — add selection, toolbar, underline styles
├── FindReplaceBar.tsx        # new — floating find/replace toolbar (D-04 through D-07)
├── FindReplaceBar.css        # new — toolbar styling
├── BulkActionsToolbar.tsx    # new — contextual toolbar shown when 2+ selected (D-09)
└── BulkActionsToolbar.css    # new — toolbar styling
```

Store additions are in `subtitleStore.ts` only — no new store file needed.

### Pattern 1: Selection State (Local React State, Not Zustand)

Selection is transient UI state — it does not need to survive unmount or be shared across components. Keep it in TextEditor as `useState<Set<number>>`.

```typescript
// In TextEditor.tsx
const [selectedPhraseIndices, setSelectedPhraseIndices] = useState<Set<number>>(new Set())
const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)
```

**Shift+click range select:**
```typescript
const handleRowClick = (phraseIndex: number, e: React.MouseEvent) => {
  if (e.shiftKey && lastClickedIndex !== null) {
    const lo = Math.min(lastClickedIndex, phraseIndex)
    const hi = Math.max(lastClickedIndex, phraseIndex)
    setSelectedPhraseIndices(prev => {
      const next = new Set(prev)
      for (let i = lo; i <= hi; i++) next.add(i)
      return next
    })
  } else {
    setLastClickedIndex(phraseIndex)
    setSelectedPhraseIndices(prev => {
      const next = new Set(prev)
      if (next.has(phraseIndex)) next.delete(phraseIndex)
      else next.add(phraseIndex)
      return next
    })
  }
}
```

### Pattern 2: Bulk Store Actions

The existing `mergePhrase(phraseIndex)` merges phraseIndex with phraseIndex+1 sequentially. For bulk merge, a new `mergePhrases(indices: number[])` must push ONE undo snapshot before merging the whole selection.

```typescript
// In subtitleStore.ts — new action
mergePhrases: (indices: number[]) => {
  set((state) => {
    if (!state.session || indices.length < 2) return state
    pushUndo(state)

    const sorted = [...new Set(indices)].sort((a, b) => a - b)
    // Merge all words from selected phrases into the first selected phrase
    const mergedWords = sorted.flatMap(i => state.session!.phrases[i].words)
    const firstPhrase = state.session.phrases[sorted[0]]
    const merged: SessionPhrase = {
      words: mergedWords,
      isManualSplit: firstPhrase.isManualSplit,
      dominantSpeaker: computeDominantSpeaker(mergedWords),
    }

    const phrases = state.session.phrases.filter((_, i) => !sorted.includes(i) || i === sorted[0])
    phrases[sorted[0]] = merged

    // Remove manual split indices that fell inside merged ranges
    const manualSplitWordIndices = new Set(state.session.manualSplitWordIndices)
    // ... (recalculate based on new phrase boundaries)

    return { session: { ...state.session, phrases, manualSplitWordIndices } }
  })
}

// In subtitleStore.ts — new action
deletePhrases: (indices: number[]) => {
  set((state) => {
    if (!state.session) return state
    pushUndo(state)
    const sorted = [...new Set(indices)].sort((a, b) => b - a) // reverse order
    let phrases = [...state.session.phrases]
    let words = [...state.session.words]
    const manualSplitWordIndices = new Set(state.session.manualSplitWordIndices)

    for (const idx of sorted) {
      const phrase = phrases[idx]
      if (!phrase) continue
      // Don't allow deleting if it leaves zero words
      const totalWords = phrases.reduce((n, p) => n + p.words.length, 0)
      if (totalWords - phrase.words.length === 0) continue
      // Remove words (reuse deletePhrase logic)
      phrases.splice(idx, 1)
    }

    return { session: { ...state.session, phrases, words, manualSplitWordIndices } }
  })
}
```

**IMPORTANT:** Implement `mergePhrases` and `deletePhrases` properly to push a single `pushUndo` snapshot — NOT calling `mergePhrase`/`deletePhrase` in a loop (each loop call would push separate undo snapshots, making Ctrl+Z undo them one at a time).

### Pattern 3: Keyboard Shortcut Scope

Global shortcuts (Ctrl+H, Ctrl+A, Ctrl+M, Delete, etc.) must fire on the TextEditor container, not on document — to avoid interfering with other editor views.

```typescript
// Attach to the outer .text-editor div, not document
<div
  className="text-editor"
  onKeyDown={handleEditorKeyDown}
  tabIndex={-1}  // makes div focusable to receive key events when not in a phrase
>
```

**Pitfall:** When a `contentEditable` phrase div is focused, `onKeyDown` bubbles up to the container. Must check `e.target` to distinguish "shortcut while typing" from "shortcut while navigating".

```typescript
const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
  const inContentEditable = (e.target as HTMLElement).contentEditable === 'true'

  if (e.ctrlKey && e.key === 'h') {
    e.preventDefault()
    setFindReplaceOpen(prev => !prev)
  }
  if (e.ctrlKey && e.key === 'a' && !inContentEditable) {
    e.preventDefault()
    setSelectedPhraseIndices(new Set(session.phrases.map((_, i) => i)))
  }
  if (e.ctrlKey && e.key === 'm' && selectedPhraseIndices.size >= 2 && !inContentEditable) {
    e.preventDefault()
    mergePhrases([...selectedPhraseIndices])
    setSelectedPhraseIndices(new Set())
  }
  // etc.
}
```

### Pattern 4: Find/Replace Bar

The `FindReplaceBar` component operates entirely in memory over the phrase list — no DOM mutation. It produces a replacement plan and shows a preview modal.

```typescript
interface FindReplaceMatch {
  phraseIndex: number
  phraseText: string    // current text
  replacedText: string  // text after replacement
}

function findMatches(phrases: SessionPhrase[], findTerm: string, replaceTerm: string): FindReplaceMatch[] {
  if (!findTerm) return []
  return phrases.reduce<FindReplaceMatch[]>((acc, phrase, i) => {
    const text = phrase.words.map(w => w.word).join(' ')
    if (text.includes(findTerm)) {
      acc.push({ phraseIndex: i, phraseText: text, replacedText: text.replaceAll(findTerm, replaceTerm) })
    }
    return acc
  }, [])
}
```

Replace All applies via a single `pushUndo` followed by `updatePhraseText` for each match.

**Important:** `updatePhraseText` already handles word count differences by redistributing timestamps. The find/replace can call it directly after computing the new word array.

### Pattern 5: Confidence-Score Underline Rendering

The `contentEditable` div currently renders plain text. For confidence underlines, the content must be rendered as HTML with `<span>` elements wrapping low-confidence words.

**Approach:** Replace the plain `{phraseText}` child with dangerouslySetInnerHTML, or change the contentEditable to render child `<span>` elements.

Using `dangerouslySetInnerHTML` with contentEditable is a known React anti-pattern — React loses control of the DOM. The standard approach for rich contentEditable is to render child nodes (React elements) directly.

```typescript
// Instead of:
<div contentEditable>{phraseText}</div>

// Render word spans:
<div contentEditable suppressContentEditableWarning>
  {phrase.words.map((word, wi) => {
    const isLowConfidence = word.confidence < confidenceThreshold
    return (
      <span
        key={wi}
        className={isLowConfidence ? 'text-editor__word--low-confidence' : undefined}
        title={isLowConfidence ? `Confidence: ${Math.round(word.confidence * 100)}%` : undefined}
      >
        {word.word}{wi < phrase.words.length - 1 ? ' ' : ''}
      </span>
    )
  })}
</div>
```

**Critical caveat:** When `contentEditable` renders child elements (not just a text node), the `onBlur` handler's `el.innerText` will still capture the full text — that behavior is unchanged. However, React will try to reconcile children on re-render, which can conflict with the user's in-progress editing. The standard mitigation is using a `key` prop to force remount only when text commits (on blur), not during active typing.

```typescript
// The contentEditable div gets a key based on the committed phrase text.
// While the user types, the inner spans don't reconcile.
<div
  key={phraseText}  // force remount when committed text changes externally
  contentEditable
  suppressContentEditableWarning
  ...
>
```

### Pattern 6: Contextual Bulk Actions Toolbar (D-09)

```typescript
// BulkActionsToolbar.tsx — renders conditionally above the phrase list
{selectedPhraseIndices.size >= 2 && (
  <BulkActionsToolbar
    count={selectedPhraseIndices.size}
    speakerIds={Object.keys(speakerNames)}
    speakerNames={speakerNames}
    onMerge={() => { mergePhrases([...selectedPhraseIndices]); clearSelection() }}
    onDelete={() => { deletePhrases([...selectedPhraseIndices]); clearSelection() }}
    onReassignSpeaker={(speakerId) => {
      for (const idx of selectedPhraseIndices) reassignPhraseSpeaker(idx, speakerId)
      clearSelection()
    }}
  />
)}
```

The toolbar uses `position: sticky; top: 0` within the scrollable text editor so it stays visible. Alternatively, render it outside the scroll container (above the phrase list). The CONTEXT specifies it "appears above the text editor" — outside the scroll area is correct.

### Anti-Patterns to Avoid

- **Do not call bulk operations in a loop over individual store actions:** Each individual store action pushes its own undo snapshot. Calling `mergePhrase` 5 times creates 5 undo steps. Use new bulk actions (`mergePhrases`, `deletePhrases`) that push one snapshot.
- **Do not put selection state in Zustand:** It's transient UI state — no persistence benefit, adds unnecessary coupling.
- **Do not use `dangerouslySetInnerHTML` with `contentEditable`:** React's reconciler and the browser's contentEditable DOM management conflict. Use child element nodes instead.
- **Do not let keyboard shortcuts fire inside contentEditable:** Always check `e.target.contentEditable === 'true'` before acting on non-typing shortcuts.
- **Do not trigger React reconciliation mid-edit:** The `key={phraseText}` pattern ensures the span tree rebuilds only on committed text, not during active typing.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip on hover | Custom tooltip component | CSS `title` attribute on `<span>` | Confidence score tooltip is purely informational; native title is sufficient; no library needed |
| Sticky toolbar | Custom scroll listener | `position: sticky; top: 0` CSS | CSS handles this correctly in all modern browsers |
| Text search | Custom string search | `String.prototype.includes` + `replaceAll` | No regex needed; native APIs are sufficient |
| Undo for bulk ops | Multiple individual snapshots | New bulk store actions with single `pushUndo` | Preserves single-step undo UX |

---

## Common Pitfalls

### Pitfall 1: Multiple Undo Snapshots from Bulk Operations
**What goes wrong:** Calling `deletePhrase(i)` in a loop for each selected phrase pushes N undo snapshots. User presses Ctrl+Z once, only one phrase restores. Subsequent Ctrl+Z restores one at a time.
**Why it happens:** Every store action calls `pushUndo(state)` before mutating.
**How to avoid:** Implement `deletePhrases(indices[])` as a single action that calls `pushUndo` once, then removes all selected phrases in one `set()` call.
**Warning signs:** Undo restores fewer phrases than were deleted.

### Pitfall 2: React Reconciling contentEditable Child Spans Mid-Edit
**What goes wrong:** User is actively typing inside a phrase. React re-renders (e.g., due to confidence threshold state change elsewhere) and reconciles the `<span>` children. The cursor position resets to the start of the div, or text is duplicated.
**Why it happens:** React's virtual DOM diffing replaces the browser-managed contentEditable DOM.
**How to avoid:** Use `key={committedPhraseText}` on the contentEditable div so React only remounts it when the committed text changes — not during active editing. Alternatively, use `shouldComponentUpdate`/`memo` that always returns false for the editable div while focused.
**Warning signs:** Cursor jumps while typing, especially when confidence scores would change the rendered spans.

### Pitfall 3: Keyboard Shortcuts Firing While Typing
**What goes wrong:** User types "delete" in a phrase, and the Delete key triggers `deletePhrases` on selected phrases.
**Why it happens:** `onKeyDown` on the container receives bubbled events from contentEditable children.
**How to avoid:** In `handleEditorKeyDown`, always check `(e.target as HTMLElement).contentEditable === 'true'` and return early for non-editor shortcuts (Ctrl+M, Delete, etc.) when the user is in an editable field.
**Warning signs:** Deletion or merging happens unexpectedly while editing text.

### Pitfall 4: Ctrl+A Selecting All Page Text Instead of All Phrases
**What goes wrong:** Ctrl+A in the browser selects all text on the page.
**Why it happens:** Ctrl+A is a built-in browser shortcut for text selection.
**How to avoid:** `e.preventDefault()` in the handler when NOT in a contentEditable. When the user IS in a contentEditable, allow the default (select all text in that div).
**Warning signs:** Page text turns blue when pressing Ctrl+A in the text editor.

### Pitfall 5: Find/Replace Losing Word Timestamps
**What goes wrong:** After a find/replace, phrases have wrong timing — words don't align with the audio.
**Why it happens:** `updatePhraseText` redistributes timestamps when word count changes.
**Why this is acceptable:** The existing `updatePhraseText` behavior is intentional — if the user replaces "going to" with "gonna", the word count changes. Timestamps are redistributed evenly, which is the same behavior as manual text editing.
**Warning signs:** None — this is expected behavior. Document it in the find/replace preview dialog: "Replacing text may redistribute word timestamps."

### Pitfall 6: Merge Behavior with Different Speakers
**What goes wrong:** Merging phrases from SPEAKER_00 and SPEAKER_01 — which speaker does the merged phrase get?
**How to handle:** Use the existing `computeDominantSpeaker(mergedWords)` function. It already handles this case by majority word count with tie-breaking by first word. Document this in the merge preview (show the resulting speaker in the contextual toolbar).

### Pitfall 7: Shift+Click Range Select Index Drift After Merge/Delete
**What goes wrong:** User selects phrases 2-5 via Shift+click. After a merge, the phrase indices shift. The stored selection indices now refer to wrong phrases.
**How to avoid:** After any bulk operation (merge, delete), always call `clearSelection()` immediately.
**Warning signs:** Wrong phrases highlighted after a bulk action completes.

---

## Code Examples

### Existing mergePhrase (single) — reference for implementing mergePhrases (bulk)
The existing `mergePhrase(phraseIndex)` at line 264 of `subtitleStore.ts` merges `phraseIndex` with `phraseIndex+1`. The new `mergePhrases(indices[])` must:
1. Sort indices ascending
2. Collect all words from all selected phrases
3. Build a single merged `SessionPhrase`
4. Remove all selected phrases from the array except the first
5. Place the merged phrase at the first selected index
6. Clean up `manualSplitWordIndices` for all removed boundaries
7. Push a single `pushUndo` before step 1

### Existing deletePhrase — reference for implementing deletePhrases (bulk)
`deletePhrase(phraseIndex)` at line 727 removes phrase words from the flat `words` array and rebuilds phrases. For `deletePhrases(indices[])`, process in reverse sorted order so earlier indices stay valid.

### CSS for confidence underline
```css
/* In TextEditor.css */
.text-editor__word--low-confidence {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: var(--color-warning); /* #d4a047 */
  cursor: help;
}
```

### CSS for find/replace bar
```css
/* Sticky bar above the scroll area */
.find-replace-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-bg-elevated);
  border-bottom: 1px solid var(--color-border);
  border-radius: 4px 4px 0 0;
}

.find-replace-bar input {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  outline: none;
}

.find-replace-bar input:focus {
  border-color: var(--color-accent-green);
}
```

### CSS for selection state on rows
```css
.text-editor__line--selected {
  background: color-mix(in srgb, var(--color-accent-green-muted) 50%, transparent);
  border-radius: 4px;
}

/* Checkbox in row gutter */
.text-editor__line-checkbox {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent-green);
  cursor: pointer;
}
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vite.config.ts (vitest inline config) |
| Quick run command | `cd packages/frontend && npm run test` |
| Full suite command | `cd packages/frontend && npm run test` |

### Phase Requirements → Test Map

Phase 11 has no formal requirement IDs (TBD per REQUIREMENTS.md). The functional behaviors map to:

| Behavior | Test Type | Automated Command | Note |
|----------|-----------|-------------------|------|
| `mergePhrases([0,1,2])` produces single phrase with all words | unit | `npm run test` | Test store action directly |
| `deletePhrases([1,3])` removes correct phrases, leaves others | unit | `npm run test` | Test store action directly |
| Find/replace match counting returns correct matches | unit | `npm run test` | Pure function, no DOM |
| Find/replace preview shows before/after correctly | unit | `npm run test` | Pure function |
| Single undo snapshot for bulk merge | unit | `npm run test` | Check undo stack depth after merge |
| Confidence underline threshold filtering | unit | `npm run test` | Pure filter logic |
| Keyboard shortcut Ctrl+H, Ctrl+A | manual | — | Requires browser interaction |
| Contextual toolbar visibility at 2+ selected | manual | — | Requires browser interaction |

### Wave 0 Gaps
- [ ] `packages/frontend/src/store/subtitleStore.test.ts` — covers bulk store actions (`mergePhrases`, `deletePhrases`) and undo snapshot counting
- [ ] `packages/frontend/src/components/TextEditor/findReplace.test.ts` — covers `findMatches`, match counting, preview generation

*(Existing test infrastructure: `npm run test` in frontend package runs Vitest. No config changes needed.)*

---

## Environment Availability

Step 2.6: SKIPPED — Phase 11 is purely frontend code/config changes. No external dependencies beyond the already-verified Node 22 runtime and existing frontend toolchain.

---

## Open Questions

1. **Confidence threshold — const or user-adjustable in UI?**
   - What we know: D-11 says "0.7 suggested but adjustable" — left to Claude's discretion
   - What's unclear: Should the threshold be a CSS variable + config constant, or exposed as a UI slider in the text editor?
   - Recommendation: Start as a TypeScript constant `CONFIDENCE_THRESHOLD = 0.7` at the top of TextEditor.tsx. Adding a UI control is a quick follow-up if the user wants it. Keep it out of scope for Phase 11 to avoid scope creep.

2. **Find/Replace — word-boundary-aware or substring?**
   - What we know: D-04 says simple text find/replace
   - What's unclear: Should "the" match "there"? (substring match)
   - Recommendation: Default to substring match (simpler, matches user mental model of Ctrl+H). Show match count in the bar so the user can verify.

3. **Merge behavior — first phrase's speaker or dominant speaker?**
   - What we know: The existing `mergePhrase` does not set `dominantSpeaker` on merged result (line 273-276 of store — merged phrase has no `dominantSpeaker` field set).
   - Recommendation: Use `computeDominantSpeaker(mergedWords)` on bulk merge. This is consistent and handles multi-speaker merges correctly.

4. **Tab navigation — should Tab move to next phrase or next focusable element?**
   - What we know: D-08 specifies Tab/Shift+Tab navigate between phrases
   - What's unclear: The browser default Tab behavior skips from one focusable element to the next — this conflicts with per-phrase navigation.
   - Recommendation: Intercept Tab inside `.text-editor` container only (not globally), move focus to the next/previous `contentEditable` phrase div. Use `e.preventDefault()` to stop browser tab navigation within the editor.

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `TextEditor.tsx`, `subtitleStore.ts`, `grouping.ts`, `shared-types/index.ts`, `TextEditor.css`, `tokens.css` — all read from the repository
- MDN contentEditable docs (training knowledge, HIGH confidence for browser APIs)

### Secondary (MEDIUM confidence)
- React controlled vs. uncontrolled contentEditable patterns (training knowledge, verified against React 18 behavior which has not changed this API)

### Tertiary (LOW confidence)
- None — no external web searches needed; all implementation is within known existing code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing project tech
- Architecture: HIGH — read existing store implementations directly; patterns derived from existing code
- Pitfalls: HIGH — pitfalls derived from reading actual contentEditable + Zustand patterns in existing codebase
- CSS patterns: HIGH — read actual tokens.css and TextEditor.css

**Research date:** 2026-03-28
**Valid until:** Stable — no external libraries, no fast-moving APIs. Valid indefinitely unless store architecture changes.
