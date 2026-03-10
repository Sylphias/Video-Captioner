# Phase 07: Text Animation Creator - Research

**Researched:** 2026-03-10
**Domain:** Remotion animation APIs, SQLite preset storage, animation editor UI patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Animation types & parameters**
- Both per-word and per-phrase animations supported — user picks scope per preset
- Full library of transition types: position-based (slide, bounce, fly), opacity + scale (fade, pop, shrink), text-reveal effects (typewriter, letter-by-letter, word cascade, blur reveal)
- Three-phase animation model: **enter → active (hold) → exit**
  - Enter: how the text appears (slide in, fade in, typewriter, etc.)
  - Active: looping animation while phrase is on screen (jiggle, wave, pulse, bounce, etc.)
  - Exit: how the text disappears — mirrored from enter by default, user can override to set a different exit
- Timing: duration + easing picker per phase (ease-in, ease-out, bounce, spring, etc.) — not full keyframe editing

**Preset management**
- Storage: SQLite database (local)
- Ship with 5-10 curated built-in starter presets (e.g., 'Classic Fade', 'Typewriter', 'Slide Up', 'Word Cascade', 'Pop In')
- Organization: flat list with search — no categories/tags needed
- Presets store animation parameters ONLY — visual style (font, colors, stroke, position) stays in the existing StyleDrawer
- Per-phrase override: global default animation preset, but user can override individual phrases with different presets

**Resolution handling**
- Auto-adapt: one preset works for any resolution — animation parameters scale proportionally to frame dimensions
- Font sizing stored as percentage of frame height (not absolute pixels) for cross-resolution consistency
- Same default subtitle positioning for all resolutions — user adjusts manually if needed
- Preview: generic sample (placeholder text on solid background) for fast preset browsing — not rendered on actual video

**Editor experience**
- New "Animation" stage tab added alongside Timing/Text/Styling — part of the editing workflow
- Hybrid editor: visual timeline showing enter/active/exit phases + parameter panel for detailed settings
  - Timeline shows three phase blocks, drag to adjust durations
  - Click a phase to configure its type, easing, and parameters in the side panel
- Live preview updates with ~300ms debounce as user tweaks parameters
- Real-time Remotion Player reflects animation changes after debounce

### Claude's Discretion
- Exact set of built-in starter presets (names, specific parameters)
- SQLite schema design
- Debounce implementation approach
- Active-phase animation loop behavior (seamless loop vs restart)
- Animation timeline visual design

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

This phase adds a full-featured animation system to the existing subtitle editor. The core technical challenge is threefold: (1) implementing frame-accurate enter/active/exit animation logic inside the Remotion `SubtitleOverlay` component using `useCurrentFrame`, `interpolate`, and `spring`; (2) persisting animation presets to SQLite via the Fastify backend; and (3) building a three-phase timeline editor UI in the frontend.

All three domains are well-supported by the existing stack. Remotion 4.0's `interpolate`, `spring`, `Easing`, `useCurrentFrame`, and `useVideoConfig` APIs provide everything needed for resolution-independent animations. The `better-sqlite3` library is the right SQLite choice for the Fastify backend — synchronous API, WAL support, and full TypeScript types via `@types/better-sqlite3`. The existing `StageTabBar` pattern makes adding the "Animation" tab mechanical, and the `StyleDrawer`/`SpeakerStyleOverride` pattern shows how per-phrase overrides should be wired through the store.

**Primary recommendation:** Model animation presets as a new top-level `AnimationPreset` type in `shared-types`. Store params as a JSON TEXT blob in SQLite keyed by preset ID. Apply animations inside `SubtitleOverlay` by computing enter/active/exit progress from `useCurrentFrame`, `useVideoConfig`, and per-phrase timestamps. Expose CRUD via Fastify routes at `/api/presets/*`. Store the active preset ID and per-phrase animation overrides in the Zustand `subtitleStore`.

---

## Standard Stack

### Core (already pinned in the project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `remotion` | 4.0.379 (pinned) | `interpolate`, `spring`, `Easing`, `useCurrentFrame`, `useVideoConfig` | Already the render engine; animation APIs are built in |
| `react` | ^18.3.1 | Animation editor UI components | Already installed |
| `zustand` | ^5.0.11 | Store animation preset selection and per-phrase overrides | Already the state management layer |

### New Dependencies

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | ^9.x (latest) | SQLite database driver for preset storage | Synchronous API fits Node.js single-threaded server model; fastest SQLite option; well-maintained; ESM-compatible via `import Database from 'better-sqlite3'` |
| `@types/better-sqlite3` | ^7.6.x | TypeScript types for better-sqlite3 | DefinitelyTyped; covers all APIs including Statement, Database, Transaction |

### Already Available (no new installation needed)

| Library | Already In | Purpose |
|---------|-----------|---------|
| `interpolate` | `remotion` | Linear/eased animation between frame ranges |
| `spring` | `remotion` | Physics-based (bouncy) animation curves |
| `Easing` | `remotion` | Predefined easing functions (bezier, bounce, elastic, etc.) |
| `useCurrentFrame` | `remotion` | Current frame number for driving animations |
| `useVideoConfig` | `remotion` | `width`, `height`, `fps` for resolution-independent math |
| `fastify-plugin` (`fp`) | `@eigen/backend` | Plugin pattern for decorating Fastify with `db` |

### Installation

```bash
# In packages/backend
npm install better-sqlite3
npm install --save-dev @types/better-sqlite3
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
packages/
├── shared-types/src/
│   └── index.ts                  # Add AnimationPreset, AnimationPhaseParams, AnimationType
│
├── remotion-composition/src/
│   ├── types.ts                  # Expand AnimationType union; add AnimationPreset import
│   ├── SubtitleOverlay.tsx       # Add enter/active/exit animation logic per phrase
│   └── animations.ts             # NEW: pure animation computation helpers
│
├── backend/src/
│   ├── services/
│   │   └── animationPresets.ts   # NEW: SQLite DB init, CRUD operations
│   └── routes/
│       └── presets.ts            # NEW: GET /api/presets, POST, PUT, DELETE
│
└── frontend/src/
    ├── store/
    │   └── subtitleStore.ts      # Add: activeAnimationPresetId, phraseAnimationOverrides
    ├── components/
    │   ├── StageTabBar.tsx       # Add 'animation' stage ID
    │   └── AnimationEditor/
    │       ├── AnimationEditor.tsx     # NEW: main editor container
    │       ├── PhaseTimeline.tsx       # NEW: drag-to-resize three-block timeline
    │       ├── PhasePanel.tsx          # NEW: parameter panel for selected phase
    │       ├── PresetList.tsx          # NEW: searchable flat preset list
    │       └── AnimationPreview.tsx    # NEW: standalone Remotion Player preview
    └── hooks/
        └── useAnimationPresets.ts # NEW: fetch/mutate presets via API
```

### Pattern 1: Frame-Accurate Enter/Active/Exit Animation

**What:** Each phrase's animation phases are computed from its absolute timeline position (phrase start/end in seconds) relative to the current frame. Enter runs from phrase start, exit runs before phrase end, active occupies the middle.

**When to use:** Applied inside `SubtitleOverlay` wherever a phrase is rendered.

**Example:**
```typescript
// Source: Remotion official docs - interpolate(), spring(), useCurrentFrame(), useVideoConfig()
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion'

// Inside SubtitleOverlay, per-phrase animation computation:
function computeAnimationStyles(
  phraseStartSec: number,
  phraseEndSec: number,
  preset: AnimationPreset,
  frame: number,
  fps: number,
  width: number,
  height: number
): React.CSSProperties {
  const currentTimeSec = frame / fps
  const timeIntoPhrase = currentTimeSec - phraseStartSec
  const phraseDuration = phraseEndSec - phraseStartSec

  const enterDuration = preset.enter.durationSec
  const exitDuration = preset.exit.durationSec
  const enterFrames = Math.round(enterDuration * fps)
  const exitFrames = Math.round(exitDuration * fps)
  const frameIntoPhrase = Math.round(timeIntoPhrase * fps)
  const totalPhraseFrames = Math.round(phraseDuration * fps)
  const exitStartFrame = totalPhraseFrames - exitFrames

  if (frameIntoPhrase < enterFrames) {
    // ENTER phase
    const progress = interpolate(frameIntoPhrase, [0, enterFrames], [0, 1], {
      extrapolateRight: 'clamp',
      easing: getEasingFn(preset.enter.easing),
    })
    return applyEnterAnimation(progress, preset.enter, width, height)
  } else if (frameIntoPhrase >= exitStartFrame) {
    // EXIT phase
    const exitFrame = frameIntoPhrase - exitStartFrame
    const progress = interpolate(exitFrame, [0, exitFrames], [0, 1], {
      extrapolateRight: 'clamp',
      easing: getEasingFn(preset.exit.easing),
    })
    return applyExitAnimation(progress, preset.exit, width, height)
  } else {
    // ACTIVE phase — looping
    const activeFrame = frameIntoPhrase - enterFrames
    return applyActiveAnimation(activeFrame, fps, preset.active, width, height)
  }
}
```

### Pattern 2: Resolution-Independent Animation Parameters

**What:** All pixel-valued parameters (slide distance, blur radius) are stored as fractions (0.0–1.0) and multiplied by `width` or `height` at render time.

**When to use:** Every animation that involves a translation, scale, or spatial offset.

**Example:**
```typescript
// Source: Remotion docs - useVideoConfig()
// Slide distance stored as fraction of frame width:
// preset.enter.params.slideDistance = 0.5 means 50% of frame width

const { width, height } = useVideoConfig()
const slideDistancePx = preset.enter.params.slideDistance * width
// translateX from -slideDistancePx to 0 during enter
const x = interpolate(progress, [0, 1], [-slideDistancePx, 0])
```

### Pattern 3: Active-Phase Looping Animation

**What:** The active phase uses a repeating cycle based on the elapsed frame within the active window. A sine wave drives oscillation naturally.

**When to use:** Any active-phase animation (wave, jiggle, pulse).

**Example:**
```typescript
// Source: Remotion docs - Loop component docs + oscillation article
function applyActiveAnimation(
  activeFrame: number,
  fps: number,
  activeParams: ActivePhaseParams,
  height: number
): React.CSSProperties {
  if (activeParams.type === 'none') return {}

  const cycleFrames = Math.round(activeParams.cycleDurationSec * fps)
  const t = (activeFrame % cycleFrames) / cycleFrames // 0–1 normalized within cycle

  if (activeParams.type === 'wave') {
    const amplitude = activeParams.amplitude * height * 0.01 // % of height
    const y = Math.sin(t * 2 * Math.PI) * amplitude
    return { transform: `translateY(${y}px)` }
  }

  if (activeParams.type === 'pulse') {
    const scale = 1 + Math.sin(t * 2 * Math.PI) * activeParams.intensity * 0.05
    return { transform: `scale(${scale})` }
  }

  return {}
}
```

### Pattern 4: Per-Word Stagger (for Word Cascade, Letter-by-Letter)

**What:** When animating word-by-word or letter-by-letter, each unit gets an offset of `unitIndex * staggerFrames` added to its animation start.

**When to use:** `word-cascade`, `typewriter`, `letter-by-letter` enter types.

**Example:**
```typescript
// Source: Remotion docs - spring() delay parameter, Sequence from prop
// Word cascade: word i animates starting at frame (i * staggerFrames)
words.map((word, i) => {
  const wordFrame = Math.max(0, frameIntoPhrase - i * staggerFrames)
  const progress = spring({
    frame: wordFrame,
    fps,
    config: { stiffness: 120, damping: 14, overshootClamping: false },
    durationInFrames: enterFrames,
  })
  const opacity = progress
  const y = interpolate(progress, [0, 1], [20, 0]) // px, resolution-relative
  return { opacity, transform: `translateY(${y}px)` }
})
```

### Pattern 5: Typewriter / Blur Reveal (Phrase-Scope)

**What:** Typewriter clips the rendered text at `Math.floor(progress * totalChars)` characters. Blur reveal interpolates `filter: blur()` from a start value to 0.

**When to use:** `typewriter` enter type, `blur-reveal` enter type.

**Example:**
```typescript
// Typewriter: character slicing
const totalChars = fullText.length
const visibleChars = Math.floor(progress * totalChars)
const displayText = fullText.slice(0, visibleChars)

// Blur reveal:
const blurRadius = interpolate(progress, [0, 1], [8, 0], { extrapolateRight: 'clamp' })
const opacity = interpolate(progress, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' })
// style: { filter: `blur(${blurRadius}px)`, opacity }
```

### Pattern 6: SQLite Preset Storage (Fastify Plugin)

**What:** A Fastify plugin initializes the SQLite database, creates the presets table, and decorates `fastify.db` for use in route handlers. Presets are stored as JSON TEXT blobs.

**When to use:** All preset CRUD routes read and write through `fastify.db`.

**Example:**
```typescript
// Source: better-sqlite3 docs, Fastify plugin fp() pattern (matches existing jobStore.ts style)
import fp from 'fastify-plugin'
import Database from 'better-sqlite3'
import path from 'node:path'
import { DATA_ROOT } from '../index.ts'

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database
  }
}

async function animationPresetsPlugin(fastify: FastifyInstance): Promise<void> {
  const db = new Database(path.join(DATA_ROOT, 'presets.db'))
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS animation_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      params TEXT NOT NULL,       -- JSON blob
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  fastify.decorate('db', db)
  fastify.addHook('onClose', (_instance, done) => {
    db.close()
    done()
  })
}

export default fp(animationPresetsPlugin)
```

### Pattern 7: Debounce for Live Preview

**What:** Changes to animation parameters update a debounced state value (300ms) that drives the Remotion Player. Raw state updates immediately for UI responsiveness; the Player only re-renders after the user stops typing.

**When to use:** All parameter panel inputs in `PhasePanel.tsx`.

**Example:**
```typescript
// Source: React useRef + setTimeout pattern (standard, verified across multiple sources)
import { useRef, useState, useEffect } from 'react'

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

// Usage in AnimationEditor:
const [editingParams, setEditingParams] = useState(preset.params)
const debouncedParams = useDebounced(editingParams, 300)
// Pass debouncedParams to the Remotion Player composition props
```

### Anti-Patterns to Avoid

- **CSS transitions for Remotion animations:** CSS transitions are not frame-accurate. Remotion renders each frame independently — always use `interpolate`/`spring` driven by `useCurrentFrame`. CSS transitions only apply in the browser preview and are skipped during render.
- **Storing pixel values in presets:** Don't store slide distances as px values. The preset will break at different resolutions. Use fractions (0.0–1.0) multiplied by `width`/`height` from `useVideoConfig` at render time.
- **Async SQLite:** The `better-sqlite3` API is synchronous by design. Never wrap it in fake async patterns. Fastify routes will return the result directly.
- **Rebuilding presets from scratch per frame:** Put animation computation helpers in `animations.ts` as pure functions. `SubtitleOverlay` calls them. Don't embed complex logic inline in JSX.
- **Shadowing the existing `AnimationType` union:** The existing `types.ts` in `remotion-composition` already has `export type AnimationType = 'none' | 'pop' | 'slide-up' | 'bounce'` used by `SpeakerStyleOverride`. The new `AnimationPreset` system replaces and extends this — the old union must be updated or removed to avoid confusion.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Physics-based animation curves | Custom spring math | `spring()` from `remotion` | Remotion's spring handles FPS normalization, overshoot clamping, duration stretching |
| Easing functions | Hand-written bezier/bounce math | `Easing` module from `remotion` | Covers all standard CSS easings + elastic, back, bounce — same API as React Native |
| Multi-point interpolation | Chain of if/else progress math | `interpolate()` multi-stop | Supports N-point input/output arrays cleanly |
| SQLite async wrapper | Promise wrapper around DB calls | `better-sqlite3` sync API directly | It is already synchronous; wrapping adds complexity |
| Database connection lifecycle | Manual open/close | Fastify `onClose` hook | Matches existing `jobStore.ts` lifecycle pattern |
| Frame modulo for loops | Custom loop accumulator | `frame % cycleFrames` with `Math.sin` / `Math.cos` | Simple and sufficient; `Loop` component is for Sequence-based use, not inline math |

**Key insight:** Remotion's animation primitives (`interpolate`, `spring`, `Easing`) handle all the math complexity. The implementation work is wiring them together correctly with frame/FPS timing, not writing animation math from scratch.

---

## Common Pitfalls

### Pitfall 1: Conflicting AnimationType in types.ts

**What goes wrong:** The existing `types.ts` in `remotion-composition` exports `AnimationType = 'none' | 'pop' | 'slide-up' | 'bounce'` used in `SpeakerStyleOverride.animationType`. The new phase introduces a full `AnimationPreset` object. If both exist simultaneously, code will be confused about which system to use and which type drives what.

**Why it happens:** The old `AnimationType` was a placeholder (4 values). The new system replaces it with a full preset object reference (a preset ID string stored on a phrase, resolved to an `AnimationPreset` at render time).

**How to avoid:** As part of this phase, remove the old `AnimationType` union and `animationType?: AnimationType` field from `SpeakerStyleOverride`. Replace with `animationPresetId?: string` on `TranscriptPhrase` in shared-types. Update `PhraseStylePanel.tsx` (which currently renders the old `animationType` dropdown) to point to the new preset picker.

**Warning signs:** TypeScript compiler error `Type 'string' is not assignable to type 'AnimationType'` in render code, or two separate animation dropdowns appearing in the UI.

### Pitfall 2: Enter+Exit Frames Exceeding Phrase Duration

**What goes wrong:** A preset has `enter.durationSec = 0.5` and `exit.durationSec = 0.5`, but the phrase lasts only 0.7 seconds. The enter and exit windows overlap, causing phase logic to pick one arbitrarily and produce a jarring cut.

**Why it happens:** Presets are defined generically; they don't know the phrase they'll be applied to. Short phrases expose this.

**How to avoid:** In `computeAnimationStyles`, clamp enter/exit durations so `enterFrames + exitFrames <= totalPhraseFrames`. Use `Math.min`:
```typescript
const maxEnterFrames = Math.floor(totalPhraseFrames * 0.45)
const maxExitFrames = Math.floor(totalPhraseFrames * 0.45)
const enterFrames = Math.min(Math.round(preset.enter.durationSec * fps), maxEnterFrames)
const exitFrames = Math.min(Math.round(preset.exit.durationSec * fps), maxExitFrames)
```

**Warning signs:** Subtitle text flickers or vanishes mid-word on short phrases.

### Pitfall 3: better-sqlite3 Native Addon + Node.js --experimental-strip-types

**What goes wrong:** The backend uses `node --watch --experimental-strip-types` (no compilation step). `better-sqlite3` is a native Node.js addon (`.node` binary). Native addons load fine with `--experimental-strip-types`; the flag only affects TypeScript syntax stripping. However, if the npm install didn't build the native binary (e.g., mismatched Node.js version), the import will throw a cryptic `Cannot find module` or `invalid ELF header` error.

**Why it happens:** `better-sqlite3` ships prebuilt binaries for LTS Node versions. If the project Node version doesn't match the prebuilt binary, `npm install` may attempt and fail to compile from source (requires `node-gyp`/Python/build tools).

**How to avoid:** Run `npm install better-sqlite3` in `packages/backend` — npm will pull the prebuilt binary for the current Node version. Verify it loads with a quick test script before building the plugin. If the prebuilt binary fails, run `npm rebuild better-sqlite3`.

**Warning signs:** Server crash at startup with `Error: Cannot find module '.../better-sqlite3/build/Release/better_sqlite3.node'`.

### Pitfall 4: ESM Import Syntax for better-sqlite3

**What goes wrong:** Using `import Database from 'better-sqlite3'` may trigger a `default import` TypeScript error because the CJS module doesn't have `default` in its types.

**Why it happens:** `better-sqlite3` is a CommonJS module; TypeScript's `esModuleInterop` flag controls whether `import X from 'cjs-module'` works.

**How to avoid:** The backend `tsconfig.json` likely already has `esModuleInterop: true` (standard for mixed ESM/CJS projects). Confirm it's set. If not, use: `import { default as Database } from 'better-sqlite3'` or ensure the tsconfig includes `"esModuleInterop": true, "allowSyntheticDefaultImports": true`.

**Warning signs:** TypeScript error `Module ... has no exported member 'default'` or similar.

### Pitfall 5: Remotion Player Preview Composition Props Change on Every Render

**What goes wrong:** The `AnimationPreview` component passes animation params as inline object literals to the Remotion Player's `inputProps`. React sees a new object reference every render, triggering unnecessary Player re-renders even without debounce.

**Why it happens:** Object identity: `{ ...preset }` creates a new object each render.

**How to avoid:** Memoize `inputProps` with `useMemo` keyed on `debouncedParams`:
```typescript
const inputProps = useMemo(() => ({
  animationPreset: debouncedParams,
  sampleText: 'Sample subtitle text',
}), [debouncedParams])
```

**Warning signs:** Player flickers constantly while user types in parameter fields.

### Pitfall 6: Per-Word Animation Scope Requires Word-Level Rendering

**What goes wrong:** The current `SubtitleOverlay` renders words as inline `<span>` elements for karaoke coloring. Word-scope animations (word cascade, letter-by-letter) need each unit to have independent transform/opacity styles. If all words share a single container `transform`, the stagger can't be applied per-word.

**Why it happens:** The existing span structure was designed for karaoke coloring (whole-phrase container + individual word spans). Adding transforms to individual spans works, but only if the animation system knows to operate at word scope vs. phrase scope.

**How to avoid:** The `AnimationPreset.scope` field (`'phrase' | 'word'`) determines rendering mode. When `scope === 'word'`, apply `computeWordAnimationStyle(wordIndex, ...)` to each `<span>` individually. When `scope === 'phrase'`, wrap the phrase container with the animation styles.

**Warning signs:** All words animate simultaneously instead of staggered, or transforms affect the entire phrase block instead of individual words.

---

## Code Examples

Verified patterns from official sources:

### Basic interpolate + Easing for enter animation

```typescript
// Source: https://www.remotion.dev/docs/interpolate
import { interpolate, Easing } from 'remotion'

// Ease-out slide-up: starts fast, slows to final position
const progress = interpolate(frameIntoEnter, [0, enterFrames], [0, 1], {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
  easing: Easing.out(Easing.cubic),
})
const yOffset = interpolate(progress, [0, 1], [40, 0]) // px, use % of height in practice
const opacity = progress
// style: { transform: `translateY(${yOffset}px)`, opacity }
```

### Spring-based pop animation

```typescript
// Source: https://www.remotion.dev/docs/spring
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'

const frame = useCurrentFrame()
const { fps } = useVideoConfig()

// "Pop" — scale from 0 to 1 with slight bounce
const scale = spring({
  frame: frameIntoEnter,
  fps,
  config: {
    stiffness: 180,
    damping: 12,
    overshootClamping: false, // allow slight bounce
  },
  durationInFrames: enterFrames,
})
// style: { transform: `scale(${scale})`, opacity: scale > 0.01 ? 1 : 0 }
```

### Easing module reference

```typescript
// Source: https://www.remotion.dev/docs/easing
import { Easing } from 'remotion'

// Available easing constructors:
Easing.linear          // t => t
Easing.quad            // t => t*t
Easing.cubic           // t => t*t*t
Easing.ease            // built-in inertial ease
Easing.bounce          // bouncing effect
Easing.elastic(1.7)    // spring-like overshoot
Easing.back(1.5)       // slight backward pull before forward
Easing.bezier(x1, y1, x2, y2)  // CSS cubic-bezier equivalent
// Modifiers:
Easing.in(Easing.cubic)    // ease-in
Easing.out(Easing.cubic)   // ease-out
Easing.inOut(Easing.cubic) // ease-in-out
```

### useVideoConfig for resolution-independent params

```typescript
// Source: https://www.remotion.dev/docs/use-video-config
import { useVideoConfig } from 'remotion'

const { width, height, fps } = useVideoConfig()

// Store: preset.enter.params.slideOffsetFraction = 0.3
// At render: 0.3 * width = 30% of frame width in pixels
const slideDistancePx = preset.enter.params.slideOffsetFraction * width

// Font size as % of height (locked decision):
// preset.fontSizeFraction = 0.06 => 6% of frame height
const fontSizePx = preset.fontSizeFraction * height
```

### better-sqlite3 CRUD pattern

```typescript
// Source: https://github.com/WiseLibs/better-sqlite3
import Database from 'better-sqlite3'

const db = new Database('/path/to/presets.db')
db.pragma('journal_mode = WAL')

// Prepared statements — run once, reuse
const insertPreset = db.prepare(`
  INSERT INTO animation_presets (id, name, is_builtin, params, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`)

const getAll = db.prepare(`SELECT * FROM animation_presets ORDER BY created_at ASC`)
const getById = db.prepare(`SELECT * FROM animation_presets WHERE id = ?`)
const deleteById = db.prepare(`DELETE FROM animation_presets WHERE id = ?`)

// Usage (synchronous):
const all = getAll.all()                            // returns row[]
const one = getById.get(id)                         // returns row | undefined
insertPreset.run(id, name, 0, JSON.stringify(params), Date.now(), Date.now())
deleteById.run(id)
```

### Debounce hook pattern (React)

```typescript
// Source: verified across multiple React docs and blog sources
import { useRef, useState, useEffect } from 'react'

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `AnimationType = 'none' \| 'pop' \| 'slide-up' \| 'bounce'` (stub) | Full `AnimationPreset` with enter/active/exit phases and SQLite persistence | Replace the stub; the old type lives in `types.ts` and must be removed |
| CSS transitions for preview animations | `interpolate`/`spring` driven by `useCurrentFrame` | CSS transitions don't render correctly in Remotion server-side renders |
| No animation tab | "Animation" added as 3rd stage tab in `StageTabBar` | `StageId` union expands to `'timing' \| 'text' \| 'animation'` |
| In-memory job store (Map) | SQLite via `better-sqlite3` for durable preset storage | Different from jobs (ephemeral, in-memory); presets persist across restarts |

**Deprecated/outdated:**
- `AnimationType` union in `types.ts`: The 4-value stub is replaced by `animationPresetId?: string` on `TranscriptPhrase`. Remove after this phase.
- `animationType?: AnimationType` in `SpeakerStyleOverride`: Remove; per-phrase animation is now handled through `animationPresetId` on the phrase itself.

---

## Open Questions

1. **How does the Animation stage relate to the StyleDrawer?**
   - What we know: StyleDrawer opens from buttons (global, speaker, phrase) in the Timing and Text stages. Animation is a separate stage tab.
   - What's unclear: Does clicking "edit phrase animation" in the new Animation stage tab open the StyleDrawer in phrase mode, or does it open an inline animation picker? The CONTEXT says "per-phrase override follows the same pattern as existing per-speaker style overrides in the StyleDrawer."
   - Recommendation: For per-phrase animation override, add an "Animation Preset" field to the existing `PhraseStylePanel` inside StyleDrawer (alongside the font/color overrides). The Animation stage tab is the preset management/editing UI. This avoids two separate UX surfaces for phrase-level configuration.

2. **Should built-in presets be stored in SQLite or hardcoded?**
   - What we know: Built-in presets must ship with the app. SQLite is ephemeral to the local data directory.
   - What's unclear: If the user deletes the presets.db file, built-in presets disappear.
   - Recommendation: Hardcode built-in presets as a `BUILTIN_PRESETS` constant in `animationPresets.ts`. Seed them into SQLite on startup only if the table is empty OR if any built-in preset IDs are missing. Mark them `is_builtin = 1` (read-only in the UI).

3. **How is the active global animation preset stored?**
   - What we know: "global default animation preset" implies one preset applies to all phrases unless overridden. Per-phrase override is stored on the phrase.
   - What's unclear: Where does the global preset ID live? In the Zustand store (ephemeral) or in a `settings` table in SQLite (persistent)?
   - Recommendation: Store `activeAnimationPresetId` in Zustand (matches current pattern: style settings live in the store, not persisted). SQLite stores the preset definitions; the active selection is a session setting.

---

## SQLite Schema (Claude's Discretion — Recommended Design)

```sql
-- animation_presets table
CREATE TABLE IF NOT EXISTS animation_presets (
  id          TEXT PRIMARY KEY,    -- uuid
  name        TEXT NOT NULL,       -- display name, e.g., "Classic Fade"
  is_builtin  INTEGER NOT NULL DEFAULT 0,  -- 1 = read-only built-in
  params      TEXT NOT NULL,       -- JSON blob (AnimationPresetParams)
  created_at  INTEGER NOT NULL,    -- Date.now()
  updated_at  INTEGER NOT NULL
);

-- No separate settings table; active preset ID lives in frontend Zustand store
```

**params JSON shape:**
```json
{
  "scope": "phrase",
  "enter": {
    "type": "slide-up",
    "durationSec": 0.3,
    "easing": "ease-out-cubic",
    "params": { "slideOffsetFraction": 0.15 }
  },
  "active": {
    "type": "none",
    "cycleDurationSec": 1.0,
    "amplitude": 0
  },
  "exit": {
    "mirrorEnter": true,
    "type": "slide-down",
    "durationSec": 0.3,
    "easing": "ease-in-cubic",
    "params": { "slideOffsetFraction": 0.15 }
  }
}
```

---

## Recommended Built-In Starter Presets (Claude's Discretion)

| Preset Name | Enter | Active | Exit | Scope |
|-------------|-------|--------|------|-------|
| Classic Fade | fade (opacity 0→1, 0.3s, ease-out) | none | fade (mirror, 0.2s) | phrase |
| Slide Up | translate Y 15% height → 0, opacity 0→1, 0.25s, ease-out-cubic | none | mirror | phrase |
| Pop In | spring scale 0→1 (stiffness:180, damping:12), 0.35s | none | scale 1→0, 0.2s, ease-in | phrase |
| Word Cascade | per-word: opacity+translateY, 3-frame stagger, spring | none | fade all (0.2s) | word |
| Typewriter | character slice progress, linear, 0.8s | cursor blink (pulse, 0.5s cycle) | fade (0.15s) | phrase |
| Blur Reveal | blur 8px→0 + opacity 0→1, 0.4s, ease-out | none | mirror | phrase |
| Jiggle Pop | spring scale pop (0.3s) | wave Y ±2% height, 0.6s cycle | fade (0.15s) | phrase |

---

## Sources

### Primary (HIGH confidence)
- `https://www.remotion.dev/docs/interpolate` — `interpolate()` API, all options, easing, multi-stop examples
- `https://www.remotion.dev/docs/spring` — `spring()` API, all config params (mass, damping, stiffness, overshootClamping, durationInFrames, delay)
- `https://www.remotion.dev/docs/easing` — Full `Easing` module with all functions and modifiers
- `https://www.remotion.dev/docs/animating-properties` — Core animation patterns with `useCurrentFrame`
- `https://www.remotion.dev/docs/sequence` — `<Sequence>` from/durationInFrames time-shifting behavior
- `https://www.remotion.dev/docs/loop` — `<Loop>` component props + `useLoop()` hook
- `https://www.remotion.dev/docs/use-video-config` — `useVideoConfig()` return values: width, height, fps, durationInFrames
- Codebase read: `/packages/remotion-composition/src/types.ts` — existing `AnimationType` stub; must be replaced
- Codebase read: `/packages/remotion-composition/src/SubtitleOverlay.tsx` — current rendering model for phrases/words
- Codebase read: `/packages/frontend/src/components/StageTabBar.tsx` — `StageId` union; add 'animation'
- Codebase read: `/packages/frontend/src/store/subtitleStore.ts` — existing override patterns (`setPhraseStyle`, `SpeakerStyleOverride`)
- Codebase read: `/packages/backend/src/services/jobStore.ts` — Fastify plugin pattern (`fp`, `decorate`)

### Secondary (MEDIUM confidence)
- `https://github.com/WiseLibs/better-sqlite3` + npm discussion — ESM import syntax, WAL pragma, TypeScript via `@types/better-sqlite3@7.6.13`; confirmed by npm page
- `https://github.com/WiseLibs/better-sqlite3/discussions/1245` — Node.js 22 compatibility confirmed; production-ready vs. experimental native SQLite
- `https://www.npmjs.com/package/@types/better-sqlite3` — Version 7.6.13, covers all APIs, 90% health score
- React debounce `useRef + setTimeout` pattern — verified across multiple authoritative sources (dmitripavlutin.com, logrocket.com)

### Tertiary (LOW confidence — for reference only)
- `https://remotion-bits.dev/docs/reference/animated-text/` — AnimatedText component (third-party library, not used directly but pattern-referenced for stagger approach)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries either already installed or well-documented
- Animation APIs: HIGH — verified against official Remotion docs
- SQLite pattern: HIGH — verified against better-sqlite3 source and npm
- Architecture: HIGH — directly based on codebase reading of existing patterns
- UI patterns: MEDIUM — timeline drag UI is custom, no off-the-shelf component prescribed
- Built-in presets: MEDIUM (Claude's Discretion) — names and params are recommendations, not verified

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (Remotion 4.x pinned, stable; better-sqlite3 stable)
