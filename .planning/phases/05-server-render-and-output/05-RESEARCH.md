# Phase 5: Server Render and Output - Research

**Researched:** 2026-03-05
**Domain:** Remotion SSR (`@remotion/bundler` + `@remotion/renderer`), Node.js worker_threads, SSE progress streaming
**Confidence:** HIGH (Remotion API verified from official docs; patterns verified against existing codebase)

---

## Summary

Phase 5 introduces server-side rendering of MP4 files with burned-in subtitles using Remotion's Node.js renderer. The core flow is: `bundle()` → `selectComposition()` → `renderMedia()`. Critically, `bundle()` must be called once at server startup and reused for all renders — re-bundling per render is an anti-pattern that adds 5+ minutes of overhead.

The existing `SubtitleComposition` component uses `Video` from `'remotion'` (which is actually `Html5Video` — the basic HTML5 video element). This component works in both browser Player preview AND server `renderMedia()`, so no component changes are required for correctness. However, the Remotion docs recommend `OffthreadVideo` for server rendering because it uses Rust+FFmpeg for frame-perfect extraction, while `Html5Video` uses browser seek. This is a decision to surface for the planner — the current component works but may have quality or performance tradeoffs.

The biggest new requirement is a Remotion entry point file (`root.tsx` + `index.ts` calling `registerRoot`) inside the `remotion-composition` package, since `bundle()` requires a file that calls `registerRoot()`. The current package only exports components — it has no entry point.

Worker threads are the right isolation mechanism for `renderMedia()` because it spawns a headless Chrome (Chrome Headless Shell, auto-installed by Remotion) and runs CPU-intensive rendering. Progress is communicated from worker to main thread via `parentPort.postMessage()`, then the existing SSE polling pattern in `jobs.ts` picks it up from the job store without any new SSE infrastructure needed.

**Primary recommendation:** Use `@remotion/bundler` + `@remotion/renderer` 4.0.379 (matching pinned version), bundle at server startup, dispatch renders to a worker thread, stream progress via the existing SSE job status endpoint.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@remotion/bundler` | 4.0.379 (exact, no ^) | Webpack-bundles the Remotion composition for SSR | Required — `renderMedia()` needs a bundle URL |
| `@remotion/renderer` | 4.0.379 (exact, no ^) | `selectComposition()` + `renderMedia()` — the actual render engine | Official Remotion SSR API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:worker_threads` | built-in | Offload CPU-intensive `renderMedia()` from event loop | Always for render — prevents blocking Fastify |
| `node:path` | built-in | Resolve entry point absolute path for `bundle()` | Always |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| worker_threads | child_process | Worker threads share memory; child_process has separate memory. For Remotion rendering, either works — but worker threads are the plan spec |
| worker_threads | Direct async in route | Blocks Fastify event loop for 30s+ renders. Not viable |
| SSE polling (existing pattern) | WebSocket | SSE is already implemented and works. No reason to switch |

**Installation (in `packages/backend/`):**
```bash
npm install --save-exact @remotion/bundler@4.0.379 @remotion/renderer@4.0.379
```

Note: All remotion/\@remotion/* packages must be pinned to the same exact version. No `^`.

---

## Architecture Patterns

### Recommended Project Structure (additions to existing)

```
packages/
├── remotion-composition/
│   └── src/
│       ├── Root.tsx          # NEW: <Composition> registration with registerRoot
│       ├── index.ts          # NEW: entry point — calls registerRoot(Root)
│       ├── SubtitleComposition.tsx   # EXISTING
│       ├── SubtitleOverlay.tsx       # EXISTING
│       └── types.ts                  # EXISTING
│
└── backend/
    └── src/
        ├── services/
        │   ├── render.ts     # NEW: bundle once at startup, renderMedia() wrapper
        │   └── jobStore.ts   # MODIFY: add 'rendering' | 'rendered' statuses
        ├── workers/
        │   └── render-worker.ts   # NEW: worker thread that calls renderMedia()
        └── routes/
            └── render.ts     # NEW: POST /api/jobs/:jobId/render
```

---

### Pattern 1: Bundle Once at Server Startup

**What:** Call `bundle()` once when the Fastify server starts, store the bundle path in a module-level variable. Reuse for every render.

**Why:** `bundle()` runs Webpack — it takes several seconds to tens of seconds. Re-bundling per render is a documented anti-pattern in Remotion.

**When to use:** Always. Never call `bundle()` inside a route handler or render worker.

```typescript
// Source: https://www.remotion.dev/docs/ssr-node + https://www.remotion.dev/docs/bundle
import { bundle } from '@remotion/bundler'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Called once at server startup
let bundleLocation: string | null = null

export async function initBundle(): Promise<void> {
  bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, '../../remotion-composition/src/index.ts'),
    // rootDir must point to the package that installs remotion
    // In this monorepo, remotion is in packages/remotion-composition
  })
}

export function getBundleLocation(): string {
  if (!bundleLocation) throw new Error('Bundle not initialized')
  return bundleLocation
}
```

**Monorepo note:** The `entryPoint` must be an absolute path to the file that calls `registerRoot()`. Since Remotion packages live in `packages/remotion-composition`, that entry point is `packages/remotion-composition/src/index.ts`. The `rootDir` parameter should point to the directory containing the `package.json` that installs `remotion` — which is `packages/remotion-composition/`.

---

### Pattern 2: Remotion Entry Point (registerRoot)

**What:** `bundle()` requires an entry point file that calls `registerRoot()`. The current `remotion-composition` package has no such file — only component exports.

**What to add in `packages/remotion-composition/src/`:**

```typescript
// Root.tsx — registers the composition
// Source: https://www.remotion.dev/docs/register-root
import { Composition } from 'remotion'
import { SubtitleComposition, COMPOSITION_ID } from './SubtitleComposition'
import type { SubtitleCompositionProps } from './types'

const DEFAULT_PROPS: SubtitleCompositionProps = {
  videoSrc: '',
  phrases: [],
  style: {
    highlightColor: '#FFFF00',
    baseColor: '#FFFFFF',
    fontSize: 48,
    fontFamily: 'sans-serif',
  },
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMPOSITION_ID}
        component={SubtitleComposition}
        durationInFrames={300}   // placeholder — overridden via calculateMetadata or inputProps
        fps={30}                 // placeholder — overridden
        width={1920}             // placeholder — overridden
        height={1080}            // placeholder — overridden
        defaultProps={DEFAULT_PROPS}
      />
    </>
  )
}
```

```typescript
// index.ts — entry point (the file bundle() receives)
import { registerRoot } from 'remotion'
import { RemotionRoot } from './Root'

registerRoot(RemotionRoot)
```

**IMPORTANT:** The `<Composition>` durationInFrames/fps/width/height here are placeholders. The real values come from the video metadata and are passed via `inputProps` to `selectComposition()` and `renderMedia()`. See Pattern 4 for how dynamic metadata works.

---

### Pattern 3: renderMedia() in a Worker Thread

**What:** `renderMedia()` spawns a headless Chrome process and renders frames — it's CPU-bound and long-running. It must run in a worker thread to avoid blocking Fastify.

**Worker thread file** (`packages/backend/src/workers/render-worker.ts`):

```typescript
// Source: https://nodejs.org/api/worker_threads.html + https://www.remotion.dev/docs/renderer/render-media
import { parentPort, workerData } from 'node:worker_threads'
import { renderMedia, selectComposition } from '@remotion/renderer'
import type { SubtitleCompositionProps } from '@eigen/remotion-composition'

interface RenderWorkerData {
  bundleLocation: string
  outputPath: string
  inputProps: SubtitleCompositionProps
  durationInFrames: number
  fps: number
  width: number
  height: number
}

const { bundleLocation, outputPath, inputProps, durationInFrames, fps, width, height } =
  workerData as RenderWorkerData

const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: 'SubtitleComposition',
  inputProps,
})

// Override metadata with actual video values
const resolvedComposition = {
  ...composition,
  durationInFrames,
  fps,
  width,
  height,
}

await renderMedia({
  composition: resolvedComposition,
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation: outputPath,
  inputProps,
  onProgress: ({ progress }) => {
    // progress is 0–1 normalized
    parentPort?.postMessage({ type: 'progress', progress: Math.round(progress * 100) })
  },
})

parentPort?.postMessage({ type: 'done' })
```

**Spawning the worker** (from a route handler):

```typescript
// Source: https://nodejs.org/api/worker_threads.html
import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const worker = new Worker(
  path.resolve(__dirname, '../workers/render-worker.js'),  // .js after tsc compile
  { workerData: { bundleLocation, outputPath, inputProps, ... } }
)

worker.on('message', (msg) => {
  if (msg.type === 'progress') {
    updateJob(fastify.jobs, jobId, { progress: msg.progress })
  } else if (msg.type === 'done') {
    updateJob(fastify.jobs, jobId, { status: 'rendered', progress: 100, outputPath })
  }
})

worker.on('error', (err) => {
  updateJob(fastify.jobs, jobId, { status: 'failed', error: err.message })
})
```

**ESM/Worker thread note:** The backend runs with `node --experimental-strip-types` (plain TS stripping, not webpack/esbuild). Worker threads in this mode require pointing at the compiled `.js` file path, OR using `new URL(import.meta.url)` pattern if the worker is in the same file. Since the worker is a separate file, after `tsc` compile it will be a `.js` file. The dev mode with `--experimental-strip-types` can directly load `.ts` files for workers using `new URL('...', import.meta.url)` — but only if Node.js version supports it. **Verify this pattern works in the project's Node.js version before implementing.** An alternative is to keep the worker as a `.js` file written directly (no TS) or to use the `--experimental-vm-modules` approach.

---

### Pattern 4: Passing Dynamic Composition Metadata

**What:** The `<Composition>` in `Root.tsx` has static placeholder dimensions. For render, we need actual video dimensions and duration.

**How to supply dynamic values:** The backend already probes video with `probeVideo()` at upload time and stores `VideoMetadata` on the job. At render time, read this from the job store and pass directly to `selectComposition()` / `renderMedia()`:

```typescript
// Source: https://www.remotion.dev/docs/renderer/select-composition
const { fps, width, height, duration } = job.metadata!

const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: 'SubtitleComposition',
  inputProps,
})

// Override the static defaults with actual video metadata
const finalComposition = {
  ...composition,
  fps,
  width,
  height,
  durationInFrames: Math.floor(duration * fps),
}
```

**Do NOT use `calculateMetadata` for this project.** The backend already has all video metadata from the upload phase. `calculateMetadata` would add complexity (needs to fetch the video URL from inside the composition context). Pass metadata directly via the job store instead.

---

### Pattern 5: SSE Progress — No New Infrastructure Needed

**What:** The existing `GET /api/jobs/:jobId/status` SSE endpoint polls `fastify.jobs` every 500ms. The render worker posts progress updates via `parentPort.postMessage()`, which the route handler writes to the job store. The existing SSE automatically picks this up.

**Required job store changes:**

```typescript
// packages/shared-types/src/index.ts — add render statuses
export type JobStatus =
  | 'uploading' | 'normalizing' | 'ready'
  | 'transcribing' | 'transcribed'
  | 'diarizing'
  | 'rendering'    // NEW
  | 'rendered'     // NEW
  | 'failed'

// Add to Job interface:
outputPath?: string  // absolute path to output.mp4 (internal only — not sent to client)
```

**SSE terminal state:** The existing SSE closes on `transcribed` or `failed`. It must also close on `rendered`. Update `jobs.ts` SSE handler to add `rendered` to terminal states.

---

### Pattern 6: Download Endpoint

**What:** Once render is complete, serve the output MP4 for download.

```typescript
// GET /api/jobs/:jobId/download
fastify.get('/api/jobs/:jobId/download', async (req, reply) => {
  const { jobId } = req.params as { jobId: string }
  const job = fastify.jobs.get(jobId)

  if (!job || job.status !== 'rendered' || !job.outputPath) {
    return reply.code(404).send({ error: 'Render not complete' })
  }

  reply.header('Content-Disposition', `attachment; filename="output-${jobId}.mp4"`)
  reply.header('Content-Type', 'video/mp4')
  return reply.send(createReadStream(job.outputPath))
})
```

---

### Anti-Patterns to Avoid

- **Calling `bundle()` per render:** Webpack takes 5-60 seconds. Anti-pattern per official Remotion docs. Call once at startup.
- **Calling `renderMedia()` directly in route handler:** Blocks Node.js event loop for entire render duration. All renders must be in worker threads.
- **Calling `bundle()` from inside a webpack/esbuild-bundled file:** Will fail. The backend uses `--experimental-strip-types` (plain TS stripping), not webpack, so this is safe.
- **Using `calculateMetadata` when metadata is already available:** Adds latency and complexity. The backend already has video metadata from the upload phase.
- **Re-passing `videoSrc` as a local file path to the composition:** During `renderMedia()`, the headless Chrome runs in a browser context and cannot access the server's filesystem. The `videoSrc` must be an HTTP URL that the render server can fetch. Since the backend itself serves `/api/jobs/:jobId/video`, use that URL with `http://localhost:3001/...`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video frame extraction at render time | Custom FFmpeg pipeline | `@remotion/renderer` renderMedia() | Remotion handles frame-perfect extraction, audio mixing, encoding |
| Headless browser management | Manual Chrome spawn | Remotion auto-manages Chrome Headless Shell | Auto-installed into node_modules, lifecycle managed by renderer |
| MP4 encoding/stitching | Direct FFmpeg in render | `renderMedia(codec: 'h264')` | Remotion calls FFmpeg internally after frame render |
| Bundle caching | Custom file cache | Store `bundle()` return value in module-level variable | Bundle returns a filesystem path that persists |

**Key insight:** `renderMedia()` handles everything — opening Chrome, rendering frames, calling FFmpeg, stitching the MP4. Don't touch FFmpeg for render output.

---

## Common Pitfalls

### Pitfall 1: `videoSrc` Must Be an HTTP URL, Not a File Path
**What goes wrong:** The composition receives `videoSrc` as a prop. During `renderMedia()`, this runs in headless Chrome. Chrome cannot resolve filesystem paths like `/Users/.../data/jobId/normalized.mp4`.
**Why it happens:** `renderMedia()` opens a real browser context. The browser cannot access arbitrary filesystem paths.
**How to avoid:** Set `videoSrc` to the HTTP URL: `http://localhost:3001/api/jobs/${jobId}/video`. The backend serves this endpoint already.
**Warning signs:** Chrome console errors about invalid URL, blank video frame in rendered output.

### Pitfall 2: Missing Remotion Entry Point (`registerRoot` required)
**What goes wrong:** `bundle()` throws if the entry point file does not call `registerRoot()`.
**Why it happens:** `bundle()` validates that the entry point registers a Remotion root.
**How to avoid:** Create `packages/remotion-composition/src/Root.tsx` and `packages/remotion-composition/src/index.ts` (calling `registerRoot`). This is separate from the existing `dist/index.js` that the frontend imports.
**Warning signs:** Error from `bundle()`: "does not contain registerRoot" or similar.

### Pitfall 3: Worker Thread File Path Resolution After tsc Compile
**What goes wrong:** `new Worker('./workers/render-worker.ts')` fails at runtime after tsc compile because the file is `render-worker.js`.
**Why it happens:** Worker threads take a file path, not a module name. Extension must match what's on disk.
**How to avoid:** Use `.js` extension in the `new Worker(...)` path, OR use `new URL('../workers/render-worker.ts', import.meta.url)` which works with `--experimental-strip-types` (Node.js will resolve `.ts` files when running in strip-types mode). Verify which approach works before committing to either.
**Warning signs:** `Error: Cannot find module` when spawning worker.

### Pitfall 4: Version Mismatch Between Remotion Packages
**What goes wrong:** `@remotion/bundler@4.0.380` + `@remotion/renderer@4.0.379` causes runtime errors.
**Why it happens:** Remotion packages are tightly coupled by version. Even a patch version mismatch causes issues.
**How to avoid:** Pin ALL remotion/\@remotion/* packages to the exact same version. Project is already using `4.0.379` pinned with no `^` — install new packages the same way.
**Warning signs:** Runtime errors about mismatched API, unexpected null returns from rendering.

### Pitfall 5: SSE Stream Not Closed After Render Completes
**What goes wrong:** Browser SSE client stays connected forever after render finishes.
**Why it happens:** The existing SSE handler only closes on `transcribed` and `failed` — not `rendered`.
**How to avoid:** Add `rendered` to the terminal state check in `routes/jobs.ts` SSE interval.
**Warning signs:** SSE connection stays open in browser network tab after download button appears.

### Pitfall 6: bundle() Called from Within Webpack/ESBuild-Bundled Code
**What goes wrong:** `bundle()` from `@remotion/bundler` fails when the calling code is itself webpack/esbuild-bundled.
**Why it happens:** `bundle()` uses Webpack internally, which conflicts with being inside a bundle.
**How to avoid:** Not an issue here — the backend uses `node --experimental-strip-types` (plain TS stripping, NOT webpack or esbuild). `bundle()` can be called safely from the backend.
**Warning signs:** Only relevant if the backend build process ever switches to webpack/esbuild.

### Pitfall 7: Html5Video vs OffthreadVideo — Frame Accuracy
**What goes wrong:** The current composition uses `Video` from `'remotion'` (= `Html5Video`). During `renderMedia()`, this uses browser seek (`currentTime = frame/fps`) which may produce off-by-one frame errors on some videos.
**Why it happens:** `Html5Video` relies on the browser's `currentTime` seek accuracy. `OffthreadVideo` uses Rust+FFmpeg for exact frame extraction.
**How to avoid:** Consider switching to `OffthreadVideo` for server renders (while keeping `Video` / `Html5Video` for browser Player preview) using `useRemotionEnvironment().isRendering` conditional, OR accept the current `Html5Video` behavior for now (it works, just potentially slightly less frame-accurate).
**Decision needed:** The plan notes say "Video (not OffthreadVideo) for browser Player" — this is already decided for the Player. The question is whether to use `OffthreadVideo` during `renderMedia()` via the `isRendering` conditional. See Open Questions.
**Warning signs:** Subtitle timing in rendered video doesn't exactly match browser preview.

### Pitfall 8: `durationInFrames` Must Be Integer
**What goes wrong:** `renderMedia()` throws if `durationInFrames` is not an integer.
**Why it happens:** `Math.floor(duration * fps)` — must use `Math.floor`, not `Math.round` or raw multiplication.
**How to avoid:** Always `Math.floor(duration * fps)` when computing `durationInFrames`.

---

## Code Examples

Verified patterns from official sources:

### Complete SSR Flow (Official Remotion Pattern)
```typescript
// Source: https://www.remotion.dev/docs/ssr-node
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import path from 'node:path'

// Step 1: Bundle once at startup (not per render)
const bundleLocation = await bundle({
  entryPoint: path.resolve('./src/index.ts'),
  webpackOverride: (config) => config,
})

// Step 2: Get composition with inputProps
const inputProps = { foo: 'bar' }
const composition = await selectComposition({
  serveUrl: bundleLocation,
  id: 'MyComposition',
  inputProps,
})

// Step 3: Render to file
await renderMedia({
  composition,
  serveUrl: bundleLocation,
  codec: 'h264',
  outputLocation: 'out/output.mp4',
  inputProps,
  onProgress: ({ progress }) => {
    // progress is 0–1 (multiply by 100 for percentage)
    console.log(`${Math.round(progress * 100)}% complete`)
  },
})
```

### onProgress Callback Shape
```typescript
// Source: https://www.remotion.dev/docs/renderer/render-media (verified)
onProgress: ({
  progress,          // number 0–1 — overall progress (use this for simple progress bars)
  renderedFrames,    // number — frames rendered so far
  encodedFrames,     // number — frames encoded so far
  renderedDoneIn,    // number | null — ms taken to render all frames (null until done)
  encodedDoneIn,     // number | null — ms taken to encode (null until done)
  stitchStage,       // 'encoding' | 'muxing'
}) => void
```

### Worker Thread Communication Pattern (Node.js)
```typescript
// Source: https://nodejs.org/api/worker_threads.html

// In worker:
import { parentPort } from 'node:worker_threads'
parentPort?.postMessage({ type: 'progress', value: 42 })
parentPort?.postMessage({ type: 'done' })

// In main thread:
import { Worker } from 'node:worker_threads'
const worker = new Worker(workerFilePath, { workerData: { ... } })
worker.on('message', (msg) => { /* handle progress/done */ })
worker.on('error', (err) => { /* handle error */ })
worker.on('exit', (code) => { /* handle unexpected exit */ })
```

### Conditional OffthreadVideo vs Html5Video (useRemotionEnvironment)
```typescript
// Source: https://www.remotion.dev/docs/miscellaneous/snippets/offthread-video-while-rendering
import { useRemotionEnvironment, OffthreadVideo } from 'remotion'

// Inside SubtitleComposition:
const { isRendering } = useRemotionEnvironment()

if (isRendering) {
  return <OffthreadVideo src={videoSrc} />
}
return <Video src={videoSrc} />  // Video from 'remotion' (Html5Video) for browser Player
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `renderFrames()` + `stitchFramesToVideo()` | Single `renderMedia()` call | Remotion v3.0 | Simplified API, one function does both |
| Manual Chrome management | Auto-installed Chrome Headless Shell | Remotion v4.0 | Zero manual browser setup |
| `getVideoMetadata()` from `@remotion/renderer` | `parseMedia()` (newer API) | v4.0+ | `getVideoMetadata()` is deprecated; for this project, use existing `probeVideo()` from ffprobe instead |
| `Video` from `'remotion'` | Now officially called `Html5Video` | v4.0+ | The old `Video` export from `'remotion'` was renamed to `Html5Video`. It's still exported as `Video` for compatibility but is the same thing. |

**Deprecated/outdated:**
- `getVideoMetadata()` from `@remotion/renderer`: deprecated in favor of `parseMedia()`. Irrelevant here — we use `probeVideo()` from the existing backend ffprobe service.
- `@remotion/media-utils` `getVideoMetadata()`: browser-only, cannot call on local files. Irrelevant for server-side use.

---

## Open Questions

1. **Html5Video vs OffthreadVideo during renderMedia()**
   - What we know: `Html5Video` (`Video` from `'remotion'`) works during `renderMedia()`. Remotion docs call `OffthreadVideo` "our recommendation" for server rendering (frame-perfect via Rust+FFmpeg). The project already decided "Video (not OffthreadVideo) for browser Player" — this is about the server render, not Player.
   - What's unclear: Whether the subtitle timing difference between `Html5Video` and `OffthreadVideo` during render is perceptible for this use case (karaoke-style subtitle burn-in).
   - Recommendation: For phase planning, surface this as an option. The safe path is to add the `useRemotionEnvironment().isRendering` conditional so `OffthreadVideo` is used for server render and `Video` (Html5Video) for browser Player. The `SubtitleComposition.tsx` change is minimal. Mark as planner decision.

2. **Worker thread file resolution in `--experimental-strip-types` mode**
   - What we know: The backend runs with `node --experimental-strip-types` for dev. Worker files must be referenced by path.
   - What's unclear: Whether `new Worker(new URL('../workers/render-worker.ts', import.meta.url))` works in this mode for loading a separate `.ts` file.
   - Recommendation: Plan 05-01 should verify this at the start of implementation with a trivial test worker. If `.ts` doesn't resolve, use `.js` worker files (write workers as `.js` or use a separate compile step).

3. **Bundle entry point separate from package exports**
   - What we know: `bundle()` needs a file with `registerRoot()`. The existing `packages/remotion-composition/src/index.ts` only has component exports. A new entry point file is needed.
   - What's unclear: Whether the new entry point (`Root.tsx` + new `index.ts`) interferes with the existing package exports (since both would be named `index.ts`).
   - Recommendation: Use a different filename for the Remotion entry point: `packages/remotion-composition/src/remotion-entry.ts` (calls `registerRoot`). This avoids colliding with the existing `src/index.ts` that the frontend imports.

---

## Sources

### Primary (HIGH confidence)
- [renderMedia() official docs](https://www.remotion.dev/docs/renderer/render-media) — onProgress shape, required/optional params, return value
- [Server-Side Rendering Node.js guide](https://www.remotion.dev/docs/ssr-node) — complete 3-step bundle/select/render example
- [bundle() official docs](https://www.remotion.dev/docs/bundle) — caching guidance, anti-patterns, entryPoint
- [OffthreadVideo docs](https://www.remotion.dev/docs/offthreadvideo) — preview vs render behavior
- [video-tags comparison](https://www.remotion.dev/docs/video-tags) — Html5Video vs OffthreadVideo vs Video (@remotion/media) comparison table
- [registerRoot() docs](https://www.remotion.dev/docs/register-root) — entry point requirements
- [align-duration snippet](https://www.remotion.dev/docs/miscellaneous/snippets/align-duration) — calculateMetadata pattern (not used, but verified)
- [Chrome Headless Shell docs](https://www.remotion.dev/docs/miscellaneous/chrome-headless-shell) — auto-install behavior
- [isRendering / useRemotionEnvironment docs](https://www.remotion.dev/docs/use-remotion-environment) — conditional component pattern
- [Calling bundle in bundled code](https://www.remotion.dev/docs/troubleshooting/bundling-bundle) — confirmed safe with plain TS stripping
- [Node.js worker_threads docs](https://nodejs.org/api/worker_threads.html) — workerData, parentPort, postMessage

### Secondary (MEDIUM confidence)
- [getVideoMetadata() from @remotion/renderer](https://www.remotion.dev/docs/renderer/get-video-metadata) — confirmed deprecated, use project's existing probeVideo instead

### Tertiary (LOW confidence)
- WebSearch results on bundle caching behavior — confirmed by official docs, upgraded to HIGH

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — official docs confirm `@remotion/bundler` + `@remotion/renderer` are the correct packages
- Architecture: HIGH — 3-step bundle/select/render is the documented official pattern; worker thread + SSE aligns with existing codebase patterns
- Pitfalls: HIGH — most pitfalls verified against official docs; worker thread `.ts` resolution (Pitfall 3) is MEDIUM pending testing
- Video component decision (Html5Video vs OffthreadVideo for render): MEDIUM — both work, but recommendation is unclear without testing subtitle timing accuracy

**Research date:** 2026-03-05
**Valid until:** 2026-04-04 (30 days — Remotion 4.x is stable)
