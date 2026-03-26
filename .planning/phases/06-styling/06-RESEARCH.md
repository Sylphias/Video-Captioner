# Phase 6: Styling - Research

**Researched:** 2026-03-06
**Domain:** Remotion subtitle styling, Google Fonts integration, per-speaker style overrides, React style controls
**Confidence:** HIGH

<user_constraints>
## User Constraints (from inline phase context)

### Locked Decisions
- Each speaker can have different styles AND animations for their subtitles
- Base styling requirements: font size, highlight color, stroke, vertical position, font family
- Per-speaker style overrides sit on top of global defaults

### Claude's Discretion
- Which specific curated Google Fonts to offer
- How the style panel UI is organized (tabs, accordion, side panel, etc.)
- Whether per-speaker overrides use a separate panel or inline controls in the TranscriptEditor
- Color picker library choice
- Animation types and defaults for per-speaker animations

### Deferred Ideas (OUT OF SCOPE)
- (None explicitly deferred — scope is the five STYLE requirements plus per-speaker overrides)
</user_constraints>

---

## Summary

Phase 6 adds a styling layer on top of the already-working SubtitleComposition. The composition is fully props-driven: `StyleProps` flows from Zustand → `PreviewPanel` → `Player.inputProps` → `SubtitleComposition`. The existing `setStyle` action in Zustand already handles global style updates. The main engineering work is threefold: (1) extend `StyleProps` and the store to accommodate per-speaker overrides, (2) build a style-panel UI with color pickers, sliders, and a font selector, and (3) integrate `@remotion/google-fonts` so the chosen font renders identically in the browser Player and in the server render.

The biggest integration risk is font consistency between preview and server render. `@remotion/google-fonts` handles this automatically — `loadFont()` called at module level blocks render until the font is ready in both environments. The critical pattern is: the `fontFamily` string returned by `loadFont()` must be what's stored in `StyleProps`; the actual network loading happens as a side effect of calling `loadFont()` in the composition module.

Per-speaker overrides are a straightforward extension: `SpeakerStyleOverride` is a partial `StyleProps` stored in a `Record<speakerId, SpeakerStyleOverride>` in Zustand. The `SubtitleOverlay` merges the global style with the phrase's `dominantSpeaker` override at render time. Both `phrases` and `style` are already part of `SubtitleCompositionProps`; adding `speakerStyles` as a new prop propagates cleanly through the existing pipeline.

**Primary recommendation:** Add `speakerStyles: Record<string, Partial<StyleProps>>` to `SubtitleCompositionProps`, load a curated set of ~8-12 Google Fonts at module level in the remotion-composition package, and build a `<StylePanel>` component that writes to the Zustand store. Player live-preview is free because `inputProps` is already reactive.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@remotion/google-fonts` | 4.0.379 (align with remotion) | Type-safe Google Fonts in Remotion compositions | Official Remotion package; loadFont() auto-blocks render in both Player and server; zero separate CSS files needed |
| `react-colorful` | ^2.7.3 | Hex color picker in style panel | 2.8 KB gzipped, zero dependencies, WAI-ARIA, HexColorPicker + HexColorInput; used by Storybook |
| Zustand (already installed) | ^5.0.11 | Style state + per-speaker overrides | Already used; `setStyle` action already exists |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useMemo` (React built-in) | — | Memoize `inputProps` for Player | Required to prevent Player re-render on every keystroke; Remotion best-practices docs flag this explicitly |
| `useCallback` (React built-in) | — | Stable setter callbacks from Zustand | Standard React pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@remotion/google-fonts` | `@remotion/fonts` (local files) | @remotion/fonts requires hosting font files in public/; @remotion/google-fonts serves from Google CDN automatically — simpler for a curated list |
| `@remotion/google-fonts` | CSS `@import` from Google Fonts | Works but is stringly-typed; @remotion/google-fonts is type-safe with weight/subset narrowing that reduces server-render timeouts |
| `react-colorful` | `react-color` (older library) | react-color is ~24 KB with many unused components; react-colorful is 2.8 KB; both have the same API surface for our use case |
| Native `<input type="color">` | `react-colorful` | input[type=color] can't read hex text back easily, no real-time update while dragging in all browsers |

**Installation:**
```bash
# In packages/remotion-composition (needs to load fonts in compositions)
npm install @remotion/google-fonts@4.0.379 --save-exact

# In packages/frontend (needs color picker in style panel)
npm install react-colorful
```

---

## Architecture Patterns

### Recommended Project Structure

The new files for this phase map onto the existing structure:

```
packages/
├── shared-types/src/
│   └── index.ts                    # Add SpeakerStyleOverride type
├── remotion-composition/src/
│   ├── fonts.ts                    # NEW: loadFont() calls at module level; exports fontFamilyMap
│   ├── types.ts                    # EXTEND: StyleProps + SpeakerStyleOverride; SubtitleCompositionProps gets speakerStyles
│   ├── SubtitleOverlay.tsx         # EXTEND: merge speaker override at render time; add stroke; verticalPosition
│   └── SubtitleComposition.tsx     # EXTEND: accept speakerStyles prop; pass to overlay
└── frontend/src/
    ├── store/
    │   └── subtitleStore.ts        # EXTEND: speakerStyles Record; setSpeakerStyle action; add stroke + verticalPosition to StyleProps
    └── components/
        ├── StylePanel/
        │   ├── StylePanel.tsx      # NEW: global style controls (font, size, color, stroke, position)
        │   ├── StylePanel.css      # NEW: co-located styles (dark theme, matches existing pattern)
        │   └── SpeakerStylePanel.tsx  # NEW: per-speaker override controls
        └── PreviewPanel.tsx        # EXTEND: memoize inputProps with useMemo
```

### Pattern 1: Module-Level Font Loading in Remotion

**What:** Call `loadFont()` at module level in a dedicated `fonts.ts` file. This fires when the composition module is imported — before any frames render in both the Player and the server renderer. The returned `fontFamily` string is what you store in `StyleProps`.

**When to use:** Any time you need a Google Font available in a Remotion composition.

**Example:**
```typescript
// packages/remotion-composition/src/fonts.ts
// Source: https://www.remotion.dev/docs/google-fonts/load-font

import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { loadFont as loadRoboto } from '@remotion/google-fonts/Roboto'
import { loadFont as loadMontserrat } from '@remotion/google-fonts/Montserrat'
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald'
import { loadFont as loadLato } from '@remotion/google-fonts/Lato'
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins'
import { loadFont as loadNotoSans } from '@remotion/google-fonts/NotoSans'
import { loadFont as loadPlayfairDisplay } from '@remotion/google-fonts/PlayfairDisplay'

// Each call loads only what we need (normal, 700 weight, latin subset)
// The returned fontFamily is the CSS family name — e.g. "Inter"
export const FONTS = {
  Inter:          loadInter('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  Roboto:         loadRoboto('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  Montserrat:     loadMontserrat('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  Oswald:         loadOswald('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  Lato:           loadLato('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  Poppins:        loadPoppins('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  'Noto Sans':    loadNotoSans('normal', { weights: ['400', '700'], subsets: ['latin'] }),
  'Playfair Display': loadPlayfairDisplay('normal', { weights: ['400', '700'], subsets: ['latin'] }),
} as const

// The label (key) is what the UI shows; the value is the CSS fontFamily string
export type FontName = keyof typeof FONTS
export const FONT_NAMES = Object.keys(FONTS) as FontName[]

// Returns the CSS fontFamily value for a given font name
export function getFontFamily(name: FontName): string {
  return FONTS[name].fontFamily
}
```

**Critical:** `fonts.ts` must be imported by `SubtitleComposition.tsx` (or its barrel `index.ts`) so the module-level calls fire in every environment.

### Pattern 2: Extended StyleProps with Per-Speaker Overrides

**What:** `StyleProps` gains the new STYLE-03 and STYLE-04 fields. A new `SpeakerStyleOverride` type (Partial of the same fields) is stored in a separate `speakerStyles` map.

**When to use:** Whenever the composition renders a phrase — look up the dominant speaker and merge.

**Example:**
```typescript
// packages/remotion-composition/src/types.ts

export interface StyleProps {
  highlightColor: string   // e.g. '#FFFF00' — currently spoken word
  baseColor: string        // e.g. '#FFFFFF'
  fontSize: number         // px
  fontFamily: string       // CSS font-family string — use getFontFamily() from fonts.ts
  strokeColor: string      // e.g. '#000000'
  strokeWidth: number      // px — 0 = no stroke
  verticalPosition: number // 0-100, percentage from top (80 = near bottom)
}

// Per-speaker overrides — only the fields you want to override
export type SpeakerStyleOverride = Partial<StyleProps>

export interface SubtitleCompositionProps {
  videoSrc: string
  phrases: TranscriptPhrase[]
  style: StyleProps
  speakerStyles: Record<string, SpeakerStyleOverride>  // keyed by raw speakerId e.g. 'SPEAKER_00'
}
```

### Pattern 3: Style Merge in SubtitleOverlay

**What:** At render time, for the active phrase, look up the dominant speaker's override and merge on top of global style.

**Example:**
```typescript
// packages/remotion-composition/src/SubtitleOverlay.tsx

interface SubtitleOverlayProps {
  phrases: TranscriptPhrase[]
  style: StyleProps
  speakerStyles: Record<string, SpeakerStyleOverride>
}

export function SubtitleOverlay({ phrases, style, speakerStyles }: SubtitleOverlayProps) {
  // ... existing frame/fps logic ...

  if (activePhrase === null) return null

  // Merge global style with per-speaker override
  const dominantSpeaker = (activePhrase as SessionPhrase).dominantSpeaker
  const override = dominantSpeaker ? (speakerStyles[dominantSpeaker] ?? {}) : {}
  const effectiveStyle: StyleProps = { ...style, ...override }

  return (
    <div
      style={{
        position: 'absolute',
        top: `${effectiveStyle.verticalPosition}%`,
        transform: 'translateY(-50%)',
        left: '5%',
        right: '5%',
        textAlign: 'center',
        fontSize: effectiveStyle.fontSize,
        fontFamily: effectiveStyle.fontFamily,
        lineHeight: 1.4,
        WebkitTextStroke: effectiveStyle.strokeWidth > 0
          ? `${effectiveStyle.strokeWidth}px ${effectiveStyle.strokeColor}`
          : undefined,
      }}
    >
      {activePhrase.words.map((word, i) => (
        <span
          key={`${word.start}-${i}`}
          style={{
            color: i === activeWordIndex ? effectiveStyle.highlightColor : effectiveStyle.baseColor,
            marginRight: '0.25em',
            // text-shadow fallback for legibility (supplement stroke)
            textShadow: '0 2px 4px rgba(0,0,0,0.8)',
          }}
        >
          {word.word}
        </span>
      ))}
    </div>
  )
}
```

**Important:** The existing `SubtitleOverlay` uses `bottom: '10%'` for vertical position. Replace with `top: verticalPosition%` + `transform: translateY(-50%)` so the slider controls actual frame position cleanly (0 = top, 50 = center, 80 = near bottom).

### Pattern 4: Memoized inputProps for Live Preview

**What:** Remotion's best-practices docs explicitly warn that un-memoized `inputProps` causes the entire composition tree to re-render on every parent state change.

**When to use:** Always in PreviewPanel, especially when style changes are frequent (drag on color picker).

**Example:**
```typescript
// packages/frontend/src/components/PreviewPanel.tsx
// Source: https://www.remotion.dev/docs/player/best-practices

const speakerStyles = useSubtitleStore((s) => s.speakerStyles)
const style = useSubtitleStore((s) => s.style)
const session = useSubtitleStore((s) => s.session)

const inputProps = useMemo(() => ({
  videoSrc,
  phrases: session?.phrases.map((p) => ({ words: p.words })) ?? [],
  style,
  speakerStyles,
}), [videoSrc, session, style, speakerStyles])

// Pass to Player:
<Player
  ...
  inputProps={inputProps}
/>
```

### Pattern 5: Zustand Store Extensions

**What:** Add `speakerStyles` record and `setSpeakerStyle` action. Extend `StyleProps` defaults.

**Example:**
```typescript
// packages/frontend/src/store/subtitleStore.ts (additions only)

import type { SpeakerStyleOverride } from '@eigen/remotion-composition'

interface SubtitleStore {
  // ... existing fields ...
  speakerStyles: Record<string, SpeakerStyleOverride>

  // Actions (additions)
  setSpeakerStyle: (speakerId: string, override: SpeakerStyleOverride) => void
  clearSpeakerStyle: (speakerId: string) => void
}

const DEFAULT_STYLE: StyleProps = {
  highlightColor: '#FFFF00',
  baseColor: '#FFFFFF',
  fontSize: 48,
  fontFamily: 'Inter',     // matches getFontFamily('Inter') return value
  strokeColor: '#000000',
  strokeWidth: 2,
  verticalPosition: 80,    // 80% from top = near bottom
}

// In the create() body:
speakerStyles: {},

setSpeakerStyle: (speakerId, override) =>
  set((state) => ({
    speakerStyles: { ...state.speakerStyles, [speakerId]: { ...state.speakerStyles[speakerId], ...override } }
  })),

clearSpeakerStyle: (speakerId) =>
  set((state) => {
    const next = { ...state.speakerStyles }
    delete next[speakerId]
    return { speakerStyles: next }
  }),
```

### Pattern 6: Text Stroke in CSS

**What:** Use `WebkitTextStroke` (camelCase in React inline styles) to apply stroke/outline to subtitle text. This renders in headless Chrome (which Remotion uses for server render) and in the browser Player.

**Confidence:** HIGH — MDN confirms `-webkit-text-stroke` is supported in all modern browsers and Chromium-based headless environments used by Remotion.

```typescript
// In a React inline style object:
style={{
  WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth}px ${strokeColor}` : undefined,
}}
```

**Note:** `-webkit-text-stroke` draws the stroke on the inside of the letterform glyph. For thick strokes (>3px), the fill color bleeds. To avoid this, render the text twice: once with stroke (underneath), once with fill (on top). For subtitle-legibility strokes (1-4px), the single-element approach is fine.

### Pattern 7: Vertical Position via `top` + `transform`

**What:** Replace the hardcoded `bottom: '10%'` in `SubtitleOverlay` with a user-controlled `verticalPosition` (0-100%). Use `top` + `translateY(-50%)` so the midpoint of the text block is at the specified percentage.

```typescript
style={{
  position: 'absolute',
  top: `${effectiveStyle.verticalPosition}%`,
  transform: 'translateY(-50%)',
  left: '5%',
  right: '5%',
  // ...
}}
```

**Default:** `verticalPosition: 80` puts the subtitle center at 80% down the frame, visually equivalent to the current `bottom: 10%` for typical text heights.

### Anti-Patterns to Avoid

- **Storing `fontFamily` as a font name string and resolving it inside SubtitleComposition:** The CSS `fontFamily` value must come from `loadFont().fontFamily` — calling it "Inter" in StyleProps and mapping inside the component adds complexity and risks mismatch between what was loaded and what's rendered. Instead, store the CSS fontFamily string directly (it happens to equal the human-readable name for Google Fonts, e.g. `"Inter"`), and load all curated fonts unconditionally at module level.
- **Calling `loadFont()` inside a React component or `useEffect`:** `loadFont()` must be called at module level so it runs synchronously before any render. Inside a component, the font may not be loaded when the first frame renders.
- **Fetching fonts dynamically per speaker in compositions:** Dynamically loading a font only when a specific speaker's phrase is active creates race conditions with the Remotion render pipeline. Load all curated fonts eagerly at startup.
- **Un-memoized `inputProps` in PreviewPanel:** Remotion docs explicitly flag this as a performance pitfall. Every style knob interaction re-renders; without `useMemo`, the whole Player subtree rebuilds.
- **Changing `verticalPosition` to affect only the `bottom` property:** Bottom-anchored layout means position 0 is at the bottom edge, which is counterintuitive for a slider. Use `top` so the slider value maps directly to visual position from top.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hex color picker UI | Custom canvas/gradient color picker | `react-colorful` HexColorPicker + HexColorInput | Gradient math, keyboard events, accessibility, pointer capture — 2.8 KB covers all of it |
| Font loading that blocks render | `delayRender()` + `continueRender()` manually | `@remotion/google-fonts` loadFont() | @remotion/google-fonts wraps the delayRender/continueRender pattern internally; font is guaranteed loaded before frame 0 |
| "Is this font available" check | Custom font loading state machine | `waitUntilDone()` from loadFont() return value | Already provided; resolves when font is network-ready |
| Font name → CSS fontFamily mapping | Custom dict of font names → CSS strings | `getFontFamily()` from fonts.ts using loadFont() return | The `fontFamily` property on the loadFont() return IS the correct CSS string |

**Key insight:** The Remotion rendering pipeline's font synchronization guarantee (`loadFont()` auto-blocks via `delayRender()`) means you never need to worry about a frame rendering before the font is loaded. This applies identically in the browser Player and in headless Chrome during server render.

---

## Common Pitfalls

### Pitfall 1: Font Mismatch Between Preview and Render

**What goes wrong:** The font looks correct in the Player but the rendered MP4 uses a fallback (sans-serif).

**Why it happens:** `loadFont()` is only called in one environment. Common cause: the `fonts.ts` file is imported only from the frontend, not from the remotion-composition package itself. Or: the `fontFamily` string stored in `StyleProps` does not exactly match the CSS font-family name returned by `loadFont()`.

**How to avoid:**
1. Put `fonts.ts` inside `packages/remotion-composition/src/` — the package imported by both frontend (Player) and backend (bundle → server render)
2. Store `loadFont().fontFamily` as the value in `StyleProps.fontFamily`, not a hand-typed string
3. Import `fonts.ts` at the top of `SubtitleComposition.tsx` (or in the barrel `index.ts`) so the side-effect runs in every environment

**Warning signs:** Font looks right in preview but changes in the downloaded MP4. Or: Remotion server render logs show `net::ERR_FAILED` for Google Fonts URLs.

### Pitfall 2: Player Re-renders on Every Color Picker Drag Event

**What goes wrong:** Dragging the color picker is janky because the whole Remotion Player re-renders 60 times per second.

**Why it happens:** `inputProps` is not memoized in PreviewPanel. Each store update creates a new object reference.

**How to avoid:** Wrap the `inputProps` construction in `useMemo`. Subscribe to `style` and `speakerStyles` as separate Zustand selectors, not the whole store.

**Warning signs:** Browser dev tools show the Player component unmounting/remounting. Preview frame rate drops to <10fps during slider drag.

### Pitfall 3: `speakerStyles` in Render Payload Not Propagated

**What goes wrong:** Server render ignores per-speaker styles; all speakers look the same in the rendered MP4.

**Why it happens:** `useRender.ts` currently only sends `{ phrases, style }` to `POST /api/jobs/:jobId/render`. If `speakerStyles` is not added to the render payload, the backend receives an empty object.

**How to avoid:** Extend `RenderBody` in the backend render route to include `speakerStyles: Record<string, SpeakerStyleOverride>`. Update `useRender.ts` to read and send `speakerStyles` from the Zustand store alongside `style`.

**Warning signs:** Per-speaker colors show correctly in the Player preview but not in the downloaded MP4.

### Pitfall 4: `@remotion/google-fonts` Version Mismatch

**What goes wrong:** Runtime error: `Cannot read properties of undefined` or font fails to load in the composition bundle.

**Why it happens:** All Remotion packages must be at the same version. If `remotion` and `@remotion/google-fonts` are at different patch versions, internal APIs can mismatch.

**How to avoid:** Install with `--save-exact` at version `4.0.379` (matching the existing `remotion` version in the monorepo).

**Warning signs:** Build errors in the remotion-composition package. Server render fails with Remotion API errors.

### Pitfall 5: Stroke Inside Glyph (Thick Strokes)

**What goes wrong:** At `strokeWidth > 4px`, the stroke fills in the centers of letters like 'e', 'o', 'a'.

**Why it happens:** `-webkit-text-stroke` draws the stroke centered on the glyph outline, so half is inside and half outside. The fill color is drawn after, covering the inside half. At thick widths, the inside-half covers fine details.

**How to avoid:** For typical subtitle legibility (1-4px), the effect looks fine. Cap `strokeWidth` at 4 in the UI via slider `max`. If thicker strokes are ever needed in the future, the double-render technique (shadow element with paint-order: stroke fill) is the correct solution.

**Warning signs:** Letters with holes ('o', 'e', 'a', '0') appear filled in at high stroke values.

### Pitfall 6: `dominantSpeaker` Not Available in Phrases Sent to Server Render

**What goes wrong:** Per-speaker styles can't be applied during server render because `TranscriptPhrase` doesn't have `dominantSpeaker` — only `SessionPhrase` does.

**Why it happens:** The render payload's `phrases` array is mapped from `SessionPhrase[]` to `TranscriptPhrase[]` in `useRender.ts` with `.map((p) => ({ words: p.words }))`, stripping `dominantSpeaker`.

**How to avoid:** Include `dominantSpeaker` in the serialized phrase objects. Either:
- Option A: Extend `TranscriptPhrase` in `shared-types` to add optional `dominantSpeaker?: string`
- Option B: Create a new `RenderPhrase` type that includes `dominantSpeaker`

Option A is simpler and aligns with the existing type. The server render worker receives `SubtitleCompositionProps` which uses `TranscriptPhrase[]` — so the type must be updated.

**Warning signs:** Per-speaker colors work in Player preview (which uses `SessionPhrase` with `dominantSpeaker`) but all phrases use global style in the rendered MP4.

---

## Code Examples

Verified patterns from official sources:

### loadFont() at Module Level
```typescript
// Source: https://www.remotion.dev/docs/google-fonts/load-font
import { loadFont } from '@remotion/google-fonts/Inter'

// Called at module level — fires before any frames render
const { fontFamily } = loadFont('normal', {
  weights: ['400', '700'],
  subsets: ['latin'],
})

// fontFamily === 'Inter' — use this string in StyleProps
export { fontFamily as interFontFamily }
```

### Color Picker with Hex Input
```typescript
// Source: https://github.com/omgovich/react-colorful
import { HexColorPicker, HexColorInput } from 'react-colorful'

function HighlightColorControl() {
  const highlightColor = useSubtitleStore((s) => s.style.highlightColor)
  const setStyle = useSubtitleStore((s) => s.setStyle)

  return (
    <div className="style-panel__color-control">
      <HexColorPicker
        color={highlightColor}
        onChange={(color) => setStyle({ highlightColor: color })}
      />
      <HexColorInput
        color={highlightColor}
        onChange={(color) => setStyle({ highlightColor: color })}
        prefixed
      />
    </div>
  )
}
```

### Font Selector (Curated List)
```typescript
// fonts.ts (remotion-composition package)
import { FONT_NAMES, getFontFamily } from './fonts'

function FontSelector() {
  const fontFamily = useSubtitleStore((s) => s.style.fontFamily)
  const setStyle = useSubtitleStore((s) => s.setStyle)

  return (
    <select
      value={fontFamily}
      onChange={(e) => setStyle({ fontFamily: e.target.value })}
      style={{ fontFamily: fontFamily }}  // preview font in dropdown
    >
      {FONT_NAMES.map((name) => (
        <option key={name} value={getFontFamily(name)} style={{ fontFamily: getFontFamily(name) }}>
          {name}
        </option>
      ))}
    </select>
  )
}
```

### Vertical Position Slider
```typescript
function VerticalPositionControl() {
  const verticalPosition = useSubtitleStore((s) => s.style.verticalPosition)
  const setStyle = useSubtitleStore((s) => s.setStyle)

  return (
    <label className="style-panel__control">
      <span>Vertical position</span>
      <input
        type="range"
        min={5}
        max={95}
        value={verticalPosition}
        onChange={(e) => setStyle({ verticalPosition: Number(e.target.value) })}
      />
      <span>{verticalPosition}%</span>
    </label>
  )
}
```

### Stroke Controls
```typescript
function StrokeControls() {
  const strokeWidth = useSubtitleStore((s) => s.style.strokeWidth)
  const strokeColor = useSubtitleStore((s) => s.style.strokeColor)
  const setStyle = useSubtitleStore((s) => s.setStyle)

  return (
    <div className="style-panel__stroke">
      <label>
        <span>Stroke width</span>
        <input
          type="range"
          min={0}
          max={4}
          step={0.5}
          value={strokeWidth}
          onChange={(e) => setStyle({ strokeWidth: Number(e.target.value) })}
        />
        <span>{strokeWidth}px</span>
      </label>
      {strokeWidth > 0 && (
        <HexColorPicker
          color={strokeColor}
          onChange={(color) => setStyle({ strokeColor: color })}
        />
      )}
    </div>
  )
}
```

### Memoized inputProps in PreviewPanel
```typescript
// Source: https://www.remotion.dev/docs/player/best-practices
const style = useSubtitleStore((s) => s.style)
const speakerStyles = useSubtitleStore((s) => s.speakerStyles)
const session = useSubtitleStore((s) => s.session)

const inputProps = useMemo(() => ({
  videoSrc: `/api/jobs/${jobId}/video`,
  phrases: session?.phrases.map((p) => ({
    words: p.words,
    dominantSpeaker: p.dominantSpeaker,  // must include for per-speaker styles
  })) ?? [],
  style,
  speakerStyles,
}), [jobId, session, style, speakerStyles])
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS `@import` from Google Fonts | `@remotion/google-fonts` loadFont() | Remotion 3.2.40+ | Type-safe, weight/subset narrowing prevents render timeouts; works identically in Player and server render |
| `text-shadow` only for legibility | `-webkit-text-stroke` | Always been available; Remotion runs Chromium which supports it | Cleaner stroke than multi-shadow hacks |
| Hardcoded subtitle position | `verticalPosition` in StyleProps as % | New in Phase 6 | Full user control over placement |
| Global style only | Global + per-speaker override record | New in Phase 6 | Each speaker can have distinct visual identity |

**Deprecated/outdated:**
- Manual `delayRender()` + `continueRender()` for font loading: replaced by `@remotion/google-fonts` loadFont() which wraps this pattern internally
- `text-shadow: 0 0 3px black, ...` outline trick: still works as a fallback but `WebkitTextStroke` is the proper approach for Chromium-rendered subtitles

---

## Open Questions

1. **Which specific Google Fonts to include in the curated list**
   - What we know: The Remotion docs suggest top-25, top-100, or top-250 bundles for font pickers. For subtitles, legible at video resolution is the key criterion.
   - What's unclear: Do we want display fonts (Oswald, Bebas Neue) or only safe body fonts?
   - Recommendation: Start with 8-10 fonts: Inter, Roboto, Montserrat, Oswald, Lato, Poppins, Noto Sans, Playfair Display. Add Bebas Neue if bold display style is wanted. These can be expanded later.

2. **Per-speaker animation types (LOCKED: speakers can have different animations)**
   - What we know: The user locked "each speaker can have different animations" but no animation types are specified. CSS `animation` and Remotion's `interpolate()` / `spring()` are both options.
   - What's unclear: Are animations triggered per-word (like karaoke pop-in) or per-phrase (slide in/out)? This determines whether animation logic lives in SubtitleOverlay (word-level) or at the phrase container level.
   - Recommendation: Research animation implementation in a separate sub-phase or add animation types as a new field in `SpeakerStyleOverride` with a union type like `'none' | 'pop' | 'slide-up' | 'bounce'`.

3. **Where the style panel lives in the UI**
   - What we know: The current layout is Preview (top) + TranscriptEditor (bottom, scrollable). The style panel needs to be accessible.
   - What's unclear: Does it replace TranscriptEditor tabs, or sit alongside in the top area?
   - Recommendation: Add a "Style" tab alongside the transcript editor section (below the resize handle), matching the existing tab nav. The PreviewPanel updates immediately because `inputProps` is reactive.

4. **`dominantSpeaker` in the render payload**
   - What we know: This is a required fix (Pitfall 6). The simplest solution is extending `TranscriptPhrase` in shared-types.
   - What's unclear: Whether extending `TranscriptPhrase` breaks any other downstream consumers.
   - Recommendation: Add `dominantSpeaker?: string` to `TranscriptPhrase` in shared-types. It's optional, so no breaking change. The backend route's `RenderBody` and the worker's `SubtitleCompositionProps` type automatically pick it up.

---

## Sources

### Primary (HIGH confidence)
- https://www.remotion.dev/docs/google-fonts — @remotion/google-fonts overview, verified via WebFetch + search
- https://www.remotion.dev/docs/google-fonts/load-font — loadFont() API, return type, module-level usage, verified via WebFetch
- https://www.remotion.dev/docs/google-fonts/get-available-fonts — getAvailableFonts() API, verified via WebFetch
- https://www.remotion.dev/docs/font-picker — font picker pattern, dynamic loading, verified via WebFetch
- https://www.remotion.dev/docs/fonts — font loading approaches, blocking behavior, verified via WebFetch
- https://www.remotion.dev/docs/player/best-practices — useMemo for inputProps, component separation, verified via WebFetch
- https://github.com/omgovich/react-colorful — react-colorful, 2.8 KB, HexColorPicker/HexColorInput API, verified via WebFetch
- Existing codebase (read directly): subtitleStore.ts, SubtitleOverlay.tsx, types.ts, grouping.ts, PreviewPanel.tsx, useRender.ts

### Secondary (MEDIUM confidence)
- https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-text-stroke — -webkit-text-stroke property; verified by search + MDN cross-reference; Chromium (Remotion's renderer) supports it

### Tertiary (LOW confidence)
- Font selection recommendations (Inter, Roboto, Montserrat, etc.): based on Google Fonts popularity rankings from search results; not Remotion-specific; validate against design requirements

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @remotion/google-fonts is the official Remotion package; react-colorful has verified GitHub/NPM presence with 2.8 KB claim confirmed
- Architecture: HIGH — derived directly from reading the actual codebase; StyleProps, Zustand store, SubtitleCompositionProps, render pipeline are all verified
- Font loading pattern: HIGH — loadFont() module-level usage and render-blocking behavior verified via official Remotion docs
- Pitfalls: HIGH — Pitfalls 1, 3, 6 are derived from actual code analysis (not speculation); Pitfalls 2, 4, 5 verified against Remotion docs and MDN
- Text stroke: HIGH — MDN-verified; Chromium-based Remotion renderer supports -webkit-text-stroke

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable libraries; @remotion/google-fonts API is stable at v4.x)
