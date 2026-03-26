# Phase 8: Keyframe Position Animation - Research

**Researched:** 2026-03-14
**Domain:** Keyframe animation engine, motion builder UI, cubic bezier easing, SQLite schema migration
**Confidence:** HIGH (core engine, DB schema); MEDIUM (UI drag interaction patterns)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Keyframe model
- Keyframeable properties: position (x%, y%), scale, rotation, opacity — full motion graphics control
- Keyframes extend the existing enter/hold/exit phase model — phases define transition type (fade, slide), keyframes add per-property animation within each phase
- Reusable motion templates stored as part of AnimationPreset — not per-phrase keyframe sequences
- Keyframe time is relative to phrase lifetime (0%–100% implied by living within enter/hold/exit phases)
- Same SQLite presets table — extend with keyframe columns, one unified preset system

#### Animation Builder page
- New top-level page/tab (alongside Subtitles) — not inside the subtitle editor
- Standalone — accessible without a loaded video project
- Preview area with draggable text — set position keyframes by dragging text on the preview (After Effects style)
- Timeline below preview shows all keyframes across properties
- Editable sample text — user can type custom preview text
- Switchable aspect ratio preview: 16:9, 9:16, 1:1 — design motion for different video formats
- Toggleable motion path overlay on preview — dotted line connecting keyframe positions

#### Easing controls
- Preset easing curves (linear, ease-in, ease-out, ease-in-out, bounce, elastic) plus custom cubic bezier editor
- Easing set per-property — position, scale, rotation, opacity each have independent easing between keyframe pairs
- Preset curves show visual curve thumbnails in the dropdown

#### Subtitle Animation tab
- Remains lightweight — pick a preset, tweak speed/intensity with a simple slider
- Full keyframe editing happens in the Animation Builder page, not in the subtitle context
- Existing built-in presets will be extended with keyframe data (not a separate preset set)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope

</user_constraints>

---

## Summary

This phase adds a keyframe data layer on top of the existing `AnimationPreset` system. The compute engine (`animations.ts`) already uses `interpolate()` from Remotion, which natively accepts arrays of more than 2 keyframe values — so the interpolation engine itself needs no new library. The primary work is: (1) defining the `MotionKeyframe` / `KeyframeTrack` TypeScript model and storing it as a new JSON column in the existing `animation_presets` SQLite table; (2) extending `computeAnimationStyles` to read keyframe tracks and produce additional `transform`/`opacity` CSS during the active phase; and (3) building the Animation Builder page — a new top-level tab in `App.tsx` with a Remotion `<Player>`-based preview canvas, a drag-to-position interaction layer, a multi-property keyframe timeline, and a per-property cubic bezier editor.

The existing `mergeStyles()` helper in `animations.ts` already handles combining multiple CSS `transform` strings, which is exactly the integration point for keyframe-driven position/scale/rotation. The only new npm dependency needed is `bezier-easing` for evaluating custom cubic bezier curves at arbitrary t values in `animations.ts` (Remotion's `Easing.bezier()` can only be used inside `interpolate()`, but we need to evaluate bezier curves outside that context for per-property easing). The cubic bezier editor UI is ~100 lines of custom SVG + pointer events — no library needed there.

**Primary recommendation:** Store keyframe tracks as a `keyframes` JSON column (nullable, backward-compatible `ALTER TABLE`), compute them in `animations.ts` as a separate pass that produces an additional CSS properties object merged via the existing `mergeStyles()`, and build the Animation Builder page as a standalone React page added to `App.tsx`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `remotion` | 4.0.379 (existing) | `interpolate()` for multi-keyframe timeline interpolation | Already installed; natively handles N-point keyframe arrays |
| `bezier-easing` | ^2.1.0 | Evaluate custom cubic bezier at arbitrary t outside `interpolate()` | Smallest correct implementation of CSS cubic-bezier spec; same lib CSS transitions use internally |
| `better-sqlite3` | existing | SQLite column migration via `ALTER TABLE ... ADD COLUMN` | Already installed; synchronous API makes migration idempotent on startup |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@remotion/player` | 4.0.379 (existing) | Animation Builder preview canvas | Already installed for AnimationPreview component |
| Zustand | ^5.0.11 (existing) | Local state for Animation Builder (selected keyframe, aspect ratio, etc.) | Keep consistent with the rest of the frontend |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `bezier-easing` | `Easing.bezier()` from Remotion | `Easing.bezier()` only works as the `easing` option inside `interpolate()` — cannot evaluate it at arbitrary t for the per-segment interpolation pattern we need |
| Custom SVG bezier editor | `bezier-easing-editor` npm package | The npm package (gre/bezier-easing-editor) has stale React class component syntax and React 15 peer deps; simpler to write ~120 lines of SVG + pointer events |
| Pointer events for drag | `react-draggable` / Framer Motion drag | No new dependency; `pointerdown` + `setPointerCapture` + `pointermove` is well-supported and sufficient for the drag-to-position feature |

**Installation:**
```bash
# From packages/remotion-composition (used in animations.ts)
npm install bezier-easing
# No other new dependencies
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/
├── shared-types/src/index.ts              # Add MotionKeyframe, KeyframeTrack types
├── remotion-composition/src/
│   ├── animations.ts                       # Add computeKeyframeStyles(), update computeAnimationStyles()
│   └── index.ts                           # Export new types if needed
├── backend/src/services/
│   └── animationPresets.ts                # Add DB migration for keyframes column
├── frontend/src/
│   ├── App.tsx                            # Add 'animation-builder' tab
│   ├── pages/
│   │   └── AnimationBuilderPage.tsx       # New top-level page
│   └── components/
│       └── AnimationBuilder/
│           ├── AnimationBuilderPage.tsx   # Root layout: preview + timeline
│           ├── KeyframePreview.tsx        # Remotion Player + draggable text overlay
│           ├── KeyframeTimeline.tsx       # Multi-property timeline strip
│           ├── KeyframeTrackRow.tsx       # Single property row with keyframe diamonds
│           ├── BezierEditor.tsx           # SVG cubic bezier curve editor
│           ├── EasingPicker.tsx           # Dropdown with preset thumbnails + custom
│           └── MotionPathOverlay.tsx      # SVG dotted line overlay on preview
```

### Pattern 1: Multi-Keyframe Interpolation in animations.ts

**What:** `interpolate()` from Remotion accepts input arrays of any length. A 4-keyframe animation at 0%, 30%, 70%, 100% of phrase lifetime becomes a straightforward call.

**When to use:** During `computeAnimationStyles` for the keyframe pass on a phrase's position/scale/rotation/opacity.

**Example:**
```typescript
// Source: https://www.remotion.dev/docs/interpolate
// interpolate() accepts N-point keyframe arrays natively
import { interpolate } from 'remotion'
import BezierEasing from 'bezier-easing'

// phraseProgress: 0.0 -> 1.0 within phrase lifetime
function interpolateKeyframeTrack(
  phraseProgress: number,
  track: KeyframeTrack,
): number {
  const times = track.keyframes.map((kf) => kf.time)   // e.g. [0, 0.3, 0.7, 1.0]
  const values = track.keyframes.map((kf) => kf.value) // e.g. [50, 20, 80, 50]

  // Use native Remotion interpolate for the value interpolation
  // but we need per-segment easing — must compute manually for custom bezier
  if (track.keyframes.length < 2) return values[0] ?? 0

  // Find which segment we're in
  const segIdx = findSegment(times, phraseProgress)
  const t0 = times[segIdx]
  const t1 = times[segIdx + 1]
  const v0 = values[segIdx]
  const v1 = values[segIdx + 1]
  const easing = track.easings[segIdx]  // per-segment easing

  const segProgress = t1 === t0 ? 1 : (phraseProgress - t0) / (t1 - t0)
  const easedProgress = applyEasing(segProgress, easing)

  return v0 + (v1 - v0) * easedProgress
}

function applyEasing(t: number, easing: KeyframeEasing): number {
  if (easing.type === 'linear') return t
  if (easing.type === 'ease-in') return Easing.in(Easing.ease)(t)
  if (easing.type === 'bezier') {
    const fn = BezierEasing(easing.p1x, easing.p1y, easing.p2x, easing.p2y)
    return fn(t)
  }
  // ... other preset easings
  return t
}
```

### Pattern 2: Keyframe Data Model in shared-types

**What:** Store keyframe tracks as a new optional property on `AnimationPreset`. Backward-compatible — existing presets have no `keyframeTracks` and use the existing enter/active/exit system.

**When to use:** All callers of `computeAnimationStyles` pass the full `AnimationPreset` — no call-site changes needed beyond the engine reading the new field.

**Example:**
```typescript
// Source: codebase analysis + locked decisions
// In packages/shared-types/src/index.ts

export type KeyframeableProperty = 'x' | 'y' | 'scale' | 'rotation' | 'opacity'

export type KeyframeEasingType =
  | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  | 'ease-in-cubic' | 'ease-out-cubic' | 'ease-in-out-cubic'
  | 'bounce' | 'elastic'

export interface CubicBezierEasing {
  type: 'bezier'
  p1x: number  // 0-1
  p1y: number  // unconstrained (allows overshoot)
  p2x: number  // 0-1
  p2y: number  // unconstrained
}

export type KeyframeEasing = { type: KeyframeEasingType } | CubicBezierEasing

export interface MotionKeyframe {
  time: number    // 0.0-1.0, fraction of phrase lifetime
  value: number   // units depend on property: % for x/y, multiplier for scale, degrees for rotation, 0-1 for opacity
}

export interface KeyframeTrack {
  property: KeyframeableProperty
  keyframes: MotionKeyframe[]
  easings: KeyframeEasing[]   // length = keyframes.length - 1 (one per segment between pairs)
}

// Extend AnimationPreset — keyframeTracks is optional for backward compatibility
export interface AnimationPreset {
  // ... existing fields ...
  keyframeTracks?: KeyframeTrack[]  // ADD: optional, undefined = no keyframe animation
}
```

### Pattern 3: SQLite Schema Migration — ADD COLUMN (idempotent on startup)

**What:** `ALTER TABLE animation_presets ADD COLUMN keyframes TEXT` — SQLite supports adding nullable columns without rebuilding the table. Run idempotently on every startup using a try/catch or `PRAGMA table_info`.

**When to use:** In `animationPresetsPlugin` startup code, before seeding built-in presets.

**Example:**
```typescript
// Source: SQLite official docs + better-sqlite3 synchronous API
// In packages/backend/src/services/animationPresets.ts

// Run migration once — idempotent with try/catch
function migrateDb(db: Database.Database): void {
  // Check if column exists (SQLite 3.x PRAGMA table_info)
  const cols = db.pragma('table_info(animation_presets)') as Array<{ name: string }>
  const hasKeyframes = cols.some((c) => c.name === 'keyframes')
  if (!hasKeyframes) {
    db.exec(`ALTER TABLE animation_presets ADD COLUMN keyframes TEXT`)
  }
}
```

### Pattern 4: Drag-to-Position on Preview Canvas

**What:** The Animation Builder preview has an absolutely-positioned text element. On `pointerdown`, capture the pointer (`setPointerCapture`), track `pointermove` to compute new x%/y% relative to the container bounding rect, record a keyframe at the current playhead time.

**When to use:** Dragging text in the preview canvas at a specific playhead position creates/updates a position keyframe.

**Example:**
```typescript
// Source: pointer events MDN + codebase analysis
// In KeyframePreview.tsx

function handleTextPointerDown(e: React.PointerEvent<HTMLDivElement>) {
  e.currentTarget.setPointerCapture(e.pointerId)
  setIsDragging(true)
}

function handleTextPointerMove(e: React.PointerEvent<HTMLDivElement>) {
  if (!isDragging) return
  const rect = containerRef.current!.getBoundingClientRect()
  const xPct = ((e.clientX - rect.left) / rect.width) * 100
  const yPct = ((e.clientY - rect.top) / rect.height) * 100
  // Record/update keyframe at current playhead fractional time
  onKeyframeUpdate('x', clamp(xPct, 0, 100))
  onKeyframeUpdate('y', clamp(yPct, 0, 100))
}
```

### Pattern 5: Switchable Aspect Ratio in Remotion Player

**What:** `compositionWidth` and `compositionHeight` are regular React props on `<Player>`. Changing them triggers a re-mount of the player (new key needed to avoid stale state). Use a `key` prop on the Player tied to the aspect ratio selection.

**When to use:** When user clicks 16:9 / 9:16 / 1:1 toggle in Animation Builder.

**Example:**
```typescript
// Source: https://www.remotion.dev/docs/player/player (compositionWidth/Height are props)
const ASPECT_RATIOS = {
  '16:9': { width: 640, height: 360 },
  '9:16': { width: 360, height: 640 },
  '1:1':  { width: 480, height: 480 },
}

// key forces remount when dimensions change — avoids stale Player state
<Player
  key={aspectRatio}
  compositionWidth={ASPECT_RATIOS[aspectRatio].width}
  compositionHeight={ASPECT_RATIOS[aspectRatio].height}
  // ...
/>
```

### Pattern 6: Cubic Bezier Editor — SVG + Pointer Events

**What:** An SVG with fixed end-points at (0,0) and (1,1), two draggable control point handles at (p1x, p1y) and (p2x, p2y). Track pointer movement relative to SVG bounding rect to update the 4 bezier values. Render curve as SVG `<path d="...">` using cubic bezier C command.

**When to use:** When user selects "Custom" easing in the EasingPicker dropdown.

**Example:**
```typescript
// Source: codebase analysis — ~120 lines of SVG
// SVG coordinate space: 0-100 maps to normalized 0-1 bezier space
// The curve: M 0,100 C p1x*100,(1-p1y)*100 p2x*100,(1-p2y)*100 100,0
// (Y is flipped because SVG y-axis points down)

function BezierEditor({ p1x, p1y, p2x, p2y, onChange }) {
  const svgRef = useRef<SVGSVGElement>(null)

  function handleControlPointDrag(which: 'p1' | 'p2', e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    // pointermove updates the corresponding px/py
  }

  const curvePath = `M 0,100 C ${p1x*100},${(1-p1y)*100} ${p2x*100},${(1-p2y)*100} 100,0`

  return (
    <svg ref={svgRef} viewBox="0 0 100 100" width={160} height={160}>
      <path d={curvePath} stroke="blue" fill="none" />
      {/* Control handles */}
      <line x1={0} y1={100} x2={p1x*100} y2={(1-p1y)*100} stroke="gray" />
      <circle
        cx={p1x*100} cy={(1-p1y)*100} r={5}
        onPointerDown={(e) => handleControlPointDrag('p1', e)}
      />
      {/* p2 handle similarly */}
    </svg>
  )
}
```

### Anti-Patterns to Avoid

- **Storing keyframes as per-phrase data in the subtitle store:** The locked decision is reusable motion templates in `AnimationPreset`. Per-phrase keyframe sequences are not in scope.
- **Re-implementing interpolation from scratch:** Remotion's `interpolate()` handles multi-point arrays natively. Use it for all preset easing types; only use `bezier-easing` for custom cubic bezier.
- **Putting keyframe editing inside the Subtitles page:** The locked decision places the full keyframe editor in a new top-level Animation Builder page.
- **Using `Easing.bezier()` outside `interpolate()`:** Remotion's `Easing.bezier()` returns a function `(t) => number`, so it technically could be called directly — but `bezier-easing` is the canonical, tested library for this and should be used for all custom bezier evaluation to avoid subtle precision issues with Remotion's internal implementation.
- **Using a key prop on `<Player>` for anything other than aspect ratio changes:** Re-mounting the player on every edit would be expensive; only remount on aspect ratio change.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cubic bezier evaluation at arbitrary t | Custom Newton-Raphson bezier solver | `bezier-easing` (gre/bezier-easing) | The math involves dichotomic search + Newton-Raphson for X→t inversion; easy to get wrong for edge cases near t=0 and t=1 |
| Multi-point value interpolation | Custom lerp loop | `interpolate()` from Remotion | Already in the codebase; handles clamping, N-point ranges, and easing; tested against frame-accurate rendering |
| Easing curve thumbnails in dropdown | Canvas rendering of curves | Inline SVG `<path>` with hardcoded or parameterized C commands | 5 preset curves = 5 small SVG paths; simpler than dynamic canvas |

**Key insight:** The hardest part of this phase is the data model design and the Animation Builder page layout, not the interpolation math — Remotion's `interpolate()` already does all the heavy lifting for keyframe value interpolation.

---

## Common Pitfalls

### Pitfall 1: `computeAnimationStyles` Returns Only CSS Transforms — Keyframes Must Add, Not Replace
**What goes wrong:** The existing enter/active/exit animations return `transform: translateY(...)` or `opacity: ...` CSS. If the keyframe pass also returns `transform`, one will overwrite the other.
**Why it happens:** Object spread `{ ...enterStyles, ...keyframeStyles }` overwrites duplicate keys.
**How to avoid:** Use the existing `mergeStyles()` helper in `animations.ts` — it specifically handles combining multiple `transform` strings by concatenating them. Route all keyframe-derived styles through `mergeStyles()` as a separate argument.
**Warning signs:** Keyframe position animation working but slide-up enter animation stops working.

### Pitfall 2: Keyframe Time Is Fraction of Phrase Lifetime, Not Absolute Time
**What goes wrong:** Storing keyframe times as absolute seconds (e.g. `1.5s`) instead of phrase-relative fractions (`0.5`). When the phrase moves in time, keyframes become wrong.
**Why it happens:** The locked decision specifies `0%–100%` relative to phrase lifetime.
**How to avoid:** Always compute `phraseProgress = (frame - phraseStartFrame) / totalPhraseFrames` and use that as the input to keyframe interpolation. Never use absolute frame or second values.
**Warning signs:** Keyframe animations working in preview at fixed positions but breaking when phrases are shifted in the timeline editor.

### Pitfall 3: Dragging Text in Preview at Wrong Aspect Ratio Produces Wrong % Values
**What goes wrong:** User builds animation in 16:9, then plays it in 9:16. A position of `x: 50%, y: 75%` means different screen positions in each aspect ratio.
**Why it happens:** Position keyframes are stored as `%` of the composition dimensions, but the visual interpretation changes with aspect ratio.
**How to avoid:** Position keyframes are inherently aspect-ratio-relative (50% width is always 50% width regardless of absolute pixel dimensions). The `SubtitleOverlay` already uses `top: ${top}%` and `left: 5% / right: 5%`. Keyframe x% maps to `left` position as a percentage of composition width. This is correct by design — document this clearly.
**Warning signs:** Users complaining that animations look different on different formats.

### Pitfall 4: SQLite Migration Failure on Concurrent App Instances
**What goes wrong:** If two instances of the backend start simultaneously, both try `ALTER TABLE ADD COLUMN` and the second one gets a "duplicate column" error.
**Why it happens:** WAL mode doesn't prevent two processes from both passing the `PRAGMA table_info` check before either executes the ALTER.
**How to avoid:** Wrap the migration in a transaction and use `IF NOT EXISTS` equivalent: `ALTER TABLE ... ADD COLUMN ... DEFAULT NULL` inside a try/catch. SQLite will throw if the column already exists — catch and ignore that specific error.
**Warning signs:** Backend crash on startup with `table animation_presets already has a column named keyframes`.

### Pitfall 5: Player Re-mount When `inputProps` Changes Reference on Every Render
**What goes wrong:** The Animation Builder's `<Player>` re-mounts on every edit because `inputProps` is recreated every render.
**Why it happens:** Inline object `inputProps={{ preset, phrases }}` creates a new reference each render.
**How to avoid:** Wrap `inputProps` in `useMemo()` with appropriate deps — the existing `AnimationPreview.tsx` already does this correctly (line 80-88). Copy that pattern.
**Warning signs:** Animation preview resets to frame 0 on every keystroke in the sample text field.

### Pitfall 6: `easings` Array Length Must Be `keyframes.length - 1`
**What goes wrong:** If `easings` has the wrong length, `easings[segIdx]` is `undefined`, causing a runtime error or silently falling back to linear.
**Why it happens:** Off-by-one when constructing the `KeyframeTrack`.
**How to avoid:** Enforce this invariant at the type level and in the keyframe editor — when adding a keyframe, automatically insert an `ease-in-out` easing for the new segment; when removing, remove the corresponding segment easing.
**Warning signs:** TypeScript `undefined` errors in `applyEasing()`.

---

## Code Examples

Verified patterns from official sources and codebase analysis:

### Remotion `interpolate()` with N keyframe points
```typescript
// Source: https://www.remotion.dev/docs/interpolate
// Remotion natively supports arrays of any length — confirmed HIGH confidence
import { interpolate } from 'remotion'

const yPos = interpolate(
  phraseProgress,                    // 0.0 - 1.0
  [0, 0.3, 0.7, 1.0],               // keyframe times
  [80, 20, 80, 80],                 // y% values
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  // Note: easing option here applies uniformly to all segments
  // For per-segment easing, compute manually (see Pattern 1 above)
)
```

### `Easing.bezier()` — Remotion built-in
```typescript
// Source: https://www.remotion.dev/docs/easing
// Verified: Remotion has Easing.bezier(x1, y1, x2, y2) => (t) => number
import { Easing } from 'remotion'

const customEase = Easing.bezier(0.25, 0.1, 0.25, 1.0)  // same as CSS ease
// Can be used in interpolate:
interpolate(t, [0, 1], [0, 1], { easing: customEase })
// Or called directly (though bezier-easing is preferred for standalone use)
const value = customEase(0.5)
```

### `bezier-easing` usage
```typescript
// Source: https://www.npmjs.com/package/bezier-easing
// For per-segment custom easing outside interpolate()
import BezierEasing from 'bezier-easing'

const ease = BezierEasing(0.42, 0, 0.58, 1)  // cubic-bezier(0.42, 0, 0.58, 1)
const easedValue = ease(0.5)  // returns ~0.5 for this symmetric curve
```

### mergeStyles — existing pattern
```typescript
// Source: packages/remotion-composition/src/animations.ts lines 191-209
// Already handles concatenating transforms — critical for keyframe integration
const containerStyle = mergeStyles(
  { position: 'absolute', top: `${top}%` },     // base positioning
  cleanPhraseAnimStyles,                          // enter/exit/active animation
  keyframeAnimStyles,                             // NEW: keyframe position/scale/opacity
)
```

### `PRAGMA table_info` for column existence check
```typescript
// Source: better-sqlite3 docs + SQLite PRAGMA docs
// db.pragma() returns synchronous results in better-sqlite3
const cols = db.pragma('table_info(animation_presets)') as Array<{ name: string }>
const hasKeyframes = cols.some((c) => c.name === 'keyframes')
if (!hasKeyframes) {
  db.exec(`ALTER TABLE animation_presets ADD COLUMN keyframes TEXT`)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-phrase stored keyframes | Reusable keyframe templates in AnimationPreset | Phase 8 design decision | Keyframes are authoring artifacts, not per-subtitle data |
| Single-segment `interpolate(enter, 0, 1)` | Multi-segment per-property keyframe track | Phase 8 | Enables full motion graphics on subtitles |
| Global position via `verticalPosition` in StyleProps | Keyframe-animatable x%/y% position | Phase 8 | Position becomes animatable over phrase lifetime |

**Deprecated/outdated:**
- `activeAnimation` property on `AnimationPreset` (the jiggle/wave/pulse/bounce loop): Still valid for simple hold-phase effects; keyframes are an additive layer on top, not a replacement.

---

## Open Questions

1. **Where does keyframe-driven position interact with `verticalPosition` (StyleProps) and the existing slot-based overlap system?**
   - What we know: `SubtitleOverlay` computes `top = effectiveStyle.verticalPosition - slot * OVERLAP_OFFSET_PCT` and applies it as the base position. The keyframe x%/y% would need to override or add to this.
   - What's unclear: Should keyframe `y` be absolute (override `verticalPosition`) or relative (offset from `verticalPosition`)? If absolute, the slot system breaks when two speakers overlap. If relative, it's harder to author.
   - Recommendation: Make keyframe x/y **override** `verticalPosition` when any x/y keyframes exist on the preset. The slot system is a subtitle-editor concern; in the Animation Builder standalone context, there are no competing phrases. Document the interaction.

2. **How does the preset's `keyframeTracks` serialize/deserialize through the existing `params` JSON column?**
   - What we know: The existing `rowToPreset()` in `routes/presets.ts` spreads parsed `params` JSON directly into the returned object. If `keyframeTracks` is stored as a top-level key in `params`, it will be included automatically.
   - What's unclear: The new `keyframes` TEXT column vs. putting it inside `params` JSON.
   - Recommendation: Store `keyframeTracks` inside the existing `params` JSON object (alongside `enter`, `active`, `exit`) rather than as a separate `keyframes` column. This avoids any DB migration entirely — just update the create/update/read routes to handle the new field in params. The `ALTER TABLE` migration becomes optional or unnecessary.

3. **Playhead in Animation Builder — is it the Remotion Player's current frame, or a separate concept?**
   - What we know: The Remotion Player has internal play state. Dragging text in the preview at a specific point requires knowing the fractional time.
   - What's unclear: Whether to expose the Player's current frame via `playerRef.current.getCurrentFrame()` (the `PlayerRef` API) or manage a separate playhead state.
   - Recommendation: Use `playerRef.current.getCurrentFrame()` via a `setInterval` polling approach (or `requestAnimationFrame`) to sync the displayed playhead position in the keyframe timeline. The existing `PreviewPanel.tsx` already implements a similar pattern for the `getCurrentTime` callback.

---

## Sources

### Primary (HIGH confidence)
- `https://www.remotion.dev/docs/interpolate` — confirmed N-point array support, extrapolate options
- `https://www.remotion.dev/docs/easing` — confirmed `Easing.bezier(x1, y1, x2, y2)` API
- `https://www.remotion.dev/docs/animation-utils/interpolate-styles` — confirmed multi-keyframe style interpolation with per-style easing
- `https://www.remotion.dev/docs/player/player` — confirmed `compositionWidth`/`compositionHeight` are reactive props
- `packages/remotion-composition/src/animations.ts` — direct codebase reading of `mergeStyles`, `computeAnimationStyles`, easing mapper
- `packages/shared-types/src/index.ts` — direct codebase reading of `AnimationPreset`, `EasingType`
- `packages/backend/src/services/animationPresets.ts` — direct codebase reading of SQLite schema, built-in presets
- `packages/backend/src/routes/presets.ts` — direct codebase reading of `rowToPreset` serialization
- SQLite official docs — `ALTER TABLE ADD COLUMN` is a supported DDL operation since SQLite 3.x

### Secondary (MEDIUM confidence)
- `https://www.npmjs.com/package/bezier-easing` — gre/bezier-easing; widely used (12M+ weekly downloads), implements CSS cubic-bezier spec
- `https://www.remotion.dev/docs/player/scaling` — Player dimensions behavior (compositionWidth/Height are props, style for CSS sizing)

### Tertiary (LOW confidence)
- WebSearch on `bezier-easing-editor` npm package — reported React 15 peer dep issue; not verified directly but consistent with GitHub repo age

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing dependencies confirmed in package.json; `bezier-easing` is industry-standard
- Architecture: HIGH — directly derived from reading all relevant source files; `mergeStyles` integration point is unambiguous
- Pitfalls: HIGH for transform merge (directly from code) and DB migration (SQLite docs); MEDIUM for aspect ratio / playhead sync (not yet coded, based on pattern analysis)
- Open Questions: MEDIUM — identified real ambiguities that the planner must resolve or the implementer must decide

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable stack; Remotion 4.x API unlikely to change)
