# Phase 4: Transcript Editor and Grouping - Research

**Researched:** 2026-03-03
**Domain:** Zustand 5 state modeling, inline word editing UX, silence-gap segmentation algorithm, split/merge grouping controls, Remotion Player seekTo integration
**Confidence:** HIGH (codebase read directly; Zustand/Remotion confirmed from local node_modules and prior phase research; inline edit pattern verified from official source)

---

## Summary

Phase 4 adds the ability to correct transcript words and control how words are grouped into subtitle phrases. The existing `SubtitleComposition` is pure props-driven and receives a flat `words: TranscriptWord[]` array. Phase 4 must decide this phase's central architecture question: **where does grouping live?**

The answer: grouping lives entirely in the frontend Zustand store. The composition already has `groupIntoPhrases()` hardcoded inside `SubtitleOverlay.tsx` — Phase 4 will move that algorithm to the store (where manual overrides can be applied) and pass pre-computed phrases into the `SubtitleComposition` as a new prop type. This is the minimal path: the composition stays pure-props-driven, the editor controls the grouping, and changes flow to the preview via Zustand.

The Zustand store must split into two conceptual layers: immutable original (raw Whisper output, never modified) and mutable session state (user edits to word text, timestamps, and phrase groupings). This separation is critical for "reset to original" functionality and for tracking what the user has changed. The store does not use immer middleware today — for Phase 4's nested word-level updates, immer is valuable but not required; the nested structure is only two levels deep (`session.words[i].word`), so spread-based updates remain readable.

The UI pattern for transcript editing is: each word rendered in the phrase editor is an inline `<input>` (or shows as text with click-to-edit) that commits on blur or Enter. Timestamps use the same pattern with numeric validation. Split/merge operations are discrete actions on the phrase array. Word click in the transcript can `seekTo()` the Remotion Player to that word's start time using a `PlayerRef` forwarded from `PreviewPanel`.

**Primary recommendation:** Extend `subtitleStore.ts` with session state (mutable copy of words + phrase grouping overrides), move `groupIntoPhrases()` to a `lib/grouping.ts` utility called by the store, build a `TranscriptEditor` component that renders phrases with inline-editable word cells and split/merge buttons, and forward a `PlayerRef` from `PreviewPanel` so clicking a word seeks the video.

---

## Codebase Snapshot (Phase 3 end state)

These are the files this phase will build upon or modify:

| File | Current State | Phase 4 Action |
|------|--------------|----------------|
| `packages/shared-types/src/index.ts` | `TranscriptWord { word, start, end, confidence }`, `Transcript { language, words }` | Add `TranscriptPhrase` type if passed to composition |
| `packages/frontend/src/store/subtitleStore.ts` | Flat: `transcript: Transcript \| null`, `setJob(...)` | Extend: add `session` layer with editable words + phrase splits |
| `packages/remotion-composition/src/SubtitleOverlay.tsx` | Contains `groupIntoPhrases()` and `findActiveWordIndex()` internally | Extract `groupIntoPhrases()` to `lib/grouping.ts`; SubtitleComposition receives pre-grouped phrases OR keeps current word-based approach (see Open Questions) |
| `packages/frontend/src/components/TranscriptView.tsx` | Read-only word list with hover tooltip | Replace with editable `TranscriptEditor` component |
| `packages/frontend/src/components/PreviewPanel.tsx` | `<Player>` without ref | Add `PlayerRef`, forward seek capability |
| `packages/frontend/src/pages/SubtitlesPage.tsx` | Renders `<TranscriptView>` after transcription | Swap for `<TranscriptEditor>` |

**Key facts from codebase:**
- `SubtitleComposition` currently uses `<Video>` (not `<OffthreadVideo>`) — this was implemented as-built in Phase 3
- Grouping constants: `PHRASE_GAP_SEC = 0.3`, `MAX_WORDS_PER_PHRASE = 8` (in `SubtitleOverlay.tsx`)
- Store already has `videoMetadata` with `fps` — seekTo frame = `Math.floor(wordStartSec * fps)`
- Zustand 5.0.11 is installed; immer is NOT installed (it is a peer dep, not present in package-lock)

---

## Standard Stack

### Core (already installed — no new packages required by default)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zustand` | 5.0.11 (installed) | Store session state: editable words, phrase grouping overrides | Already in use; extend existing store |
| `react` | 18.3.1 (installed) | Inline edit controlled inputs, phrase editor components | Already in use |
| `@remotion/player` | 4.0.379 (installed) | `PlayerRef` + `seekTo()` for word-click-to-seek | Already installed; just add the ref |

### Optional Addition (only if immer is chosen for store updates)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `immer` | 11.x (latest as of 2026-02) | Simplifies nested state mutations in Zustand | Only needed if store has 3+ levels of nesting; Phase 4's structure is 2 levels deep — spread is adequate |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Controlled `<input>` for word editing | `contenteditable` div / `react-contenteditable` | `contenteditable` has cursor-jump bugs in React controlled mode; plain `<input>` is simpler, avoids `suppressContentEditableWarning`, easier to style |
| Custom grouping algorithm in store | Move grouping to composition (current approach) | Keeping grouping in the store enables user-driven overrides; the composition becomes a pure renderer of pre-computed phrases |
| Inline phrase array in store | Separate `manualSplits: Set<number>` (word indices where splits are forced) | Split-set approach is simpler; phrase array approach is more flexible for merge operations. Phrase array is recommended for Phase 4's merge requirement. |

**Installation (if immer is needed):**
```bash
# Only add if store updates become unwieldy with spread operators
npm install immer --workspace packages/frontend
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/frontend/src/
├── store/
│   └── subtitleStore.ts         # Extended: original + session layers
├── lib/
│   └── grouping.ts              # groupIntoPhrases(), now shared between store and composition
├── components/
│   ├── TranscriptEditor/
│   │   ├── TranscriptEditor.tsx # Top-level: renders phrase list
│   │   ├── TranscriptEditor.css
│   │   ├── PhraseRow.tsx        # One phrase: word cells + split/merge buttons
│   │   └── WordCell.tsx         # Inline-edit word text + timestamp
│   └── PreviewPanel.tsx         # Add PlayerRef, expose seekTo via callback prop or store action
└── pages/
    └── SubtitlesPage.tsx        # Swap TranscriptView → TranscriptEditor; pass seekTo down
```

### Pattern 1: Two-Layer Store State (Original vs Session)

**What:** The Zustand store keeps `original` (immutable Whisper output) and `session` (mutable user edits). The composition always renders from `session`. Reset restores `session` from `original`.

**When to use:** Any time the user needs undo/reset-to-original. Separating original from session is the canonical approach for editors.

```typescript
// Source: derived from codebase (subtitleStore.ts) + Zustand 5 patterns
// packages/frontend/src/store/subtitleStore.ts

import { create } from 'zustand'
import type { Transcript, TranscriptWord, VideoMetadata } from '@eigen/shared-types'
import type { StyleProps } from '@eigen/remotion-composition'
import { groupIntoPhrases } from '../lib/grouping'

export interface SessionWord extends TranscriptWord {
  // Same shape as TranscriptWord — kept as alias for clarity
  // word: string, start: number, end: number, confidence: number
}

// A phrase is an array of words. manualSplits and manualMerges are
// encoded implicitly in the phrases array structure — no separate metadata needed.
export interface SessionPhrase {
  words: SessionWord[]
  isManualSplit?: boolean   // true if user explicitly split at this boundary
}

interface SubtitleStore {
  // Immutable Whisper output — never mutate
  jobId: string | null
  original: Transcript | null
  videoMetadata: VideoMetadata | null

  // Mutable session state
  session: {
    words: SessionWord[]        // editable copy of original.words
    phrases: SessionPhrase[]    // grouped result (auto or manual)
  } | null

  style: StyleProps

  // Actions
  setJob: (jobId: string, transcript: Transcript, videoMetadata: VideoMetadata) => void
  updateWord: (wordIndex: number, patch: Partial<Pick<SessionWord, 'word' | 'start' | 'end'>>) => void
  splitPhrase: (phraseIndex: number, splitBeforeWordIndex: number) => void
  mergePhrase: (phraseIndex: number) => void  // merges phraseIndex and phraseIndex+1
  resetSession: () => void
  setStyle: (partial: Partial<StyleProps>) => void
  reset: () => void
}
```

**Key design decision — phases vs flat words in session:**
Store phrases (not just flat words) in session so split/merge operations are O(1) array splices rather than rebuilding the phrase array from scratch on every render.

### Pattern 2: Regrouping Flow

**What:** When user edits a word's timestamps, the auto-grouping is recomputed. Manual splits/merges take priority over auto-grouping.

**Flow:**
1. User calls `updateWord(index, { start: newStart })`
2. Store updates `session.words[index].start`
3. Store recomputes `session.phrases` by running `groupIntoPhrases(session.words)` then re-applying manual overrides

**Important:** If the user has manually split phrase at index 3, that split should survive a word text edit. This means storing which boundaries are "pinned" (manual) vs "auto". The simplest approach: after each auto-regroup, re-apply only the manual splits that are still valid (split point still exists as an adjacent word boundary).

```typescript
// packages/frontend/src/lib/grouping.ts
// Extracted from packages/remotion-composition/src/SubtitleOverlay.tsx

import type { TranscriptWord } from '@eigen/shared-types'

export const PHRASE_GAP_SEC = 0.3
export const MAX_WORDS_PER_PHRASE = 8

function endsWithPunctuation(word: string): boolean {
  return /[.?!]$/.test(word)
}

/**
 * Auto-group words into subtitle phrases.
 * Splits on: silence gap > PHRASE_GAP_SEC, sentence-ending punctuation, or MAX_WORDS_PER_PHRASE.
 * Returns array of arrays — each inner array is one phrase's words.
 */
export function groupIntoPhrases(words: TranscriptWord[]): TranscriptWord[][] {
  if (words.length === 0) return []

  const phrases: TranscriptWord[][] = []
  let current: TranscriptWord[] = [words[0]]

  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end
    const prevEndsPunct = endsWithPunctuation(words[i - 1].word)
    const atMax = current.length >= MAX_WORDS_PER_PHRASE

    if (gap > PHRASE_GAP_SEC || prevEndsPunct || atMax) {
      phrases.push(current)
      current = [words[i]]
    } else {
      current.push(words[i])
    }
  }
  phrases.push(current)

  return phrases
}
```

### Pattern 3: Inline Word Edit (Controlled Input)

**What:** Each word in the transcript editor renders as a controlled `<input>`. Local state holds the editing value; commit happens on blur or Enter; Escape reverts.

**When to use:** This is the standard React pattern for inline editing. No external library needed.

```typescript
// Source: emgoto.com/react-inline-edit (verified 2026-03)
// packages/frontend/src/components/TranscriptEditor/WordCell.tsx

import { useState } from 'react'
import type { SessionWord } from '../../store/subtitleStore'

interface WordCellProps {
  word: SessionWord
  wordIndex: number
  onUpdateText: (wordIndex: number, newText: string) => void
  onUpdateTimestamp: (wordIndex: number, field: 'start' | 'end', value: number) => void
  onWordClick: (startSec: number) => void
}

export function WordCell({ word, wordIndex, onUpdateText, onUpdateTimestamp, onWordClick }: WordCellProps) {
  const [editingText, setEditingText] = useState(word.word)

  const commitText = () => {
    const trimmed = editingText.trim()
    if (trimmed === '') {
      setEditingText(word.word) // revert empty
      return
    }
    onUpdateText(wordIndex, trimmed)
  }

  return (
    <span className="word-cell">
      <input
        className="word-cell__text"
        value={editingText}
        onChange={(e) => setEditingText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
        }}
        onClick={() => onWordClick(word.start)}
      />
    </span>
  )
}
```

**Warning:** `editingText` local state goes stale if `word.word` changes externally (e.g., re-transcribe). Reset with a `key` prop on the component: `<WordCell key={`${wordIndex}-${word.word}`} .../>`. This forces remount when the word text changes.

### Pattern 4: PlayerRef Seek from Transcript Click

**What:** `PreviewPanel` holds a `PlayerRef`. When a user clicks a word, the transcript editor calls a seek callback. The `seekTo` frame is `Math.floor(wordStartSec * fps)`.

```typescript
// Source: remotion.dev/docs/player/custom-controls (verified via prior research)
// packages/frontend/src/components/PreviewPanel.tsx (modified)

import { useRef, useCallback } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { useSubtitleStore } from '../store/subtitleStore'

export function PreviewPanel({ onSeekReady }: { onSeekReady: (seekFn: (timeSec: number) => void) => void }) {
  const playerRef = useRef<PlayerRef>(null)
  const videoMetadata = useSubtitleStore((s) => s.videoMetadata)

  const seekToTime = useCallback((timeSec: number) => {
    if (!playerRef.current || !videoMetadata) return
    const frame = Math.floor(timeSec * videoMetadata.fps)
    playerRef.current.seekTo(frame)
  }, [videoMetadata])

  // Expose seekToTime to parent so TranscriptEditor can call it
  // Alternative: store seekToTime in Zustand as a non-reactive ref
  // ...

  return (
    <Player
      ref={playerRef}
      // ... existing props
    />
  )
}
```

**Simpler alternative:** Store `playerRef` in a React context or pass `seekToTime` as a callback prop down from `SubtitlesPage`. Do NOT put `playerRef` itself in Zustand (refs are not serializable).

### Pattern 5: Split and Merge Operations on Phrase Array

**What:** Split inserts a phrase boundary before a given word within a phrase. Merge collapses two adjacent phrases into one.

```typescript
// In subtitleStore.ts actions

splitPhrase: (phraseIndex: number, splitBeforeWordIndex: number) => {
  set((state) => {
    if (!state.session) return state
    const phrases = [...state.session.phrases]
    const target = phrases[phraseIndex]
    if (!target || splitBeforeWordIndex <= 0 || splitBeforeWordIndex >= target.words.length) {
      return state // invalid split
    }
    const left: SessionPhrase = { words: target.words.slice(0, splitBeforeWordIndex), isManualSplit: false }
    const right: SessionPhrase = { words: target.words.slice(splitBeforeWordIndex), isManualSplit: true }
    phrases.splice(phraseIndex, 1, left, right)
    return { session: { ...state.session, phrases } }
  })
},

mergePhrase: (phraseIndex: number) => {
  set((state) => {
    if (!state.session) return state
    const phrases = [...state.session.phrases]
    if (phraseIndex >= phrases.length - 1) return state // nothing to merge into
    const merged: SessionPhrase = {
      words: [...phrases[phraseIndex].words, ...phrases[phraseIndex + 1].words],
      isManualSplit: false,
    }
    phrases.splice(phraseIndex, 2, merged)
    return { session: { ...state.session, phrases } }
  })
},
```

### Anti-Patterns to Avoid

- **Storing `playerRef` in Zustand:** Refs are mutable objects, not serializable, and will break Zustand's state diffing. Pass `seekTo` as a callback instead.
- **Calling `groupIntoPhrases()` inside the Remotion composition:** The composition must stay pure-props-driven. Move grouping to the store; pass computed phrases as props.
- **Re-running full auto-grouping after every keystroke in a word text field:** Only regroup on blur/commit, not on every `onChange`. Regrouping on every keystroke is unnecessary (text changes don't affect gap-based grouping) and causes jank.
- **Using `contenteditable` for word text editing:** React's reconciler conflicts with DOM mutations from `contenteditable`. Use `<input type="text">` for word text; use `<input type="number">` or a formatted text input for timestamps.
- **Putting all timestamp validation logic in the component:** Validate timestamps in the store action (`updateWord`). The rule is `start < end` and `start >= previousWord.end` and `end <= nextWord.start`. Reject invalid timestamps silently (revert to prior value) or show inline error.
- **Making `SessionPhrase` store a deep copy of `TranscriptWord` objects:** Instead, `SessionPhrase.words` should reference objects from `session.words` by index, or store shallow copies. The current design (inline words array in phrase) is fine since there are typically only hundreds of words, not millions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Inline text editing | Custom `contenteditable` wrapper | `<input type="text">` with blur-commit pattern | ContentEditable in React has cursor-jump and hydration issues; input is simpler |
| Player seek from transcript | Manual `currentTime` manipulation on `<video>` element | `playerRef.current.seekTo(frame)` via `@remotion/player` | `@remotion/player` controls the video element internally; direct `currentTime` mutation bypasses Player state and causes sync issues |
| Silence-gap grouping | External NLP library or subtitle parser | Custom `groupIntoPhrases()` (already exists in `SubtitleOverlay.tsx`) | The algorithm is 20 lines; the data model already fits; no new library needed |
| Phrase split/merge data structure | Complex undo/redo stack | Simple array splice in Zustand store | Phase 4 requirements don't include undo; a simple phrase array is sufficient |

**Key insight:** Phase 4 is a UI/state architecture problem, not a new-library problem. The core algorithms (`groupIntoPhrases`, `findActiveWordIndex`) already exist in the codebase. The work is reorganizing them to support user edits.

---

## Common Pitfalls

### Pitfall 1: `editingText` local state goes stale after store update

**What goes wrong:** User edits word A, commits it. Store updates. But `editingText` in the `WordCell` still shows the old uncommitted value from a sibling word that was re-rendered.

**Why it happens:** Local component state (`useState`) doesn't reset when the parent re-renders with new props. If `word.word` changes externally (e.g., re-transcribe overwrites the session), the local `editingText` is now stale.

**How to avoid:** Add `key={wordIndex + '-' + word.word}` (or `key={word.start}`) on `<WordCell>`. React remounts the component when the key changes, resetting local state. For re-transcribe flows, call `reset()` then `setJob()` which replaces the session entirely and remounts all word cells.

**Warning signs:** After re-transcribe, word cells show old edited text instead of new transcription text.

### Pitfall 2: Phrase re-grouping clobbers manual splits

**What goes wrong:** User manually splits phrase at index 5. Then edits a word's text (not its timestamps). The store reruns `groupIntoPhrases()` and the manual split is lost.

**Why it happens:** Text edits don't change word timing, so the auto-grouping produces the same result — but if the store rebuilds phrases from scratch on every word edit, it loses the `isManualSplit` flag.

**How to avoid:** Only rerun auto-grouping when timestamps change. Text edits should update the word in-place in the existing `session.phrases` structure without rebuilding the phrase array. After a timestamp update that reruns grouping, re-apply manual split markers by tracking pinned word indices.

**Warning signs:** Manual phrase splits disappear after the user edits any word's text.

### Pitfall 3: Invalid split index causes corrupted phrase array

**What goes wrong:** `splitPhrase(phraseIndex, 0)` is called (split before the first word). This creates an empty left phrase `{ words: [] }`, which then causes render errors in the phrase list.

**Why it happens:** Split at index 0 within a phrase has no meaning — it would create an empty phrase. Similarly, split at `phrase.words.length` is invalid.

**How to avoid:** Guard in `splitPhrase`: reject if `splitBeforeWordIndex <= 0 || splitBeforeWordIndex >= phrase.words.length`. Never show a "split here" control before the first word of a phrase.

**Warning signs:** A phrase with zero words appears in the editor; the composition renders an empty subtitle.

### Pitfall 4: Merging the composition's phrase computation with the store's

**What goes wrong:** `SubtitleOverlay.tsx` runs `groupIntoPhrases(words)` on every frame. After Phase 4, the store also groups phrases. There are now two sources of truth for what phrases look like — they can diverge.

**Why it happens:** The existing `groupIntoPhrases` in `SubtitleOverlay.tsx` is not aware of manual splits stored in Zustand. The composition only sees `words: TranscriptWord[]`.

**How to avoid:** Choose one of two approaches and stick to it:
- **Option A (recommended):** Pass pre-computed `phrases: TranscriptPhrase[]` into the composition as a prop. Remove `groupIntoPhrases` from `SubtitleOverlay.tsx`. The store is the single source of phrase truth.
- **Option B:** Keep composition self-grouping (current behavior) for display only; store only tracks manual overrides and passes a modified `words[]` that encodes splits via artificial gaps. This is hacky and not recommended.

**Warning signs:** Preview and editor show different phrase boundaries.

### Pitfall 5: Timestamp editing creates `start > end` or ordering violations

**What goes wrong:** User sets a word's start timestamp to 5.0 but its end timestamp is 4.8. Or sets word N's start to before word N-1's end. The composition renders the word in the wrong position.

**Why it happens:** No validation on timestamp inputs.

**How to avoid:** In the store's `updateWord` action, validate:
- `newStart < word.end` (start before end)
- `newStart >= previousWord.end` (no overlap with previous word)
- `newEnd > word.start` (end after start)
- `newEnd <= nextWord.start` (no overlap with next word)
Reject invalid values silently by not applying the update, or clamp to the valid range.

**Warning signs:** Words appear out of order in the composition; binary search `findActiveWordIndex` returns wrong results.

### Pitfall 6: Player seek on word click causes re-render loop

**What goes wrong:** Clicking a word calls `playerRef.current.seekTo(frame)`. The Player fires a `timeupdate` event. If something in the component tree subscribes to `useCurrentPlayerFrame`, it causes a cascade of re-renders at 60fps.

**Why it happens:** `useCurrentPlayerFrame` triggers re-renders on every frame. If the transcript editor subscribes to it (e.g., to highlight the "current" word in the editor), this cascades.

**How to avoid:** Do NOT use `useCurrentPlayerFrame` in the transcript editor component. The transcript editor does not need to know the current playback position for Phase 4's requirements. If word-synchronized highlighting in the editor is added later, isolate it in a separate component that reads `useCurrentPlayerFrame`.

**Warning signs:** React DevTools profiler shows the entire transcript editor re-rendering at 60fps during playback.

---

## Code Examples

Verified patterns from official sources and codebase:

### Zustand Store Extension (session layer)
```typescript
// Source: existing subtitleStore.ts + Zustand 5 patterns (deepwiki.com/pmndrs/zustand)
// Note: immer NOT required — spread operators sufficient for 2-level nesting

import { create } from 'zustand'
import type { Transcript, TranscriptWord, VideoMetadata } from '@eigen/shared-types'
import type { StyleProps } from '@eigen/remotion-composition'
import { groupIntoPhrases } from '../lib/grouping'

export interface SessionWord {
  word: string
  start: number
  end: number
  confidence: number
}

export interface SessionPhrase {
  words: SessionWord[]
  isManualSplit: boolean
}

interface Session {
  words: SessionWord[]
  phrases: SessionPhrase[]
  manualSplitWordIndices: Set<number>  // global word indices where user forced a split
}

function buildPhrases(words: SessionWord[], manualSplits: Set<number>): SessionPhrase[] {
  const autoGroups = groupIntoPhrases(words)
  // Flatten auto groups and re-split at manual boundaries
  const flat = autoGroups.flat()
  // Rebuild respecting manual splits
  const result: SessionPhrase[] = []
  let current: SessionWord[] = []
  let wordIdx = 0

  for (const word of flat) {
    if (wordIdx > 0 && manualSplits.has(wordIdx)) {
      result.push({ words: current, isManualSplit: false })
      current = []
    }
    current.push(word)
    wordIdx++
  }
  if (current.length > 0) result.push({ words: current, isManualSplit: false })
  // Mark manual splits
  return result
}

const DEFAULT_STYLE: StyleProps = {
  highlightColor: '#FFFF00',
  baseColor: '#FFFFFF',
  fontSize: 48,
  fontFamily: 'Arial, sans-serif',
}

export const useSubtitleStore = create<SubtitleStore>()((set, get) => ({
  jobId: null,
  original: null,
  videoMetadata: null,
  session: null,
  style: DEFAULT_STYLE,

  setJob: (jobId, transcript, videoMetadata) => {
    const words: SessionWord[] = transcript.words.map((w) => ({ ...w }))
    const phrases = buildPhrases(words, new Set())
    set({
      jobId,
      original: transcript,
      videoMetadata,
      session: { words, phrases, manualSplitWordIndices: new Set() },
    })
  },

  updateWord: (wordIndex, patch) => {
    set((state) => {
      if (!state.session) return state
      const words = state.session.words.map((w, i) =>
        i === wordIndex ? { ...w, ...patch } : w
      )
      // Recompute phrase boundaries when timestamps change
      const rebuildPhrases = 'start' in patch || 'end' in patch
      const phrases = rebuildPhrases
        ? buildPhrases(words, state.session.manualSplitWordIndices)
        : state.session.phrases.map((p) => ({
            ...p,
            words: p.words.map((pw) => words.find((w) => w.start === pw.start && w.end === pw.end) ?? pw),
          }))
      return { session: { ...state.session, words, phrases } }
    })
  },

  splitPhrase: (phraseIndex, splitBeforeWordIndex) => {
    set((state) => {
      if (!state.session) return state
      const phrases = [...state.session.phrases]
      const target = phrases[phraseIndex]
      if (!target || splitBeforeWordIndex <= 0 || splitBeforeWordIndex >= target.words.length) return state
      const left: SessionPhrase = { words: target.words.slice(0, splitBeforeWordIndex), isManualSplit: false }
      const right: SessionPhrase = { words: target.words.slice(splitBeforeWordIndex), isManualSplit: true }
      phrases.splice(phraseIndex, 1, left, right)
      // Track the global word index for this split
      const globalSplitIdx = phrases.slice(0, phraseIndex).reduce((sum, p) => sum + p.words.length, 0) + splitBeforeWordIndex
      const manualSplitWordIndices = new Set(state.session.manualSplitWordIndices)
      manualSplitWordIndices.add(globalSplitIdx)
      return { session: { ...state.session, phrases, manualSplitWordIndices } }
    })
  },

  mergePhrase: (phraseIndex) => {
    set((state) => {
      if (!state.session || phraseIndex >= state.session.phrases.length - 1) return state
      const phrases = [...state.session.phrases]
      const merged: SessionPhrase = {
        words: [...phrases[phraseIndex].words, ...phrases[phraseIndex + 1].words],
        isManualSplit: false,
      }
      // Remove the manual split that was at this boundary
      const splitWordIdx = phrases.slice(0, phraseIndex + 1).reduce((sum, p) => sum + p.words.length, 0)
      const manualSplitWordIndices = new Set(state.session.manualSplitWordIndices)
      manualSplitWordIndices.delete(splitWordIdx)
      phrases.splice(phraseIndex, 2, merged)
      return { session: { ...state.session, phrases, manualSplitWordIndices } }
    })
  },

  resetSession: () => {
    set((state) => {
      if (!state.original) return state
      const words: SessionWord[] = state.original.words.map((w) => ({ ...w }))
      const phrases = buildPhrases(words, new Set())
      return { session: { words, phrases, manualSplitWordIndices: new Set() } }
    })
  },

  setStyle: (partial) => set((state) => ({ style: { ...state.style, ...partial } })),

  reset: () => set({ jobId: null, original: null, videoMetadata: null, session: null, style: DEFAULT_STYLE }),
}))
```

### PlayerRef SeekTo Pattern
```typescript
// Source: remotion.dev/docs/player/custom-controls (verified via WebFetch 2026-03)
import { useRef, useCallback } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { useSubtitleStore } from '../store/subtitleStore'

export function PreviewPanel() {
  const playerRef = useRef<PlayerRef>(null)
  const videoMetadata = useSubtitleStore((s) => s.videoMetadata)
  // ... existing store subscriptions

  const seekToTime = useCallback((timeSec: number) => {
    if (!playerRef.current || !videoMetadata) return
    const frame = Math.floor(timeSec * videoMetadata.fps)
    playerRef.current.seekTo(frame)
  }, [videoMetadata])

  // Expose seekToTime via prop or Context to transcript editor
  return (
    <>
      <Player ref={playerRef} {/* ...existing props */} />
    </>
  )
}
```

### Inline Word Edit Component
```typescript
// Source: emgoto.com/react-inline-edit (verified 2026-03)
import { useState } from 'react'

interface WordCellProps {
  word: string
  start: number
  end: number
  wordIndex: number
  onUpdateText: (idx: number, text: string) => void
  onSeek: (timeSec: number) => void
}

export function WordCell({ word, start, end, wordIndex, onUpdateText, onSeek }: WordCellProps) {
  const [text, setText] = useState(word)

  return (
    <span className="word-cell" data-start={start} data-end={end}>
      <input
        className="word-cell__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const trimmed = text.trim()
          if (!trimmed) { setText(word); return }
          onUpdateText(wordIndex, trimmed)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
        }}
        onClick={() => onSeek(start)}
      />
    </span>
  )
}
// IMPORTANT: Always provide key={`${wordIndex}-${word}`} on WordCell to reset
// local state when word prop changes externally (e.g. after re-transcription)
```

### Auto-Grouping Algorithm (extracted from SubtitleOverlay.tsx)
```typescript
// Source: packages/remotion-composition/src/SubtitleOverlay.tsx (existing codebase)
// Move to packages/frontend/src/lib/grouping.ts

export const PHRASE_GAP_SEC = 0.3         // from existing implementation
export const MAX_WORDS_PER_PHRASE = 8     // from existing implementation

export function groupIntoPhrases(words: TranscriptWord[]): TranscriptWord[][] {
  if (words.length === 0) return []
  const phrases: TranscriptWord[][] = []
  let current: TranscriptWord[] = [words[0]]

  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end
    const prevEndsPunct = /[.?!]$/.test(words[i - 1].word)
    const atMax = current.length >= MAX_WORDS_PER_PHRASE
    if (gap > PHRASE_GAP_SEC || prevEndsPunct || atMax) {
      phrases.push(current)
      current = [words[i]]
    } else {
      current.push(words[i])
    }
  }
  phrases.push(current)
  return phrases
}
```

### SubtitleComposition Props Update (if using pre-computed phrases)
```typescript
// packages/remotion-composition/src/types.ts (if Option A is chosen — see Open Questions)
import type { TranscriptWord } from '@eigen/shared-types'

export interface TranscriptPhrase {
  words: TranscriptWord[]
}

export interface SubtitleCompositionProps {
  videoSrc: string
  phrases: TranscriptPhrase[]   // replaces words: TranscriptWord[]
  style: StyleProps
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 3: `transcript.words` passed flat to composition | Phase 4: pre-computed `phrases[]` passed to composition | Phase 4 | Composition becomes simpler; grouping logic moves to store |
| `groupIntoPhrases()` inside `SubtitleOverlay.tsx` | `groupIntoPhrases()` in `packages/frontend/src/lib/grouping.ts` | Phase 4 | Single source of truth; store and composition use same logic |
| `TranscriptView` (read-only word list) | `TranscriptEditor` (editable word cells with split/merge) | Phase 4 | TranscriptView can be removed or kept as fallback |
| Zustand store: `transcript: Transcript \| null` | `original: Transcript \| null` + `session: Session \| null` | Phase 4 | Session layer enables user edits without corrupting original |

**Deprecated/outdated after Phase 4:**
- `TranscriptView.tsx`: Replaced by `TranscriptEditor`. Can be deleted after Phase 4 is verified.
- `groupIntoPhrases()` in `SubtitleOverlay.tsx`: Moved to `lib/grouping.ts`. The composition version should be removed to avoid drift.
- `subtitleStore.transcript` field: Renamed to `subtitleStore.original` for clarity. All existing consumers (`SubtitlesPage.tsx`) must update their references.

---

## Open Questions

1. **Should the composition receive `phrases[]` or still receive `words[]`?**
   - What we know: Currently `SubtitleComposition` receives `words: TranscriptWord[]` and `SubtitleOverlay` calls `groupIntoPhrases()` internally. With Phase 4, the store computes phrases.
   - What's unclear: Option A (pass `phrases[]` to composition) is cleaner but requires changing the `SubtitleCompositionProps` interface, which means updating `PreviewPanel`'s `inputProps`. Option B (keep passing `words[]`, store groups separately for editor display only) avoids changing the composition contract but creates two grouping computations.
   - Recommendation: Use **Option A** — pass `phrases: TranscriptPhrase[]` to the composition. It's one source of truth. The composition becomes simpler (no internal grouping logic). The `SubtitleCompositionProps` change is minor and contained.

2. **Where should `seekToTime` live — prop drilling, React Context, or Zustand?**
   - What we know: `playerRef` must be in `PreviewPanel` (it needs to be co-located with `<Player>`). The transcript editor is a sibling. `SubtitlesPage` is the common parent.
   - What's unclear: How many levels deep the seek callback needs to propagate. In Phase 4's structure, it's `SubtitlesPage → TranscriptEditor → PhraseRow → WordCell` — 3 levels.
   - Recommendation: Pass `seekToTime` as a prop from `SubtitlesPage` down. Three levels is not deep enough to warrant Context. Do NOT store it in Zustand (functions with external dependencies should not live in stores).

3. **Should timestamp editing use `<input type="number">` or formatted text (e.g., `"1.23"`)?**
   - What we know: `TranscriptWord.start` and `end` are seconds as floats (e.g., `0.453`). The existing `formatTime()` in `TranscriptView.tsx` renders as `"0:0.5"` (M:S.d format).
   - What's unclear: Whether users prefer raw seconds (`1.234`) or a formatted time display. Number inputs have browser-specific styling quirks in dark mode.
   - Recommendation: Use `<input type="number" step="0.01" min="0">` with `parseFloat` on commit. It's simpler to validate and avoids custom parsing. Display raw seconds — these are editor tools, not consumer-facing.

4. **How should `resetSession` be exposed in the UI?**
   - What we know: `resetSession()` restores session words and phrases from `original`. Phase 4 requirements don't explicitly mention a "reset" button.
   - What's unclear: Whether the planner should include a reset-to-original button in the editor UI, or defer this to a later phase.
   - Recommendation: Implement `resetSession` in the store (Phase 4, plan 04-01) but defer the UI button to Phase 5 or later. The Re-transcribe flow already calls `reset()` then `setJob()` which achieves a full reset.

5. **Should `Set<number>` (for `manualSplitWordIndices`) be serializable?**
   - What we know: `Set` is not JSON-serializable. If Zustand `persist` middleware is ever added, `Set` must be converted to an array.
   - What's unclear: Whether Phase 4 needs persistence.
   - Recommendation: Phase 4 does not add persistence. Use `Set<number>` for O(1) lookup. Document that if persist is added later, serialize as `Array.from(set)`.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read: `packages/remotion-composition/src/SubtitleOverlay.tsx` — existing `groupIntoPhrases()` and `PHRASE_GAP_SEC = 0.3`, `MAX_WORDS_PER_PHRASE = 8` constants
- Codebase direct read: `packages/frontend/src/store/subtitleStore.ts` — current Zustand store shape
- Codebase direct read: `packages/shared-types/src/index.ts` — `TranscriptWord`, `Transcript`, `VideoMetadata` types
- Codebase direct read: `packages/frontend/package.json` — zustand 5.0.11, @remotion/player 4.0.379, React 18.3.1 confirmed installed
- Codebase direct read: `package-lock.json` — immer confirmed NOT installed; it is a zustand peer dep
- `node_modules/zustand/middleware/immer.d.ts` — immer middleware TypeScript signature confirmed
- `node_modules/zustand/middleware/immer.js` — immer middleware wraps `set` with `produce()`; only applies when updater is a function
- WebFetch `remotion.dev/docs/player/custom-controls` — `playerRef.current.seekTo(frame)` API, `PlayerRef` type from `@remotion/player`
- WebFetch `deepwiki.com/pmndrs/zustand/3.6-immer-middleware` — immer middleware usage, `npm install zustand immer` required (immer is a peer dep)

### Secondary (MEDIUM confidence)
- WebFetch `emgoto.com/react-inline-edit` — inline edit pattern: local state + blur-commit + Enter/Escape key handling; verified as working pattern, source is a well-known React tutorial
- WebSearch + WebFetch `remotion.dev/docs/player/player` — `PlayerRef` type, `seekTo(frame)` method signature
- GitHub issue `pmndrs/zustand #1345` — "Cannot find module 'immer'" confirms immer must be installed separately as peer dep

### Tertiary (LOW confidence)
- WebSearch results for transcript editor UI patterns — BBC `react-transcript-editor` reviewed for UI approach; not directly applicable to this project's custom approach
- General React inline edit pattern — well-established, multiple sources agree on blur-commit + Enter/Escape; no single authoritative spec

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from installed node_modules and package.json; no new dependencies needed by default
- Architecture (store design): HIGH — derived from existing codebase; Zustand patterns verified from local node_modules type definitions
- Architecture (grouping algorithm): HIGH — algorithm already exists in `SubtitleOverlay.tsx`; this is extraction and extension, not new code
- Inline edit pattern: HIGH — verified from official React tutorial source; well-established pattern
- PlayerRef seekTo: HIGH — verified from official Remotion docs via WebFetch
- Immer requirement: HIGH — confirmed NOT installed; spread operators adequate for 2-level nesting
- Split/merge algorithm: MEDIUM — designed from requirements; not sourced from a reference implementation; the logic is straightforward but the `manualSplitWordIndices` tracking may need adjustment during implementation

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (Zustand 5 and Remotion 4.x are stable; 30-day window is conservative)
