# Phase 10: SRT Import and Text Correction - Research

**Researched:** 2026-03-28
**Domain:** SRT parsing, text alignment, inline diff UI — all frontend-only
**Confidence:** HIGH

## Summary

Phase 10 is entirely frontend-only (D-06). The user imports an SRT file after transcription, and the app aligns SRT cue text with WhisperX word timestamps. SRT provides corrected text; Whisper provides per-word timing. The result is a merged transcript with accurate text and precise per-word timing.

The alignment algorithm has three layers: (1) match SRT cues to Whisper phrases by time overlap, (2) within each matched segment, use proportional time distribution to assign per-word timings from the SRT text count vs. the matched Whisper time window, (3) leave unmatched regions untouched. The diff view is a phrase-level side-by-side, letting the user accept or reject individual phrases before the words are committed to the store.

All three pieces — SRT parsing, alignment logic, diff UI — are self-contained. No backend changes needed. The new store action (`applySrtPhrase`) follows the existing `pushUndo → set words → rebuild phrases` pattern exactly.

**Primary recommendation:** Use `srt-parser-2` for SRT parsing (TypeScript, small, returns seconds directly), implement alignment as a pure function in `lib/srtAlignment.ts`, render the diff view as a new component `SrtDiffView` embedded in `TextEditor.tsx`, and use `diff` (npm, v8) `diffWords()` for inline word-level highlighting within matched phrases.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** SRT import happens AFTER transcription — user must have a Whisper transcript with word timestamps first
- **D-02:** Import button lives in the text editing view (not the top toolbar)
- **D-03:** File picker button (standard file dialog) — no drag-and-drop
- **D-04:** Timestamp matching — match SRT cue timestamps to Whisper phrases by time overlap, then word-align within each matched segment
- **D-05:** Proportional time split — when SRT has more/fewer words than Whisper for a segment, distribute timing evenly across SRT words within the matched time range
- **D-06:** Frontend-only — SRT parsing and alignment run entirely in the browser. No backend/Python dependency needed.
- **D-07:** Side-by-side diff view — Left: Whisper text, Right: SRT text, differences highlighted inline
- **D-08:** Per-phrase accept/reject — each phrase row has buttons to cherry-pick which SRT corrections to apply
- **D-09:** Standard undo — uses existing undo/redo system in the store, each accepted phrase is an undo step
- **D-10:** Preserve speaker labels — SRT only changes text, speaker assignments from diarization are kept
- **D-11:** Only align overlapping time regions — Whisper-only regions keep original text, SRT-only regions are ignored
- **D-12:** Re-import replaces previous — each SRT import starts fresh against original Whisper timestamps

### Claude's Discretion
- SRT parsing library choice (or hand-rolled parser)
- Exact diff highlighting algorithm/colors
- Layout details of the side-by-side view within the text editing area

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `srt-parser-2` | 1.2.3 | Parse SRT files into structured entries with `startSeconds`/`endSeconds` | TypeScript types bundled (`dist/index.d.ts`), tiny (28KB unpacked), returns numeric seconds directly — no manual timecode parsing needed; well-maintained |
| `diff` (npm) | 8.0.4 | Word-level diff between Whisper and SRT text for inline highlighting | Industry standard (same algorithm as Git), ships ESM (`libesm/`), full TypeScript types, `diffWords()` produces token arrays with `added`/`removed` flags |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Browser `File.text()` | native | Read SRT file content as string | Used after `<input type="file">` onChange — no FileReader boilerplate needed in modern browsers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `srt-parser-2` | `@plussub/srt-vtt-parser` (2.0.5) | Returns times in milliseconds (`from`/`to`), no ESM exports field — `srt-parser-2` returns seconds directly, simpler integration with existing timestamp logic in seconds |
| `srt-parser-2` | Hand-rolled regex parser | A standard SRT block is simple (index, timecode line, text lines, blank), but DaVinci Resolve 20 adds HTML formatting tags (`<b>`, `<i>`) that require stripping; using a library avoids that edge case |
| `diff` npm | `fast-diff` (1.3.0) | `fast-diff` is character-level only, no `exports` field; `diff` provides `diffWords()` directly and ESM-native |

**Installation:**
```bash
npm install srt-parser-2 diff
npm install --save-dev @types/diff
```
(Run from project root — npm workspaces will hoist to `packages/frontend/node_modules`)

**Version verification (confirmed 2026-03-28):**
- `srt-parser-2`: 1.2.3 (latest)
- `diff`: 8.0.4 (latest)
- `@types/diff`: 8.0.0 (latest)

---

## Architecture Patterns

### Recommended File Structure

```
packages/frontend/src/
├── lib/
│   └── srtAlignment.ts         # Pure functions: parseSrt, alignSrtToWhisper
├── hooks/
│   └── useSrtImport.ts         # File-picker state + alignment orchestration
└── components/
    └── TextEditor/
        ├── TextEditor.tsx       # Add SrtImportButton + conditional SrtDiffView
        ├── TextEditor.css       # Add diff view styles
        ├── SrtDiffView.tsx      # Side-by-side diff UI
        └── SrtDiffView.css
```

New store action added to `subtitleStore.ts`:
```
applySrtPhrase(phraseIndex: number, replacementWords: SessionWord[]) => void
```

### Pattern 1: SRT Parsing

`srt-parser-2` output per entry:
```typescript
// Source: https://github.com/1c7/srt-parser-2
interface SrtEntry {
  id: string          // "1", "2", ...
  startTime: string   // "00:00:11,544"
  startSeconds: number
  endTime: string
  endSeconds: number
  text: string        // may contain <b>/<i> tags from DaVinci Resolve 20
}
```

Strip HTML tags from text immediately after parsing:
```typescript
// lib/srtAlignment.ts
import SrtParser from 'srt-parser-2'

export interface SrtCue {
  startSec: number
  endSec: number
  text: string        // HTML-stripped
}

export function parseSrt(rawContent: string): SrtCue[] {
  const parser = new SrtParser()
  const entries = parser.fromSrt(rawContent)
  return entries.map(e => ({
    startSec: e.startSeconds,
    endSec: e.endSeconds,
    text: e.text.replace(/<[^>]+>/g, '').trim(),
  }))
}
```

### Pattern 2: Reading File in Browser

No FileReader needed — `File.text()` is sufficient and clean:
```typescript
// hooks/useSrtImport.ts
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  const content = await file.text()
  const cues = parseSrt(content)
  // ... run alignment
}
```

The `<input>` approach (D-03 mandates no drag-and-drop):
```tsx
<input
  type="file"
  accept=".srt"
  style={{ display: 'none' }}
  ref={fileInputRef}
  onChange={handleFileChange}
/>
<button onClick={() => fileInputRef.current?.click()}>
  Import SRT
</button>
```

### Pattern 3: Alignment Algorithm

The alignment has two stages:

**Stage 1 — Phrase-level matching (D-04)**

Match each SRT cue to Whisper phrases by time overlap. A cue overlaps a phrase if their time ranges intersect. Use a simple linear scan — the cue's `[startSec, endSec]` overlaps phrase `[phrase.words[0].start, phrase.words[last].end]` when `cue.startSec < phraseEnd && cue.endSec > phraseStart`.

One SRT cue may match multiple Whisper phrases (SRT cue spans phrase boundary) and one phrase may match multiple SRT cues (Whisper phrase spans SRT cue boundary). The simplest correct approach for this phase: match each SRT cue to the **best-overlap Whisper phrase** (highest overlap fraction). This produces a 1:1 map of `(srtCueIndex → phraseIndex)`.

```typescript
// lib/srtAlignment.ts
export interface AlignedPhrase {
  phraseIndex: number
  whisperText: string    // original Whisper phrase text (joined words)
  srtText: string        // matched SRT cue text
  replacementWords: SessionWord[]  // computed with proportional timing (D-05)
}

export function alignSrtToWhisper(
  cues: SrtCue[],
  phrases: SessionPhrase[],  // from store
): AlignedPhrase[] { ... }
```

**Stage 2 — Proportional word timing (D-05)**

For a matched phrase with Whisper time window `[phraseStart, phraseEnd]` and SRT word count `N`:
- Duration = `phraseEnd - phraseStart`
- Per-word duration = `duration / N`
- Word `i` gets: `start = phraseStart + i * perWordDuration`, `end = start + perWordDuration`
- Preserve speaker from the Whisper phrase's `dominantSpeaker` for all replacement words (D-10)

```typescript
function distributeTimings(
  srtWords: string[],
  phraseStart: number,
  phraseEnd: number,
  speaker?: string,
): SessionWord[] {
  const duration = phraseEnd - phraseStart
  const perWord = duration / srtWords.length
  return srtWords.map((word, i) => ({
    word,
    start: phraseStart + i * perWord,
    end: phraseStart + (i + 1) * perWord,
    confidence: 1.0,
    speaker,
  }))
}
```

### Pattern 4: Store Action

Follow the `pushUndo → set → rebuild` pattern from all existing mutating actions:

```typescript
// subtitleStore.ts — new action
applySrtPhrase: (phraseIndex, replacementWords) => {
  set((state) => {
    if (!state.session) return state
    pushUndo(state)

    // Replace words belonging to this phrase in the flat words array
    const phrase = state.session.phrases[phraseIndex]
    const firstGlobalIdx = state.session.words.indexOf(phrase.words[0])
    const newWords = [
      ...state.session.words.slice(0, firstGlobalIdx),
      ...replacementWords,
      ...state.session.words.slice(firstGlobalIdx + phrase.words.length),
    ]

    const phrases = buildSessionPhrases(
      newWords,
      state.session.manualSplitWordIndices,
      state.maxWordsPerPhrase,
    )
    return { session: { ...state.session, words: newWords, phrases } }
  })
},
```

**Important:** After word array replacement, phrase indices shift if word counts differ. The diff view must re-compute after each accept (use key-based re-rendering or re-run alignment on updated phrases).

### Pattern 5: Inline Diff Highlighting

Use `diff.diffWords()` to compare Whisper phrase text vs. SRT cue text:

```typescript
import { diffWords } from 'diff'

// In SrtDiffView.tsx — renders a single phrase row
function renderInlineDiff(whisperText: string, srtText: string) {
  const changes = diffWords(whisperText, srtText)
  return changes.map((part, i) => {
    if (part.added) return <mark key={i} className="srt-diff__added">{part.value}</mark>
    if (part.removed) return <s key={i} className="srt-diff__removed">{part.value}</s>
    return <span key={i}>{part.value}</span>
  })
}
```

### Pattern 6: useSrtImport Hook

Follow `useTranscribe` / `useDiarize` shape:

```typescript
// hooks/useSrtImport.ts
export interface SrtImportState {
  status: 'idle' | 'parsed' | 'failed'
  alignedPhrases: AlignedPhrase[]
  error: string | null
}

export function useSrtImport() {
  const [state, setState] = useState<SrtImportState>(INITIAL_STATE)
  // Methods: importFile(file), reset()
  // importFile: parse → align → set alignedPhrases → status='parsed'
  return { state, importFile, reset }
}
```

`alignedPhrases` is the pending diff state. The component iterates this list to render the diff view. On "Accept", call `applySrtPhrase(phraseIndex, replacementWords)`. On "Reject", remove from `alignedPhrases` without touching the store.

### Anti-Patterns to Avoid

- **Mutating `original` transcript** — `original` is the immutable Whisper output. SRT alignment operates only on `session.words` via `applySrtPhrase`, never `original`.
- **Re-using phrase indices after accept** — When a phrase is accepted and word count changes, `buildSessionPhrases` produces new phrase boundaries. The diff view must not cache phrase indices across accepts. Re-run alignment or use word-start timestamps as stable identifiers.
- **Stripping `speaker` on word replacement** — The `distributeTimings` helper must carry the original phrase's `dominantSpeaker` through to each replacement `SessionWord` (D-10).
- **Using phrase index to find words in flat array with `.indexOf()`** — `.indexOf()` uses reference equality and works here because `phrase.words` references objects in `state.session.words`. This is correct but fragile; alternatively, track `firstGlobalIndex` in `AlignedPhrase`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SRT timecode parsing | Custom regex to parse `HH:MM:SS,mmm` | `srt-parser-2` | DaVinci Resolve 20 adds HTML formatting tags in text; the library strips them; the comma/period separator variation is already handled |
| Word-level diff | Custom LCS implementation | `diff` npm `diffWords()` | Myers diff correctly handles insertions, deletions, substitutions; character vs. word boundary detection is subtle |
| File reading | `FileReader` callback API | `File.text()` (Promise-based) | Modern and clean; supported in all current browsers |

**Key insight:** The alignment algorithm itself is project-specific (Whisper timestamp + SRT cue matching logic is not a solved library problem) — that genuinely does need to be hand-rolled. Everything else (parsing, diffing, file reading) is a commodity.

---

## Common Pitfalls

### Pitfall 1: DaVinci Resolve HTML Formatting Tags
**What goes wrong:** DaVinci Resolve 20 exports SRT with `<b>` tags around every subtitle line (bold face is the default font style). The raw text field contains `<b>Hello world</b>` instead of `Hello world`.
**Why it happens:** Resolve encodes the Inspector font weight as inline HTML. This is a known non-standard behavior.
**How to avoid:** Strip HTML tags from `entry.text` immediately after parsing: `text.replace(/<[^>]+>/g, '').trim()`.
**Warning signs:** Diff view shows `<b>` and `</b>` as differences on every line.

### Pitfall 2: Phrase Index Drift After Accept
**What goes wrong:** User accepts phrase 3. The replacement has 5 words instead of 3. `buildSessionPhrases` runs. Phrase indices 4, 5, 6... shift by the word count delta. The remaining `alignedPhrases` in the diff view reference stale phrase indices.
**Why it happens:** Phrase indices are positional and recomputed from word boundaries on every store mutation.
**How to avoid:** Two options — (A) run a full re-alignment pass after each accept (re-align pending SRT cues against updated `session.phrases`), or (B) track the alignment result by `phraseStartSec` (timestamp-stable) rather than `phraseIndex`, and re-map after each accept. Option A is simpler to implement.

### Pitfall 3: SRT Cues Spanning Multiple Whisper Phrases
**What goes wrong:** One SRT cue covers a time range that spans two Whisper phrases. Both phrases get matched to the same SRT cue, resulting in duplicate text applied twice.
**Why it happens:** SRT cues from DaVinci Resolve often represent a full subtitle line that Whisper split across two phrases.
**How to avoid:** Use best-overlap (not all-overlap) matching — each SRT cue maps to at most one Whisper phrase (the highest overlap fraction). A Whisper phrase can still receive at most one SRT cue under this scheme.

### Pitfall 4: Empty or Whitespace-Only SRT Text
**What goes wrong:** A SRT cue with empty or whitespace text creates zero replacement words, leaving a phrase with no words. The store's `deletePhrase` / word count guards are bypassed.
**Why it happens:** Some SRT files have empty cues as spacers.
**How to avoid:** In `alignSrtToWhisper`, skip any SRT cue whose stripped text is empty or contains no word characters.

### Pitfall 5: Single-Word Phrases — Minimum Timestamp Gap
**What goes wrong:** When distributing timing across a single-word replacement, `start === end` if duration is zero (malformed SRT cue with identical start/end).
**Why it happens:** Some SRT tools create zero-duration cues.
**How to avoid:** Enforce minimum word duration: `end = Math.max(start + 0.01, phraseEnd)` for single-word phrases.

### Pitfall 6: Re-import Clears Pending Diff
**What goes wrong:** User imports a second SRT file while the diff view is open. The pending `alignedPhrases` from the first import must be discarded before the new alignment runs (D-12: re-import starts fresh).
**Why it happens:** `useSrtImport` state holds previous alignment result.
**How to avoid:** `reset()` call in `useSrtImport.importFile()` before processing the new file. Since D-12 says re-import is against original Whisper timestamps, also re-align against `store.original` words rather than `session.words` — so accepted changes from the previous import don't shift timestamps for the new alignment baseline.

---

## Code Examples

### SRT File Browser Read
```typescript
// hooks/useSrtImport.ts
const fileInputRef = useRef<HTMLInputElement>(null)

const importFile = async (file: File) => {
  try {
    const content = await file.text()
    const cues = parseSrt(content)
    const session = useSubtitleStore.getState().session
    if (!session) return
    const aligned = alignSrtToWhisper(cues, session.phrases)
    setState({ status: 'parsed', alignedPhrases: aligned, error: null })
  } catch (err) {
    setState({ status: 'failed', alignedPhrases: [], error: String(err) })
  }
}
```

### Diff Rendering with `diff` npm
```typescript
// Source: https://github.com/kpdecker/jsdiff
import { diffWords } from 'diff'

const parts = diffWords(whisperText, srtText)
// parts: Array<{ value: string, added?: boolean, removed?: boolean }>
```

### Store Action Shape (applySrtPhrase)
```typescript
// subtitleStore.ts — follows existing pattern from updateWord/reassignWordSpeaker
applySrtPhrase: (phraseIndex, replacementWords) =>
  set((state) => {
    if (!state.session) return state
    pushUndo(state)
    // ... replace words, rebuild phrases
  }),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `FileReader` callback API | `File.text()` Promise | Chrome 54+, 2016 | Cleaner async/await file reading |
| `@types/diff` separate from `diff` | `diff` v8 ships its own types in `libesm/index.d.ts` | 2024 | No separate `@types/diff` install needed for ESM path (but `@types/diff` is needed for CJS/editor resolution in this project setup) |

**Deprecated/outdated:**
- `srt2json` (npm, 0.0.8): pre-TypeScript, unmaintained — avoid.
- `fast-diff`: character-level only, no ESM exports field — use `diff` npm instead.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — phase is entirely frontend/browser code with npm packages).

---

## Validation Architecture

`workflow.nyquist_validation` key is absent from `.planning/config.json` — treated as enabled.

### Test Framework

No test framework currently detected in the project (no `jest.config.*`, `vitest.config.*`, `pytest.ini`, or `tests/` directory found). Phase 10 is frontend-only UI logic.

| Property | Value |
|----------|-------|
| Framework | None detected — Wave 0 must decide: vitest recommended for Vite projects |
| Config file | None — Wave 0 gap |
| Quick run command | `npx vitest run --reporter=verbose` (after Wave 0 setup) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

Phase 10 has no formal requirement IDs (phase_requirement_ids: null). Mapping against success criteria:

| Behavior | Test Type | Notes |
|----------|-----------|-------|
| `parseSrt()` handles standard SRT, strips HTML tags, returns seconds | unit | Pure function — testable without DOM |
| `alignSrtToWhisper()` matches cues to phrases by time overlap | unit | Pure function with mock SessionPhrase data |
| Proportional timing distribution produces monotonic timestamps | unit | Edge cases: single word, zero-duration cue |
| Empty/whitespace SRT cues are skipped | unit | Pure function |
| `applySrtPhrase` adds undo snapshot before mutation | unit | Requires mocking `useUndoStore` |
| Diff view renders added/removed words with correct CSS classes | component (manual) | Visual; automated snapshot test optional |
| Accept button calls `applySrtPhrase` with correct args | component | React Testing Library (if installed) |

### Wave 0 Gaps

The project has no test infrastructure at all. Options:
- [ ] Install vitest: `npm install --save-dev vitest @vitest/ui` in root or `packages/frontend`
- [ ] `packages/frontend/vitest.config.ts` — minimal config
- [ ] `packages/frontend/src/lib/srtAlignment.test.ts` — covers pure function unit tests

If testing is out of scope for this phase (no test infra exists and adding it is a separate decision), document that `srtAlignment.ts` and `distributeTimings()` are pure functions with no side effects — the highest-priority testable surface.

*(If no test infra: "None — no test framework installed; pure alignment functions in `srtAlignment.ts` are the primary testable surface; manual browser testing covers the diff UI")*

---

## Open Questions

1. **Phrase index drift strategy after accept**
   - What we know: Accepting a phrase with different word count shifts all subsequent phrase indices. Two strategies: re-run alignment (simple) vs. timestamp-based stable IDs (robust).
   - What's unclear: How often will users accept phrases out of order? (The diff view lists them sequentially, so mostly top-to-bottom.)
   - Recommendation: Re-run alignment after each accept (Option A). Simple, correct, O(n) cost is negligible for typical subtitle files (< 500 phrases).

2. **"Accept All" button**
   - What we know: D-08 specifies per-phrase accept/reject. CONTEXT.md has no mention of bulk accept.
   - What's unclear: User may expect a quick way to accept all non-conflicting phrases.
   - Recommendation: Leave out of Phase 10 scope (not in CONTEXT.md). Can be added trivially post-phase.

3. **Multiline SRT text**
   - What we know: `srt-parser-2` preserves newlines in `text` field as `\n`.
   - What's unclear: Should multiline text be treated as one phrase or split at `\n`?
   - Recommendation: Join multiline text with a space (`entry.text.replace(/\n/g, ' ')`) — treat each SRT cue as one phrase unit, matching 1:1 with Whisper phrases.

---

## Sources

### Primary (HIGH confidence)
- `srt-parser-2` npm registry — version 1.2.3, verified 2026-03-28
- `diff` npm registry — version 8.0.4, ESM exports verified, TypeScript types confirmed
- GitHub: `1c7/srt-parser-2` — output schema (`startSeconds`, `endSeconds`, `text`) verified from README
- GitHub: `plussub/srt-vtt-parser` — output schema (`from`/`to` in milliseconds) verified from README
- Existing codebase: `subtitleStore.ts`, `undoMiddleware.ts`, `grouping.ts`, `TextEditor.tsx`, `useTranscribe.ts` — all read directly

### Secondary (MEDIUM confidence)
- Larry Jordan article on DaVinci Resolve 20 non-standard SRT (HTML bold tags): https://larryjordan.com/articles/davinci-resolve-20-creates-non-standard-srt-files-and-how-to-fix-them/
- WebFetch of `plussub/srt-vtt-parser` README — time format confirmed as milliseconds

### Tertiary (LOW confidence)
- General ecosystem patterns for `diffWords()` usage — not verified against Context7 (library not indexed), but `diff` is well-established with 8.x release; API shape confirmed via npm package inspection

---

## Metadata

**Confidence breakdown:**
- SRT parsing library: HIGH — registry verified, API confirmed from README
- Alignment algorithm: HIGH — designed from first principles matching locked decisions D-04/D-05
- Store integration: HIGH — pattern derived from existing code read directly
- Diff library API: MEDIUM — npm registry verified, API shape from documented usage patterns
- DaVinci Resolve HTML tags pitfall: MEDIUM — confirmed by official community source

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable libraries, no fast-moving dependencies)
