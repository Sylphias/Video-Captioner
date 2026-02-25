# Phase 1: Foundation - Research

**Researched:** 2026-02-25
**Domain:** Monorepo scaffold, Fastify backend, React/Vite frontend, FFmpeg video normalization
**Confidence:** HIGH (stack verified against npm registry, official docs, and Context7)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Tool shell & navigation
- Fixed horizontal tabs in the header — always visible
- For v1: single "Subtitles" tab only, no placeholder/coming-soon slots — add tabs as tools are built
- Header layout: "Eigen Video Editor" app name on the left, tool tabs on the right
- Landing page for Subtitles tool: centered upload prompt area ("Drop a video or click to upload")

#### Upload experience
- Drag-and-drop zone that also works as a click-to-open file picker
- Progress bar + status text feedback: "Uploading... 45%" → "Normalizing video..." → "Ready"
- After upload completes: show video info (thumbnail, duration, resolution) + "Transcribe" button — user controls when to start transcription
- No file size limit — accept anything, it's local storage
- Manual cleanup only — job files (source video, transcript, output) persist until user explicitly deletes them

#### Video normalization strategy
- **Critical decision:** Normalization (VFR-to-CFR, H.264) is applied to an internal copy for transcription and preview use ONLY
- The original uploaded video is preserved as-is for the final render output — no quality degradation from re-encoding
- Two video files per job: `original.*` (untouched) and `normalized.mp4` (for pipeline use)

#### Visual direction
- Dark mode — dark background, light text
- Professional/sleek aesthetic — DaVinci Resolve as reference
- Color palette: shades of grey with green accents — monochrome base, green for interactive elements and highlights
- No bright colors, no playful design — professional video tool feel

#### Project structure
- npm workspaces monorepo with 4 packages: `@eigen/frontend`, `@eigen/backend`, `@eigen/remotion-composition`, `@eigen/shared-types`
- Job data stored in `data/` folder at repo root (gitignored)

### Claude's Discretion
- Port assignments for frontend dev server and backend API
- Exact folder layout within `data/` (job-id-based subfolders)
- Header typography and spacing details
- Loading skeleton / spinner design choices
- Upload drop zone visual design (border style, icon choice)

### Deferred Ideas (OUT OF SCOPE)
- Job history / dashboard view (browse previous jobs) — potential future enhancement, not in Phase 1's upload-prompt landing
- Auto-start transcription after upload — user preferred explicit "Transcribe" button for control
</user_constraints>

---

## Summary

Phase 1 covers three technically independent concerns that must compose cleanly: (1) the npm workspaces monorepo scaffold with TypeScript project references, (2) a Fastify 5 backend serving multipart uploads, running FFmpeg normalization, and exposing job state via SSE, and (3) a React 19 + Vite 7 SPA with dark-mode CSS variables and a drag-drop upload zone.

The single most important external dependency decision is FFmpeg access. **fluent-ffmpeg was archived by its maintainer on May 22, 2025** and is no longer maintained. For this project — a local Mac Mini tool with a fixed, repeated FFmpeg operation — the correct approach is to call FFmpeg directly via Node's `child_process.spawn` wrapped in a typed Promise. FFmpeg itself should be installed via Homebrew (`brew install ffmpeg`); the `ffmpeg-static` npm package is a viable fallback but brings a bundled binary that is older than Homebrew's (6.1 vs 7.x). This is a local tool, so system FFmpeg is the clear right choice.

All other stack choices are stable, actively maintained, and verified against the npm registry as of February 2026: Fastify 5.7.4, `@fastify/multipart` 9.4.0, Vite 7.3.1, React 19.2.4, TypeScript 5.9.3. For progress feedback during the FFmpeg normalization step, SSE via `@fastify/sse` is the correct fit — it is a one-way server-to-client push and requires no WebSocket complexity.

**Primary recommendation:** Use system Homebrew FFmpeg + `child_process.spawn` wrapper for all video processing; `@fastify/multipart` for streaming upload; `@fastify/sse` for real-time progress; `react-dropzone` for the upload zone; CSS custom properties on `<html>` for dark-mode theming; TypeScript project references with `composite: true` for the monorepo.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 5.7.4 | HTTP server, routing, plugin system | Best-in-class Node.js framework performance; native TypeScript; active v5 |
| @fastify/multipart | 9.4.0 | Streaming multipart/form-data upload | Official Fastify plugin; backed by busboy; stream-native |
| @fastify/cors | 11.2.0 | CORS for LAN access from browser | Official plugin; needed so Vite dev proxy or another-device browser can reach backend |
| @fastify/static | 9.0.0 | Serve production build of frontend | Official; pairs with Fastify; used for production deployment |
| vite | 7.3.1 | Frontend dev server + bundler | Current standard for React SPAs; HMR, instant cold start |
| @vitejs/plugin-react | 5.1.4 | React Fast Refresh in Vite | Required companion to Vite for React |
| react | 19.2.4 | UI framework | Current stable; concurrent mode, no deprecation concerns |
| react-dom | 19.2.4 | DOM rendering | Paired with react |
| typescript | 5.9.3 | Type safety across all packages | Required for composite monorepo project references |
| uuid | 13.0.0 | Generate unique job IDs | Zero-dependency, cryptographically random |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/sse | (latest) | Server-Sent Events | Push upload/normalization progress to frontend |
| react-dropzone | 15.0.0 | File drag-and-drop zone + click picker | Purpose-built for OS-to-browser file drops; not dnd-kit |
| @types/react | 19.x | TypeScript types for React | Required for TSX compilation |
| @types/node | 22.x | TypeScript types for Node.js APIs | Required for backend (child_process, fs, path, stream) |

### FFmpeg Access (Critical Decision)

**Use system FFmpeg via Homebrew.** Do not use `fluent-ffmpeg` (archived May 2025, no longer maintained). Do not use `ffmpeg-static` unless the deployment machine will not have Homebrew.

| Approach | Verdict | Reason |
|----------|---------|--------|
| Homebrew `brew install ffmpeg` | **USE THIS** | Native arm64, FFmpeg 7.x, full codec support, always up to date |
| `ffmpeg-static` npm | Fallback only | Ships FFmpeg 6.1.1; works on arm64 but older; adds ~100MB to node_modules |
| `fluent-ffmpeg` npm | **DO NOT USE** | Archived May 2025, unmaintained, breaks with recent FFmpeg |
| `ffmpeg.wasm` | Not applicable | Browser-focused; large overhead; wrong tool for server-side normalization |

FFmpeg path for M4 Mac Mini with Homebrew: `/opt/homebrew/bin/ffmpeg` and `/opt/homebrew/bin/ffprobe`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| system ffmpeg + spawn | `ffmpeg-static` | Static binary avoids system dependency but older FFmpeg version (6.1 vs 7.x) |
| react-dropzone | dnd-kit | dnd-kit is for UI reordering; does NOT handle OS-level file drag from desktop |
| @fastify/sse | WebSocket | SSE is one-way push (correct for progress); WebSocket adds unnecessary bidirectional complexity |
| CSS custom properties | Tailwind | CSS vars are lighter, more appropriate for a fixed dark theme with no user theming toggle |

### Installation

Root workspace:
```bash
npm install -ws
```

Backend package (`packages/backend`):
```bash
npm install fastify @fastify/multipart @fastify/cors @fastify/sse @fastify/static
npm install --save-dev typescript @types/node
```

Frontend package (`packages/frontend`):
```bash
npm install react react-dom react-dropzone
npm install --save-dev vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

Shared types (`packages/shared-types`):
```bash
npm install --save-dev typescript
```

System dependency (must be documented in README):
```bash
brew install ffmpeg
```

---

## Architecture Patterns

### Recommended Project Structure

```
eigen-video-editor/                  # repo root
├── package.json                     # npm workspaces root; "workspaces": ["packages/*"]
├── tsconfig.base.json               # shared TS compiler options; composite: true
├── tsconfig.build.json              # root build references all 4 packages
├── data/                            # gitignored; job data at runtime
│   └── {job-id}/
│       ├── original.{ext}           # untouched original upload
│       ├── normalized.mp4           # VFR→CFR H.264 copy for pipeline
│       └── thumbnail.jpg            # extracted at ~1s mark
└── packages/
    ├── shared-types/                # @eigen/shared-types
    │   ├── package.json
    │   ├── tsconfig.json            # extends base; composite: true
    │   └── src/
    │       └── index.ts             # Job, JobStatus, VideoMetadata types
    ├── backend/                     # @eigen/backend
    │   ├── package.json
    │   ├── tsconfig.json            # extends base; references shared-types
    │   └── src/
    │       ├── index.ts             # Fastify server bootstrap
    │       ├── plugins/
    │       │   ├── cors.ts
    │       │   ├── multipart.ts
    │       │   └── static.ts
    │       ├── routes/
    │       │   ├── upload.ts        # POST /api/upload
    │       │   └── jobs.ts          # GET /api/jobs/:jobId/status (SSE)
    │       ├── services/
    │       │   ├── jobStore.ts      # in-memory Map<jobId, Job>
    │       │   ├── ffmpeg.ts        # spawn wrapper: normalize + ffprobe
    │       │   └── thumbnail.ts     # spawn wrapper: screenshot at 1s
    │       └── types.ts
    ├── frontend/                    # @eigen/frontend
    │   ├── package.json
    │   ├── vite.config.ts           # proxy /api → backend; host: true for LAN
    │   ├── tsconfig.json            # extends base; references shared-types
    │   └── src/
    │       ├── main.tsx
    │       ├── App.tsx              # header + tab routing
    │       ├── styles/
    │       │   ├── tokens.css       # CSS custom properties: --color-bg, --color-accent-green, etc.
    │       │   └── global.css
    │       ├── components/
    │       │   ├── Header.tsx
    │       │   ├── TabNav.tsx
    │       │   └── UploadZone.tsx
    │       ├── pages/
    │       │   └── SubtitlesPage.tsx
    │       └── hooks/
    │           ├── useUpload.ts     # upload + SSE progress hook
    │           └── useSSE.ts        # generic SSE subscription hook
    └── remotion-composition/        # @eigen/remotion-composition
        ├── package.json
        └── src/
            └── index.ts            # stub for Phase 1
```

### Pattern 1: npm Workspaces + TypeScript Project References

**What:** npm workspaces handles package linking at runtime (symlinks in node_modules). TypeScript project references handle type-checking across packages at compile time. Both are required together.

**When to use:** Whenever a package imports from another package in the monorepo (`import type { Job } from '@eigen/shared-types'`).

**Root `package.json`:**
```json
{
  "name": "eigen-video-editor",
  "private": true,
  "workspaces": ["packages/*"]
}
```

**Root `tsconfig.base.json`:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "strict": true,
    "skipLibCheck": true
  }
}
```

**Root `tsconfig.build.json`** (build all packages together):
```json
{
  "files": [],
  "references": [
    { "path": "packages/shared-types" },
    { "path": "packages/backend" },
    { "path": "packages/frontend" },
    { "path": "packages/remotion-composition" }
  ]
}
```

**Per-package `tsconfig.json`** (example: backend depends on shared-types):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "references": [{ "path": "../shared-types" }]
}
```

**Build command:** `tsc --build tsconfig.build.json` (not plain `tsc`).

### Pattern 2: Fastify Server with Plugin Architecture

**What:** Each concern (CORS, multipart, routes) is a Fastify plugin registered in order. Plugins execute sequentially.

**When to use:** Always — this is Fastify's fundamental architectural model.

```typescript
// Source: https://fastify.dev/docs/latest/Guides/Getting-Started/
// packages/backend/src/index.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'

const fastify = Fastify({ logger: true })

// Register order: plugins → decorators → routes
await fastify.register(cors, { origin: true })
await fastify.register(multipart, {
  limits: { fileSize: 0 }  // 0 = unlimited; project requirement
})

fastify.register(uploadRoutes)
fastify.register(jobRoutes)

await fastify.listen({ port: 3001, host: '0.0.0.0' })  // 0.0.0.0 = LAN accessible
```

### Pattern 3: In-Memory Job Store via Fastify Decorator

**What:** A `Map<string, Job>` decorated onto the Fastify instance, accessible from all plugins and routes.

**When to use:** Phase 1 has no persistence requirement. The job store is in-process state.

```typescript
// packages/backend/src/services/jobStore.ts
import { FastifyInstance } from 'fastify'
import type { Job } from '@eigen/shared-types'

export function jobStorePlugin(fastify: FastifyInstance) {
  const jobs = new Map<string, Job>()
  fastify.decorate('jobs', jobs)
}

// Usage in route:
fastify.post('/api/upload', async (req, reply) => {
  const jobId = crypto.randomUUID()
  fastify.jobs.set(jobId, { id: jobId, status: 'uploading', progress: 0 })
  // ...
})
```

### Pattern 4: Upload Route — Stream to Disk, then Spawn FFmpeg

**What:** Stream the multipart upload directly to `data/{jobId}/original.{ext}` without buffering in memory. After stream completes, update job state and spawn FFmpeg normalization asynchronously. Return `jobId` to client immediately so it can connect to SSE for progress.

**When to use:** Required for "no file size limit" constraint — buffering large files in memory will crash the process.

```typescript
// Source: https://github.com/fastify/fastify-multipart
// packages/backend/src/routes/upload.ts
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'

fastify.post('/api/upload', async (req, reply) => {
  const data = await req.file()
  if (!data) return reply.status(400).send({ error: 'No file provided' })

  const jobId = uuidv4()
  const ext = path.extname(data.filename) || '.mp4'
  const jobDir = path.join(DATA_ROOT, jobId)

  await fs.mkdir(jobDir, { recursive: true })
  fastify.jobs.set(jobId, { id: jobId, status: 'uploading', progress: 0 })

  // Stream to disk — never buffer
  const originalPath = path.join(jobDir, `original${ext}`)
  await pipeline(data.file, createWriteStream(originalPath))

  // Reply immediately with jobId; normalization runs async
  reply.status(202).send({ jobId })

  // Fire-and-forget normalization (errors written to job state)
  runNormalization(fastify, jobId, originalPath, jobDir).catch(err => {
    fastify.jobs.set(jobId, { ...fastify.jobs.get(jobId)!, status: 'failed', error: err.message })
  })
})
```

### Pattern 5: FFmpeg Invocation via `child_process.spawn`

**What:** A typed Promise wrapper around `spawn('ffmpeg', args)`. FFmpeg outputs progress to stderr; parse it to emit SSE events. Never use `exec` — it buffers all output in memory, fatal for large video files.

**When to use:** All FFmpeg operations: normalization, ffprobe metadata, thumbnail extraction.

```typescript
// packages/backend/src/services/ffmpeg.ts
import { spawn } from 'node:child_process'

const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const FFPROBE = '/opt/homebrew/bin/ffprobe'

export function spawnFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args)
    let stderr = ''

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
      // Parse "frame=  120 fps= 30 time=00:00:04.00" for progress
    })

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-500)}`))
    })
  })
}

// VFR→CFR normalization command
export async function normalizeVideo(inputPath: string, outputPath: string): Promise<void> {
  await spawnFFmpeg([
    '-i', inputPath,
    '-c:v', 'libx264',
    '-preset', 'fast',       // 'slow' for better quality; 'fast' for quicker turnaround
    '-crf', '18',            // high quality, visually lossless
    '-r', '30',              // force 30fps CFR (covers VFR inputs)
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-y',                    // overwrite without asking
    outputPath
  ])
}

// Metadata extraction via ffprobe JSON output
export function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFPROBE, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath
    ])
    let stdout = ''
    proc.stdout.on('data', (c: Buffer) => { stdout += c })
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error('ffprobe failed'))
      const data = JSON.parse(stdout)
      const video = data.streams.find((s: any) => s.codec_type === 'video')
      const [fpNum, fpDen] = (video.r_frame_rate as string).split('/').map(Number)
      resolve({
        duration: parseFloat(data.format.duration),
        fps: Math.round(fpNum / fpDen),
        width: video.width as number,
        height: video.height as number,
        codec: video.codec_name as string,
      })
    })
  })
}

// Thumbnail at 1 second mark
export async function extractThumbnail(inputPath: string, outputPath: string): Promise<void> {
  await spawnFFmpeg([
    '-ss', '1',
    '-i', inputPath,
    '-vframes', '1',
    '-q:v', '2',
    '-y',
    outputPath
  ])
}
```

### Pattern 6: SSE Progress Push

**What:** After the client POSTs the upload, it connects to `GET /api/jobs/:jobId/events` and receives `text/event-stream` data as normalization progresses.

```typescript
// packages/backend/src/routes/jobs.ts
// @fastify/sse plugin adds reply.sse to the handler
fastify.get('/api/jobs/:jobId/events', { sse: true }, async (req, reply) => {
  const { jobId } = req.params as { jobId: string }

  // Poll job state and push updates
  const interval = setInterval(() => {
    const job = fastify.jobs.get(jobId)
    if (!job) { clearInterval(interval); return }
    reply.sse.send({ event: 'progress', data: JSON.stringify(job) })
    if (job.status === 'ready' || job.status === 'failed') {
      clearInterval(interval)
      reply.sse.send({ event: 'done', data: JSON.stringify(job) })
    }
  }, 500)

  req.raw.on('close', () => clearInterval(interval))
})
```

### Pattern 7: Vite Proxy + LAN Host

**What:** Vite dev server proxies `/api/*` to the Fastify backend, eliminating CORS in dev. `host: true` exposes the dev server to the local network so other devices can access it.

```typescript
// packages/frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // listen on 0.0.0.0 → LAN accessible
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
```

### Pattern 8: CSS Custom Properties for Dark Theme

**What:** All colors are CSS custom properties on `:root` or `html`. Components reference tokens, never hard-coded hex values. This is Phase 1 only — dark mode is the only mode, so no toggle is needed.

**Palette recommendation (DaVinci Resolve reference):**

```css
/* packages/frontend/src/styles/tokens.css */
:root {
  /* Background layers (darkest to lightest) */
  --color-bg-base:       #1a1a1a;   /* page background */
  --color-bg-surface:    #242424;   /* cards, panels */
  --color-bg-elevated:   #2e2e2e;   /* header, tooltips */
  --color-bg-hover:      #383838;   /* hover states */

  /* Borders */
  --color-border:        #3a3a3a;
  --color-border-focus:  #4a4a4a;

  /* Text */
  --color-text-primary:  #e8e8e8;
  --color-text-secondary:#a0a0a0;
  --color-text-disabled: #585858;

  /* Green accents (interactive, status) */
  --color-accent-green:  #4caf72;   /* active tab, buttons, progress bar */
  --color-accent-green-dim: #2d7a4f; /* hover on green elements */
  --color-accent-green-muted: #1e3d2a; /* backgrounds of green-accented items */

  /* Semantic */
  --color-error:         #e05454;
  --color-warning:       #d4a047;
  --color-success:       var(--color-accent-green);

  /* Upload zone */
  --color-dropzone-border:  #4a4a4a;
  --color-dropzone-active:  var(--color-accent-green);
  --color-dropzone-bg:      var(--color-bg-surface);
}
```

### Pattern 9: react-dropzone Upload Zone

**What:** `useDropzone` hook provides `getRootProps`, `getInputProps`, and `isDragActive`. The entire zone is clickable and also accepts drags from the OS file system.

```typescript
// Source: https://react-dropzone.js.org/
// packages/frontend/src/components/UploadZone.tsx
import { useDropzone } from 'react-dropzone'

export function UploadZone({ onFile }: { onFile: (file: File) => void }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => { if (accepted[0]) onFile(accepted[0]) },
    accept: { 'video/*': [] },
    multiple: false,
    noClick: false,        // click opens file picker
  })

  return (
    <div
      {...getRootProps()}
      className={`upload-zone ${isDragActive ? 'upload-zone--active' : ''}`}
    >
      <input {...getInputProps()} />
      <p>{isDragActive ? 'Drop to upload' : 'Drop a video or click to upload'}</p>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Buffering the upload in memory:** Never use `await data.toBuffer()` on large uploads. Always stream with `pipeline(data.file, createWriteStream(dest))`.
- **Using `fluent-ffmpeg`:** It is archived and unmaintained as of May 2025. Will break with recent FFmpeg versions.
- **Using `exec` for FFmpeg:** `exec` buffers all stderr/stdout in memory. Large video processing will exhaust the buffer.
- **Not consuming the multipart stream:** If `data.file` is not consumed (piped somewhere), `@fastify/multipart` will hang. Always `await pipeline(...)` or call `data.file.resume()` to drain.
- **Using `dnd-kit` for file drops:** `dnd-kit` handles UI element reordering, not OS-level file drag-and-drop. Use `react-dropzone`.
- **Using plain `tsc` in the monorepo:** Project references require `tsc --build`. Plain `tsc` ignores references.
- **Not specifying `host: '0.0.0.0'` on Fastify:** Fastify defaults to `127.0.0.1`, making it unreachable from other network devices. Must be explicit.
- **Not setting `fileSize: 0` on @fastify/multipart:** Default limit is 1MB. Must override for the "no file size limit" requirement.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multipart form parsing | Custom body parser | `@fastify/multipart` | Boundary parsing, encoding, streaming is complex; busboy handles all edge cases |
| File drag-and-drop zone | Raw HTML5 drag events | `react-dropzone` | HTML5 drag events have many browser quirks; `react-dropzone` normalizes all of them |
| SSE connection management | Raw `res.write` text/event-stream | `@fastify/sse` | Connection lifecycle, keepalive, Last-Event-ID, error handling all handled |
| UUID generation | Random string | `uuid` v13 | Cryptographically random, no collisions, standard format |
| FFmpeg progress parsing | Nothing — parse stderr | Pattern in code examples above | FFmpeg emits `frame=` progress lines to stderr; straightforward to parse |

**Key insight:** The upload pipeline (multipart → disk → FFmpeg → SSE progress) looks simple but has many edge cases at each boundary. Use battle-tested plugins for the boundaries; write custom code only for the FFmpeg invocation itself.

---

## Common Pitfalls

### Pitfall 1: `@fastify/multipart` Default File Size Limit

**What goes wrong:** Upload of files over ~1MB fails with a 413 error even though the project requires "no file size limit."

**Why it happens:** `@fastify/multipart` defaults to `fileSize: 1048576` (1MB) for security. The project requirement overrides this.

**How to avoid:** Register the plugin with `limits: { fileSize: 0 }` — `0` means unlimited.

**Warning signs:** Upload works for small test files but fails for real video files; error message references `RequestFileTooLargeError`.

### Pitfall 2: FFmpeg Binary Not Found at Runtime

**What goes wrong:** Node.js `spawn('ffmpeg', ...)` throws `ENOENT` — the system cannot find the binary.

**Why it happens:** On Apple Silicon Macs, Homebrew installs to `/opt/homebrew/bin/`, which may not be in the PATH when Node.js is spawned from a process that doesn't load `.zshrc`.

**How to avoid:** Use the absolute path `/opt/homebrew/bin/ffmpeg` in the `spawn` call. Document `brew install ffmpeg` as a system prerequisite. Optionally: detect the path at startup with `execFileSync('which', ['ffmpeg'])` and fail fast with a clear message.

**Warning signs:** App works when started from a terminal (`npm run dev`) but errors when started as a service or from Finder.

### Pitfall 3: Fastify Listening on 127.0.0.1 — Unreachable from Other Devices

**What goes wrong:** App works on the Mac Mini itself but other devices on the local network get "connection refused."

**Why it happens:** Fastify defaults to `host: '127.0.0.1'` (localhost only).

**How to avoid:** Always start Fastify with `host: '0.0.0.0'`:
```typescript
await fastify.listen({ port: 3001, host: '0.0.0.0' })
```

**Warning signs:** Works at `localhost:3001` on the Mac but not at `192.168.x.x:3001` from another device.

### Pitfall 4: TypeScript Project References Not Building Properly

**What goes wrong:** `tsc` reports errors about types not being found across packages, or changes in `shared-types` are not reflected in `backend`/`frontend`.

**Why it happens:** Running plain `tsc` does not follow project references. Or `composite: true` and `declaration: true` are missing from the referenced package.

**How to avoid:** Always build with `tsc --build tsconfig.build.json`. Each referenced package must have `composite: true` and `declaration: true` in its `tsconfig.json`.

**Warning signs:** `tsc` succeeds but import errors appear in IDE; or `tsc` errors: "Option 'project' cannot be mixed with source files on a command line."

### Pitfall 5: Vite Proxy Only Works in Dev Mode

**What goes wrong:** Deploying the production build results in `/api` requests going nowhere — the Vite proxy is not active at runtime.

**Why it happens:** Vite's `server.proxy` is a dev-server feature only. Production builds are static files served by Fastify's `@fastify/static` plugin.

**How to avoid:** In production, serve the Vite build (`packages/frontend/dist`) via `@fastify/static` registered on the Fastify backend. All routes on the same origin naturally reach the backend. No proxy needed.

**Warning signs:** Works with `npm run dev` but not with `npm run build && npm start`.

### Pitfall 6: Not Consuming the Multipart File Stream

**What goes wrong:** Upload route hangs indefinitely; never sends a response.

**Why it happens:** `@fastify/multipart` (backed by busboy) will not resolve the route handler until all parts of the multipart body are consumed. If `data.file` is never piped or drained, the upload stalls.

**How to avoid:** Always `await pipeline(data.file, someWriteStream)`. If for any reason the file should be discarded, call `data.file.resume()` to drain it.

**Warning signs:** Request times out; no error thrown; no response received.

### Pitfall 7: VFR Detection — Always Normalize, Don't Detect

**What goes wrong:** Logic that tries to detect VFR vs CFR and skip normalization for CFR inputs — this produces edge cases where "technically CFR" content still has timestamp irregularities that break downstream tools.

**Why it happens:** Developers try to skip the re-encode to save time, but VFR detection is not binary.

**How to avoid:** Always normalize. The `-r 30 -c:v libx264` re-encode is fast enough locally and guarantees the downstream pipeline (Whisper, Remotion) receives predictable CFR content. The original file is preserved untouched — re-encoding the normalized copy has no quality penalty on the render output.

**Warning signs:** Transcription timestamps drift for some videos; Remotion composition has frame-alignment errors.

---

## Code Examples

Verified patterns from official sources:

### Fastify Server Bootstrap (TypeScript ESM)

```typescript
// Source: https://fastify.dev/docs/latest/Guides/Getting-Started/
// packages/backend/src/index.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import sse from '@fastify/sse'

const fastify = Fastify({ logger: { level: 'info' } })

await fastify.register(cors, { origin: true })

await fastify.register(multipart, {
  limits: {
    fileSize: 0,    // unlimited; project requirement
    files: 1,
    parts: 10,
  }
})

await fastify.register(sse)

// Decorate with job store before registering routes
fastify.decorate('jobs', new Map())

await fastify.register(uploadRoutes, { prefix: '/api' })
await fastify.register(jobRoutes, { prefix: '/api' })

try {
  await fastify.listen({ port: 3001, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
```

### Streaming File Upload to Disk

```typescript
// Source: https://github.com/fastify/fastify-multipart
import { pipeline } from 'node:stream/promises'
import { createWriteStream, mkdirSync } from 'node:fs'
import path from 'node:path'

const data = await request.file()
if (!data) return reply.status(400).send({ error: 'No file' })

const ext = path.extname(data.filename) || '.mp4'
mkdirSync(jobDir, { recursive: true })
await pipeline(data.file, createWriteStream(path.join(jobDir, `original${ext}`)))
```

### react-dropzone Integration

```typescript
// Source: https://react-dropzone.js.org/
import { useDropzone } from 'react-dropzone'

const { getRootProps, getInputProps, isDragActive } = useDropzone({
  onDrop: (acceptedFiles) => handleFile(acceptedFiles[0]),
  accept: { 'video/*': [] },
  multiple: false,
})

return (
  <div {...getRootProps()} className={isDragActive ? 'zone zone--active' : 'zone'}>
    <input {...getInputProps()} />
    <span>{isDragActive ? 'Drop to upload' : 'Drop a video or click to upload'}</span>
  </div>
)
```

### Shared Types Definition

```typescript
// packages/shared-types/src/index.ts
export type JobStatus = 'uploading' | 'normalizing' | 'ready' | 'failed'

export interface VideoMetadata {
  duration: number     // seconds
  fps: number
  width: number
  height: number
  codec: string
}

export interface Job {
  id: string
  status: JobStatus
  progress: number         // 0–100
  originalFilename?: string
  metadata?: VideoMetadata
  thumbnailPath?: string
  error?: string
  createdAt: number        // Date.now()
}
```

### Port Recommendation (Claude's Discretion)

- Backend (Fastify): **port 3001**
- Frontend dev server (Vite): **port 5173** (Vite default)

These are the most common defaults and avoid conflicts with common system services.

### Data Folder Layout Recommendation (Claude's Discretion)

```
data/
└── {uuid-job-id}/
    ├── original.{ext}        # original upload, preserved untouched
    ├── normalized.mp4        # VFR→CFR H.264 + AAC, for pipeline use
    └── thumbnail.jpg         # frame at t=1s from normalized video
```

No subdirectories within a job folder — all artifacts flat for simplicity.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fluent-ffmpeg` npm | `child_process.spawn` directly | May 2025 (archived) | Must build own wrapper; actually simpler for single-purpose use |
| `fastify-multipart` (old) | `@fastify/multipart` | Fastify v4 era | Package renamed under official `@fastify/` scope |
| Fastify `logger` option for custom logger | `loggerInstance` option | Fastify v5 | Breaking change — affects initial setup |
| CRA (Create React App) | Vite | 2022-2024 | CRA deprecated; Vite is the standard scaffold |
| `react-dnd` for file drops | `react-dropzone` | Ongoing | `react-dnd` not designed for OS file drops |
| `.eslintrc.js` config | `eslint.config.js` (flat config) | ESLint v9 | New format required for ESLint 9+ |

**Deprecated/outdated:**
- `fluent-ffmpeg`: Archived May 2025 — do not use
- `fastify-multipart` (without `@fastify/` scope): Deprecated, use `@fastify/multipart`
- `ffmpeg-kit`: Archived June 2025 — do not use

---

## Open Questions

1. **FFmpeg path detection strategy**
   - What we know: On M4 Mac Mini with Apple Silicon, Homebrew installs to `/opt/homebrew/bin/ffmpeg`
   - What's unclear: Whether the development environment already has ffmpeg installed; whether the path is different if installed via other means
   - Recommendation: At server startup, run `which ffmpeg` (or check `/opt/homebrew/bin/ffmpeg`) and log a clear error if not found. Document `brew install ffmpeg` in the project README as a prerequisite.

2. **Upload progress granularity during large file transfer**
   - What we know: `@fastify/multipart` streams the file; the SSE connection reports normalization progress via FFmpeg stderr
   - What's unclear: Whether to also report byte-level upload progress (frontend can't easily get this from the stream without custom middleware)
   - Recommendation: For Phase 1, use three status messages only: "Uploading..." (while multipart stream is in progress), "Normalizing video..." (once file is on disk and FFmpeg starts), "Ready" (normalization complete). This matches the UX spec exactly.

3. **Thumbnail extraction: from `original` or `normalized`?**
   - What we know: Thumbnail needs to be shown after upload; `original` may be VFR which thumbnail extraction handles fine; `normalized` is guaranteed CFR
   - What's unclear: Should thumbnail be extracted as part of the normalization pipeline or as a separate FFmpeg call after normalization completes?
   - Recommendation: Extract thumbnail from `normalized.mp4` after normalization completes — ensures consistent frame timing and avoids a second pass on a potentially large original file. Use the `-ss 1` seek-before-input flag for speed.

---

## Sources

### Primary (HIGH confidence)

- npm registry (live queries Feb 2026): fastify@5.7.4, @fastify/multipart@9.4.0, @fastify/cors@11.2.0, vite@7.3.1, react@19.2.4, typescript@5.9.3, react-dropzone@15.0.0, uuid@13.0.0
- https://fastify.dev/docs/latest/Guides/Getting-Started/ — server creation, plugin registration patterns
- https://fastify.dev/docs/v5.0.x/Guides/Migration-Guide-V5/ — v5 breaking changes
- https://github.com/fastify/fastify-multipart — streaming upload API, limits configuration
- https://vite.dev/config/server-options — `host: true`, `server.proxy`, default port 5173
- https://react-dropzone.js.org/ — `useDropzone` hook API

### Secondary (MEDIUM confidence)

- https://github.com/fluent-ffmpeg/node-fluent-ffmpeg (archived notice May 2025) — confirmed archived status
- https://formulae.brew.sh/formula/ffmpeg — Homebrew ffmpeg, ARM64 support confirmed
- https://monorepo.tools/typescript — npm workspaces + TypeScript project references pattern
- https://nx.dev/blog/typescript-project-references — `composite: true`, `declaration: true` requirements

### Tertiary (LOW confidence)

- WebSearch results on FFmpeg progress parsing from stderr (pattern verified against multiple sources but no authoritative single spec)
- `@fastify/sse` API shape based on WebSearch; official package not deeply verified via Context7 — planner should verify exact import and registration syntax against npm package README

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against live npm registry
- Architecture: HIGH — Fastify and Vite patterns verified against official docs
- FFmpeg approach: HIGH — fluent-ffmpeg archival confirmed from GitHub; child_process pattern verified
- Pitfalls: HIGH — multipart limits, host binding, and stream consumption verified against official plugin documentation
- SSE details: MEDIUM — @fastify/sse API shape from WebSearch; verify README before implementation

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable ecosystem; main risk is @fastify/sse version specifics — verify before first use)
