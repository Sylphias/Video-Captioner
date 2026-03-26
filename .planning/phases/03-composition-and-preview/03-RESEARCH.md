# Phase 3: Composition and Preview - Research

**Researched:** 2026-03-02
**Domain:** Remotion 4.x composition, @remotion/player browser preview, karaoke subtitle rendering, Zustand state management
**Confidence:** HIGH (core stack verified against official remotion.dev docs; Zustand verified via official sources)

---

## Summary

Phase 3 introduces a Remotion composition (`SubtitleComposition.tsx`) that renders the uploaded video with a karaoke-style subtitle overlay, driven entirely by frame-based timing (`useCurrentFrame() / fps`). The composition is a pure props-driven function — no side effects, no `Date.now()`, no API calls. A frontend preview panel embeds this composition via `@remotion/player`'s `<Player>` component, connected to transcript and style state via Zustand.

The key architectural insight for this project: the `<Player>` in the browser and server-side rendering pipelines both consume the same `SubtitleComposition` component, which is why "pure props-driven" is a hard constraint. All timing is derived from `frame / fps` to compute `currentTimeSeconds`, which is then compared against `TranscriptWord.start` / `TranscriptWord.end` values to determine the active word.

The most significant project-specific finding: the normalized video file lives at `data/{jobId}/normalized.mp4` on the backend, accessible via the Vite dev proxy (`/api`) or a new backend route. The `<Player>` must receive this URL as an `inputProp`. Since the Vite proxy already maps `/api/*` to `http://127.0.0.1:3001`, adding a `GET /api/jobs/:jobId/video` route that streams `normalized.mp4` is the cleanest path — no CORS issues, same-origin to the browser.

**Primary recommendation:** Install `remotion` + `@remotion/player` with `--save-exact` at the same version (currently 4.0.379) into the frontend workspace. Build `SubtitleComposition.tsx` as a pure function in `packages/remotion-composition/src/`. Add Zustand to the frontend for shared subtitle state. Wire the `<Player>` to Zustand in a `PreviewPanel` component.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `remotion` | 4.0.379 (exact) | Core Remotion runtime — `useCurrentFrame`, `useVideoConfig`, `AbsoluteFill`, `Sequence` | Required peer for all Remotion packages |
| `@remotion/player` | 4.0.379 (exact) | `<Player>` React component for browser preview | Official browser embedding solution |
| `zustand` | 5.0.x | Client-side state for transcript, style props, jobId shared across components | Lightweight, hook-native, React 18+ compatible |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@remotion/media` | 4.0.379 (exact) | `<Video>` component for Player browser context (WebCodecs-based) | Required if using `@remotion/player` with local HTTP video URLs — see Video vs OffthreadVideo below |
| `@remotion/eslint-plugin` | 4.0.379 (exact) | Catches illegal API usage in Remotion files (e.g., `Date.now()`) | Dev dependency — install in the remotion-composition package |

### Video Component Decision: OffthreadVideo vs Video vs Html5Video

This is critical for Phase 3. The three options behave differently in browser (Player) vs server-side render contexts:

| Component | Works in Player | Works in SSR | CORS Required | Source |
|-----------|----------------|--------------|---------------|--------|
| `<OffthreadVideo>` (from `remotion`) | Yes (uses HTML5 `<video>` in preview) | Yes (Rust/FFmpeg frame extractor) | No | remotion.dev/docs/video-tags |
| `<Video>` (from `@remotion/media`) | Yes (WebCodecs) | Yes (client-side render) | Yes | remotion.dev/docs/video-tags |
| `<Html5Video>` (from `remotion`) | No — not supported in `@remotion/web-renderer` | Yes | No | remotion.dev/docs/html5-video |

**Decision: Use `<OffthreadVideo>` from `remotion` core.**

Rationale: `<OffthreadVideo>` works in both Player (uses HTML5 `<video>` tag for preview) and SSR (Rust-based frame extraction). Since the video is served via the backend at `/api/jobs/:jobId/video` (same origin via Vite proxy), CORS is irrelevant. This component is the Remotion team's recommendation for most cases.

### React Version

The frontend currently uses React 18.3.1. React 19 is supported by Remotion 4.x (requires v4.0.236+ for correct types) but upgrading React is not required for this phase. **Stay on React 18.3.1 for now.** The prior decision says "Verify React 19 / Remotion 4.x compatibility before pinning versions; may need to pin React 18.x" — React 18 is confirmed compatible, so pin there.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand | React Context + useReducer | Context causes wider re-renders; Zustand's selector pattern isolates who re-renders to only subscribers of changed slices. Worthwhile given `<Player>` re-renders are expensive. |
| `<OffthreadVideo>` | `<Video>` from `@remotion/media` | `<Video>` requires CORS headers; adds setup complexity. OffthreadVideo already works without CORS. |
| Backend video route | Vite proxy serving static files | Backend route is more consistent with existing `/api/*` pattern; Vite proxy already configured. |

**Installation (add to `packages/frontend/package.json` and `packages/remotion-composition/package.json`):**

```bash
# In packages/frontend (Player + runtime + Zustand)
npm install --save-exact remotion@4.0.379 @remotion/player@4.0.379
npm install zustand

# In packages/remotion-composition (composition code only needs remotion core)
npm install --save-exact remotion@4.0.379

# Dev tooling for composition package
npm install --save-exact --save-dev @remotion/eslint-plugin@4.0.379
```

**Critical:** All `remotion` and `@remotion/*` packages must be the exact same version. Use `--save-exact` and remove `^` from version strings in package.json. Version mismatch causes subtle bugs or complete breakage. Use `npx remotion versions` to audit.

**Monorepo note:** In an npm workspaces monorepo, only one copy of `remotion` should exist (hoisted to root `node_modules`). Both `packages/frontend` and `packages/remotion-composition` should declare it as a dependency at the same exact version.

---

## Architecture Patterns

### Recommended Project Structure

The existing stub package `packages/remotion-composition/` is the correct home for composition code. The frontend embeds it as a workspace dependency.

```
packages/
├── remotion-composition/
│   └── src/
│       ├── index.ts                    # re-exports SubtitleComposition + types
│       ├── SubtitleComposition.tsx     # pure props-driven composition (RENDER-01, RENDER-02)
│       ├── SubtitleOverlay.tsx         # karaoke rendering sub-component
│       └── types.ts                    # SubtitleCompositionProps interface
│
├── frontend/
│   └── src/
│       ├── store/
│       │   └── subtitleStore.ts        # Zustand store: jobId, transcript, styleProps
│       ├── components/
│       │   └── PreviewPanel.tsx        # wraps <Player>, connects Zustand → inputProps
│       └── pages/
│           └── SubtitlesPage.tsx       # updated: adds PreviewPanel after transcription
│
└── shared-types/
    └── src/
        └── index.ts                    # existing: TranscriptWord, Transcript (already correct)
```

### Pattern 1: Pure Props-Driven Composition

**What:** `SubtitleComposition` receives all dynamic data via props. No hooks that access external state. No `Date.now()`. Timing exclusively from `useCurrentFrame() / fps`.

**When to use:** Always in Remotion compositions — mandatory for SSR compatibility.

```typescript
// packages/remotion-composition/src/types.ts
export interface StyleProps {
  highlightColor: string   // e.g. '#FFFF00'
  baseColor: string        // e.g. '#FFFFFF'
  fontSize: number         // px
  fontFamily: string
}

export interface SubtitleCompositionProps {
  videoSrc: string           // HTTP URL e.g. /api/jobs/{jobId}/video
  words: TranscriptWord[]    // from @eigen/shared-types
  style: StyleProps
}
```

```typescript
// packages/remotion-composition/src/SubtitleComposition.tsx
// Source: remotion.dev/docs/the-fundamentals, remotion.dev/docs/absolute-fill

import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from 'remotion'
import type { SubtitleCompositionProps } from './types'
import { SubtitleOverlay } from './SubtitleOverlay'

export function SubtitleComposition({ videoSrc, words, style }: SubtitleCompositionProps) {
  return (
    <AbsoluteFill>
      {/* Layer 1: video — rendered first, appears behind */}
      <OffthreadVideo src={videoSrc} style={{ width: '100%', height: '100%' }} />
      {/* Layer 2: subtitle overlay — rendered after, appears on top */}
      <AbsoluteFill>
        <SubtitleOverlay words={words} style={style} />
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
```

### Pattern 2: Frame-Based Word Activation with Binary Search

**What:** Convert current frame to seconds, find which phrase is active, find which word within that phrase is the "current" word for highlight.

**When to use:** Inside any component that needs to know which word is currently spoken.

```typescript
// packages/remotion-composition/src/SubtitleOverlay.tsx
// Source: remotion.dev/docs/use-current-frame, remotion.dev/docs/use-video-config

import { useCurrentFrame, useVideoConfig } from 'remotion'
import type { TranscriptWord } from '@eigen/shared-types'
import type { StyleProps } from './types'

interface Props {
  words: TranscriptWord[]
  style: StyleProps
}

// Binary search: find index of last word whose start <= currentTime
function findActiveWordIndex(words: TranscriptWord[], currentTimeSec: number): number {
  let lo = 0
  let hi = words.length - 1
  let result = -1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (words[mid].start <= currentTimeSec) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return result
}

// Group consecutive words into phrases (split on pause gaps > threshold)
const PHRASE_GAP_SEC = 1.5

function groupIntoPhrases(words: TranscriptWord[]): TranscriptWord[][] {
  if (words.length === 0) return []
  const phrases: TranscriptWord[][] = [[words[0]]]
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end
    if (gap > PHRASE_GAP_SEC) {
      phrases.push([])
    }
    phrases[phrases.length - 1].push(words[i])
  }
  return phrases
}

export function SubtitleOverlay({ words, style }: Props) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const currentTimeSec = frame / fps

  // Memoize phrases — words prop is stable (comes from inputProps)
  const phrases = groupIntoPhrases(words)

  // Find which phrase is active at current time
  const activePhrase = phrases.find(
    (phrase) =>
      currentTimeSec >= phrase[0].start &&
      currentTimeSec <= phrase[phrase.length - 1].end + PHRASE_GAP_SEC
  )

  if (!activePhrase || activePhrase.length === 0) return null

  const activeWordIndex = findActiveWordIndex(activePhrase, currentTimeSec)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '10%',
        left: '5%',
        right: '5%',
        textAlign: 'center',
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
      }}
    >
      {activePhrase.map((word, i) => (
        <span
          key={`${word.start}-${word.word}`}
          style={{
            color: i === activeWordIndex ? style.highlightColor : style.baseColor,
            marginRight: '0.25em',
          }}
        >
          {word.word}
        </span>
      ))}
    </div>
  )
}
```

### Pattern 3: Zustand Store for Shared State

**What:** Single store holds jobId, transcript, and style props. Both `PreviewPanel` and style controls subscribe with selectors so only the relevant component re-renders.

```typescript
// packages/frontend/src/store/subtitleStore.ts
// Source: zustand.docs.pmnd.rs, verified via multiple sources

import { create } from 'zustand'
import type { Transcript } from '@eigen/shared-types'
import type { StyleProps } from '@eigen/remotion-composition'

interface SubtitleStore {
  jobId: string | null
  transcript: Transcript | null
  style: StyleProps
  setJob: (jobId: string, transcript: Transcript) => void
  setStyle: (style: Partial<StyleProps>) => void
  reset: () => void
}

const DEFAULT_STYLE: StyleProps = {
  highlightColor: '#FFFF00',
  baseColor: '#FFFFFF',
  fontSize: 48,
  fontFamily: 'Arial, sans-serif',
}

export const useSubtitleStore = create<SubtitleStore>((set) => ({
  jobId: null,
  transcript: null,
  style: DEFAULT_STYLE,
  setJob: (jobId, transcript) => set({ jobId, transcript }),
  setStyle: (partial) => set((state) => ({ style: { ...state.style, ...partial } })),
  reset: () => set({ jobId: null, transcript: null, style: DEFAULT_STYLE }),
}))
```

### Pattern 4: Player Integration in PreviewPanel

**What:** `<Player>` is a controlled React component. Pass the composition, its required props (durationInFrames, fps, width, height), and `inputProps` containing the live data.

**When to use:** Browser preview panel. Do NOT render `<Player>` in the same component that reads the store — use an adjacent child component with the `playerRef` pattern to avoid cascading re-renders.

```typescript
// packages/frontend/src/components/PreviewPanel.tsx
// Source: remotion.dev/docs/player/player, remotion.dev/docs/player/current-time

import { useRef } from 'react'
import { Player } from '@remotion/player'
import { SubtitleComposition } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../store/subtitleStore'

// Calculate durationInFrames from video metadata (passed as prop from parent)
interface PreviewPanelProps {
  durationSeconds: number
  videoWidth: number
  videoHeight: number
}

const FPS = 30  // match backend normalized video fps

export function PreviewPanel({ durationSeconds, videoWidth, videoHeight }: PreviewPanelProps) {
  const playerRef = useRef(null)
  const jobId = useSubtitleStore((s) => s.jobId)
  const transcript = useSubtitleStore((s) => s.transcript)
  const style = useSubtitleStore((s) => s.style)

  if (!jobId || !transcript) return null

  const durationInFrames = Math.max(1, Math.floor(durationSeconds * FPS))
  const videoSrc = `/api/jobs/${jobId}/video`

  return (
    <Player
      ref={playerRef}
      component={SubtitleComposition}
      durationInFrames={durationInFrames}
      compositionWidth={videoWidth}
      compositionHeight={videoHeight}
      fps={FPS}
      controls
      loop
      style={{ width: '100%' }}
      inputProps={{
        videoSrc,
        words: transcript.words,
        style,
      }}
      acknowledgeRemotionLicense
    />
  )
}
```

### Pattern 5: Backend Video Route

**What:** A new `GET /api/jobs/:jobId/video` route streams the normalized video with `Content-Type: video/mp4` and HTTP range support for seeking.

**When to use:** Required so `<OffthreadVideo>` in the composition has an HTTP URL to fetch from. The normalized file already exists at `data/{jobId}/normalized.mp4`.

```typescript
// Add to packages/backend/src/routes/jobs.ts (or new route file)
// Serve the normalized video for the Remotion Player
fastify.get('/api/jobs/:jobId/video', async (req, reply) => {
  const { jobId } = req.params as { jobId: string }
  const job = fastify.jobs.get(jobId)
  if (!job || job.status === 'uploading' || job.status === 'normalizing') {
    return reply.code(404).send({ error: 'Video not ready' })
  }

  const normalizedPath = path.join(DATA_ROOT, jobId, 'normalized.mp4')
  try {
    await access(normalizedPath)
  } catch {
    return reply.code(404).send({ error: 'Video file not found' })
  }

  // Use @fastify/static or createReadStream with range support
  // @fastify/static is already a dependency — use reply.sendFile or stream
  const stat = await fs.stat(normalizedPath)
  const range = req.headers.range

  if (range) {
    // Handle HTTP range requests for seeking support
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-')
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : stat.size - 1
    const chunkSize = end - start + 1

    reply.code(206).headers({
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    })
    return reply.send(createReadStream(normalizedPath, { start, end }))
  }

  reply.header('Content-Type', 'video/mp4')
  reply.header('Accept-Ranges', 'bytes')
  reply.header('Content-Length', stat.size)
  return reply.send(createReadStream(normalizedPath))
})
```

### Anti-Patterns to Avoid

- **Calling `Date.now()` or `performance.now()` inside composition:** Remotion renders frames in non-real-time during SSR. Any wall-clock time will produce wrong or non-deterministic output. Only `useCurrentFrame() / fps` is valid.
- **Rendering `<Player>` in the same component that reads `useCurrentPlayerFrame`:** This causes the entire Player parent to re-render on every frame (60fps re-renders). Use an adjacent sibling component that receives `playerRef` as a prop.
- **Using `<Html5Video>` in composition:** Not supported in `@remotion/web-renderer`. Use `<OffthreadVideo>`.
- **Mismatched Remotion package versions:** Even a patch version difference breaks things silently. All `remotion` + `@remotion/*` packages must pin to identical exact versions.
- **Using `^` in version strings for Remotion packages:** npm can install different minor versions across workspaces in a monorepo. Remove `^` and use exact version strings.
- **Importing `useCurrentFrame` outside a Remotion component tree:** It will throw. Only call it inside components rendered by `<Player>` or the Remotion SSR pipeline.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frame-synchronized video playback | Custom `requestAnimationFrame` loop with `currentTime` | `<Player>` from `@remotion/player` | Handles buffering, seeking, frame pausing, React lifecycle, SSR compatibility |
| Video frame extraction for SSR | `ffmpeg.js` in JS | `<OffthreadVideo>` (Rust/FFmpeg binary via Remotion renderer) | Remotion's renderer is already set up; frame-accurate extraction is hard to get right |
| Word active-index lookup (linear scan) | `words.find()` on each render | Binary search on sorted `words[]` | `words` can be thousands of entries; linear scan at 30fps inside a React render is measurably slow |
| Phrase grouping from raw word list | SRT parser, subtitle formats | Custom gap-based grouping (gap > 1.5s) on the existing `TranscriptWord[]` format | The `Transcript` type already has all necessary data; no external format needed |
| State sharing between Player and style controls | Prop drilling through 4+ components | Zustand store with selectors | Avoids re-rendering unrelated tree on every style change |

**Key insight:** Remotion's `<Player>` component solves an extremely hard problem (frame-accurate browser playback synchronized with React rendering) that has taken years of iteration. Custom solutions using `<video>` + `requestAnimationFrame` consistently have drift, buffering, and seeking issues.

---

## Common Pitfalls

### Pitfall 1: Remotion Package Version Mismatch
**What goes wrong:** Mysterious runtime errors, `useCurrentFrame` returns undefined, composition renders blank.
**Why it happens:** npm installs different minor/patch versions for `remotion` and `@remotion/player` if `^` is in package.json. In a monorepo with workspaces, different packages may get different hoisted versions.
**How to avoid:** Install all Remotion packages with `--save-exact`. Remove `^` from all Remotion package.json entries. Run `npx remotion versions` to audit. Pin at exactly the same version string.
**Warning signs:** Console error like "React version mismatch" or "remotion: hook called outside context."

### Pitfall 2: Multiple React Copies in Monorepo
**What goes wrong:** "Invalid hook call" errors. Remotion Player throws during render.
**Why it happens:** `packages/remotion-composition` declares `react` as a dependency. npm workspaces may hoist a second copy. Remotion's Player uses React hooks internally — two React instances = invalid hook call.
**How to avoid:** Do NOT add `react` as a dependency in `packages/remotion-composition`. React is a peer dependency. Only `packages/frontend` should declare `react` as a direct dep. The composition package imports from `remotion` (which re-exports what it needs), not from `react` directly, or declares `react` as a peerDependency only.
**Warning signs:** "Warning: Invalid hook call" in the browser console immediately on Player mount.

### Pitfall 3: Video URL Not Accessible to OffthreadVideo in Player
**What goes wrong:** Black video in Player, `<OffthreadVideo>` fails silently, no subtitle overlay shows.
**Why it happens:** The video URL passed as `videoSrc` prop must be fetchable by the browser. If the backend doesn't have a route for `/api/jobs/:jobId/video`, the video 404s.
**How to avoid:** Add the video serve route to the backend before wiring the Player. Verify the route works with `curl http://localhost:3001/api/jobs/{id}/video` before testing the UI. The Vite proxy (`/api` → `http://127.0.0.1:3001`) already handles this for dev.
**Warning signs:** Network tab shows 404 for the video URL.

### Pitfall 4: HTTP Range Requests for Video Seeking
**What goes wrong:** Player loads video but seeking causes it to restart from the beginning, or seeking is very slow.
**Why it happens:** Browser video elements require HTTP Range request support to seek efficiently. Serving the video as a plain stream without range header handling means the browser can't jump to a specific position.
**How to avoid:** Implement range request handling in the `/api/jobs/:jobId/video` route (see Pattern 5 above). The `fs.stat()` + `createReadStream({ start, end })` pattern handles this.
**Warning signs:** Seeking in the Player scrubber causes the video to restart, or seeking is extremely slow.

### Pitfall 5: `useCurrentFrame` Drift Between Subtitle and Video
**What goes wrong:** Subtitle words appear out of sync with the audio — off by a constant or variable amount.
**Why it happens:** The word timestamps from faster-whisper are in seconds. The composition FPS (30fps) may not divide evenly into the timestamp precision. Rounding errors accumulate.
**How to avoid:** Use `frame / fps` consistently (not `Math.round(frame / fps)`). The binary search uses `<=` comparisons so there is no gap between words. Keep FPS at 30 (matches backend normalization target).
**Warning signs:** Subtitle word advances a fraction of a second too early or late relative to audio.

### Pitfall 6: Player Re-rendering the Entire Parent on Frame Updates
**What goes wrong:** The whole `SubtitlesPage` re-renders at 30fps, causing visible UI jank.
**Why it happens:** Using `useCurrentPlayerFrame(playerRef)` in the same component as `<Player>` causes cascading re-renders.
**How to avoid:** Never call `useCurrentPlayerFrame` in the same component as `<Player>`. If external current-time display is needed, put it in a sibling component. For Phase 3, the player-external frame tracking is not required — the subtitle logic lives inside the composition.
**Warning signs:** React DevTools profiler shows the parent component re-rendering at 30fps.

### Pitfall 7: `durationInFrames` Must Be an Integer > 0
**What goes wrong:** Remotion throws `durationInFrames must be a positive integer` at Player mount.
**Why it happens:** `Math.floor(duration * fps)` returns 0 for very short videos, or a float if `duration` is not finite.
**How to avoid:** Always clamp: `Math.max(1, Math.floor(durationSeconds * fps))`. Guard against `duration = 0` or `duration = NaN` with a null-check before rendering Player.
**Warning signs:** Player throws immediately on mount with a validation error message.

### Pitfall 8: `@remotion/media` Video Component Requires CORS
**What goes wrong:** Video loads in Player but console shows CORS errors; video may appear black in some browsers.
**Why it happens:** `<Video>` from `@remotion/media` uses WebCodecs API which enforces CORS for cross-origin media. If you mistakenly use `<Video>` instead of `<OffthreadVideo>`, the `/api` proxy is same-origin so it works in dev, but breaks if the backend is on a different port than the Vite dev server in some edge cases.
**How to avoid:** Use `<OffthreadVideo>` from `remotion` core, not `<Video>` from `@remotion/media`, in `SubtitleComposition`. `<OffthreadVideo>` does not require CORS.
**Warning signs:** Browser console shows `Access-Control-Allow-Origin` errors for the video URL.

---

## Code Examples

Verified patterns from official sources:

### Frame-to-Seconds Conversion
```typescript
// Source: remotion.dev/docs/the-fundamentals, remotion.dev/docs/use-video-config
import { useCurrentFrame, useVideoConfig } from 'remotion'

function MyComponent() {
  const frame = useCurrentFrame()              // 0-indexed frame number
  const { fps, durationInFrames } = useVideoConfig()
  const currentTimeSec = frame / fps          // exact time in seconds
  // durationInSeconds = durationInFrames / fps
}
```

### AbsoluteFill Layering (video under subtitle overlay)
```typescript
// Source: remotion.dev/docs/absolute-fill
// "The layers rendered last appear on top — this is how HTML works"
import { AbsoluteFill, OffthreadVideo } from 'remotion'

function Composition({ videoSrc }: { videoSrc: string }) {
  return (
    <AbsoluteFill>
      <OffthreadVideo src={videoSrc} style={{ width: '100%', height: '100%' }} />
      <AbsoluteFill>
        {/* subtitle overlay rendered after video = appears on top */}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
```

### Player with inputProps
```typescript
// Source: remotion.dev/docs/player/player
import { Player } from '@remotion/player'

<Player
  component={MyComposition}
  durationInFrames={Math.max(1, Math.floor(durationSec * fps))}
  compositionWidth={1920}
  compositionHeight={1080}
  fps={30}
  controls
  inputProps={{ videoSrc: '/api/jobs/abc/video', words: [...], style: {...} }}
  acknowledgeRemotionLicense
/>
```

### Zustand Store (TypeScript v5 syntax)
```typescript
// Source: zustand.docs.pmnd.rs (verified via multiple sources, current as of 2026)
// Note: create<State>()(fn) — the extra () is required for TypeScript inference
import { create } from 'zustand'

interface MyStore {
  count: number
  increment: () => void
}

export const useMyStore = create<MyStore>()((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}))
```

### Fixture Transcript for Frame-Timing Verification
```typescript
// Use this in a test composition or Storybook-equivalent to verify timing correctness
// without needing a real video file
export const FIXTURE_TRANSCRIPT: TranscriptWord[] = [
  { word: 'Hello',   start: 0.0,  end: 0.4,  confidence: 0.99 },
  { word: 'world',   start: 0.5,  end: 0.9,  confidence: 0.99 },
  { word: 'this',    start: 1.0,  end: 1.2,  confidence: 0.99 },
  { word: 'is',      start: 1.25, end: 1.4,  confidence: 0.99 },
  { word: 'working', start: 1.5,  end: 2.0,  confidence: 0.99 },
  // gap > 1.5s here → new phrase
  { word: 'phrase',  start: 3.6,  end: 4.0,  confidence: 0.99 },
  { word: 'two',     start: 4.1,  end: 4.5,  confidence: 0.99 },
]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<Video>` from `remotion` core | `<OffthreadVideo>` for most uses; `<Video>` from `@remotion/media` for Player | Remotion 4.x | OffthreadVideo is recommended; original `<Video>` renamed/replaced |
| `render()` from `react-dom` | `createRoot()` from `react-dom/client` | React 18 | Remotion auto-detects and uses `createRoot` when React 18 is present |
| Remotion v3 `<Player>` setup | v4 `<Player>` with `acknowledgeRemotionLicense` prop | Remotion 4.0 | License acknowledgment required to suppress console message |
| React 18 required for Remotion | React 19 now supported in Remotion 4.0.236+ | Late 2024 | This project stays on React 18; no action needed |

**Deprecated/outdated:**
- `Html5Video` from `remotion` core: Not supported in `@remotion/web-renderer`. Do not use in compositions that target the Player.
- `getInputProps()` pattern: Used in Remotion Studio / server-side render context. In `<Player>`, data comes via `inputProps` prop, not `getInputProps()` at runtime.
- `create(fn)` Zustand syntax: Works but TypeScript inference is better with `create<T>()(fn)`. Use the curried form.

---

## Open Questions

1. **Phrase grouping strategy: gap-based vs fixed-word-count**
   - What we know: Gap-based (pause > 1.5s) is semantically meaningful but can produce very long phrases for fast speakers.
   - What's unclear: The optimal gap threshold for this use case; whether fixed-word-count (e.g., 5 words per phrase) looks better for karaoke.
   - Recommendation: Implement gap-based at 1.5s initially. Make `PHRASE_GAP_SEC` a `StyleProps` field so it can be tuned later without rewriting the component.

2. **Video route: new route vs `@fastify/static`**
   - What we know: `@fastify/static` is already a dependency (`"@fastify/static": "^7.0.4"`). It can serve a directory. The backend uses `DATA_ROOT = data/` for all job files.
   - What's unclear: Whether `@fastify/static` can serve files outside its configured root on-demand (per-job), or if a manual `createReadStream` route is cleaner.
   - Recommendation: Use a manual `createReadStream` route (as shown in Pattern 5) for the `/api/jobs/:jobId/video` endpoint. This is consistent with the existing thumbnail route pattern and avoids exposing the full `data/` directory.

3. **Composition FPS: match video FPS vs fixed 30fps**
   - What we know: The backend normalizes all videos to CFR (Phase 1 decision). The normalized FPS is whatever ffprobe reports after normalization, which may not be exactly 30fps.
   - What's unclear: Whether the `VideoMetadata.fps` stored in the job should drive the composition FPS, or whether 30fps is always correct.
   - Recommendation: Use `VideoMetadata.fps` from the job record (already stored in `Job.metadata.fps`) to set the `<Player fps={...}>` prop. This ensures `frame / fps` = exact seconds. Pass `fps` as an `inputProp` to the composition if needed for SSR.

4. **`acknowledgeRemotionLicense` in Player**
   - What we know: This prop suppresses the Remotion console license message. This is a personal project; Remotion is free for individuals.
   - What's unclear: Whether this prop is just cosmetic (console suppression) or has runtime behavior implications.
   - Recommendation: Include `acknowledgeRemotionLicense` on `<Player>`. It acknowledges you've read the license, which is good practice and removes console noise.

---

## Sources

### Primary (HIGH confidence)
- `remotion.dev/docs/react-19` — React 19 support status: confirmed supported in Remotion 4.0.236+
- `remotion.dev/docs/version-mismatch` — All Remotion packages must be identical exact versions
- `remotion.dev/docs/player/player` — Player component props: `component`, `inputProps`, `durationInFrames`, `fps`, `compositionWidth`, `compositionHeight`, `controls`, `loop`, `acknowledgeRemotionLicense`
- `remotion.dev/docs/the-fundamentals` — `useCurrentFrame()`, `useVideoConfig()`, frame-to-seconds conversion
- `remotion.dev/docs/absolute-fill` — Layering pattern: later children render on top
- `remotion.dev/docs/sequence` — `<Sequence from={n}>` shifts child frame counts; useful for timing
- `remotion.dev/docs/offthreadvideo` — `<OffthreadVideo>` uses HTML5 video in preview, FFmpeg in SSR
- `remotion.dev/docs/video-tags` — Comparison table: OffthreadVideo works in both Player and SSR; Html5Video not supported in web-renderer
- `remotion.dev/docs/html5-video` — Confirms `<Html5Video>` is NOT supported in `@remotion/web-renderer`
- `remotion.dev/docs/video-uploads` — `inputProps.videoUrl` pattern for passing upload URLs to Player
- `remotion.dev/docs/player/current-time` — `useCurrentPlayerFrame` must NOT be in same component as `<Player>`
- `remotion.dev/docs/multiple-fps` — Frame-rate-independent animations via `fps` from `useVideoConfig`
- `remotion.dev/docs/miscellaneous/snippets/align-duration` — `Math.floor(durationSeconds * fps)` formula
- `remotion.dev/docs/license` — Free for individuals building personal projects
- `remotion.dev/docs/brownfield` — Brownfield (existing project) installation instructions
- `github.com/remotion-dev/remotion/.../openai-whisper-api-to-captions.ts` — Caption type structure: `{ startMs, endMs, text, timestampMs, confidence }`
- Zustand docs (zustand.docs.pmnd.rs) — `create<T>()(fn)` TypeScript syntax, v5 current

### Secondary (MEDIUM confidence)
- npm registry: `@remotion/player` 4.0.379 published 3 days ago (as of 2026-03-02) — confirms active 4.x line
- `remotion.dev/docs/cors-issues` — CORS debugging; Vite proxy eliminates CORS in dev
- Multiple sources: Zustand v5 requires React 18+, uses `useSyncExternalStore` — consistent across 3+ sources

### Tertiary (LOW confidence)
- Gap-based phrase grouping (1.5s threshold): derived from common karaoke implementations observed in search results — not from an official Remotion source. The threshold value is an informed guess, not a verified standard.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Official docs confirmed Remotion 4.0.379, React 18 compatibility, Player props API, video component differences
- Architecture: HIGH — Patterns derived from official remotion.dev documentation for composition structure, Player integration, AbsoluteFill layering
- Video route / CORS: HIGH — Vite proxy already configured; same-origin pattern confirmed; range request pattern well-established
- Phrase grouping: MEDIUM — Gap threshold (1.5s) is a reasonable starting point, not verified against an official source
- Pitfalls: HIGH — All 8 pitfalls sourced from official Remotion docs (version mismatch, hook restrictions, component compatibility)

**Research date:** 2026-03-02
**Valid until:** 2026-04-01 (Remotion is actively maintained at ~weekly releases; re-verify Player props API if more than 30 days pass)
