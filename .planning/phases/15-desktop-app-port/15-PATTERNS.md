# Phase 15: Desktop App Port - Pattern Map

**Mapped:** 2026-07-08
**Files analyzed:** 15
**Analogs found:** 11 / 15 (rest are genuinely new — no in-repo analog, Electron patterns cited from RESEARCH.md instead)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `packages/desktop/src/main.ts` | provider (app lifecycle) | event-driven | none in-repo | no analog — use RESEARCH.md Pattern 3/4 (Electron docs) |
| `packages/desktop/src/backend-process.ts` | service (child-process manager) | event-driven | `packages/backend/src/services/transcription.ts` | role-match (spawn + stdout/stderr + exit handling shape) |
| `packages/desktop/src/first-run-setup.ts` | service (provisioning) | streaming (progress) | `packages/backend/src/services/transcription.ts` (JSON-line progress over stdout) + `justfile` `setup-python-cuda` (the exact commands to run) | role-match |
| `packages/desktop/src/config.ts` | config | transform | `packages/backend/src/index.ts` (`DATA_ROOT` resolution) | role-match |
| `packages/desktop/src/splash/*` | component | request-response | none in-repo (plain HTML/CSS window, not a React component) | no analog |
| `packages/desktop/electron-builder.yml` | config | — | none in-repo | no analog — use RESEARCH.md Standard Stack / Don't Hand-Roll tables |
| `packages/backend/src/index.ts` (modify: port/host/DATA_ROOT config, SIGTERM handler) | config + service entry | request-response | itself (existing file, edit in place) | exact (same file) |
| `packages/backend/src/services/transcription.ts` (modify: Windows venv path) | service | event-driven, streaming | itself | exact |
| `packages/backend/src/services/diarization.ts` (modify: Windows venv path) | service | event-driven, streaming | `packages/backend/src/services/transcription.ts` (identical spawn/readline/JSON-line pattern) | exact-shape |
| `packages/backend/src/services/ffmpeg.ts` (modify: bundled binary path) | service | streaming | itself | exact |
| `packages/backend/src/services/render.ts` (modify: packaged-mode bundle resolution) | service | event-driven | itself | exact |
| `packages/backend/src/services/waveform.ts`, `thumbnail.ts` (modify: ffmpeg path) | service | file-I/O | `packages/backend/src/services/ffmpeg.ts` (same spawn pattern) | exact-shape |
| `packages/backend/src/services/projectStore.ts`, `animationPresets.ts`, `lanePresets.ts` (modify: DB path under userData) | service (fastify-plugin) | CRUD | `packages/backend/src/services/projectStore.ts` (all three already share this exact shape) | exact |
| `packages/backend/src/routes/transcribe.ts`, `diarize.ts` (modify: HF token from config store, not env) | route | request-response | itself (existing files, edit in place) | exact |
| `packages/frontend/src/components/SettingsDialog.tsx` (new) | component | request-response | `packages/frontend/src/components/TranscriptionOptionsDialog.tsx` | role-match (modal dialog with localStorage-backed form state) |

## Pattern Assignments

### `packages/desktop/src/backend-process.ts` (service, event-driven)

**Analog:** `packages/backend/src/services/transcription.ts` (full file read, 79 lines)

**Spawn + stdio pattern** (lines 1-11, 37-39):
```typescript
import { spawn, type ChildProcess } from 'node:child_process'
import readline from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const proc = spawn(VENV_PYTHON, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
})
```
Apply directly to spawning the backend child: `spawn(process.execPath, [backendEntry], { env: {...}, stdio: ['ignore', 'pipe', 'pipe'] })` per RESEARCH.md Pattern 1 (`ELECTRON_RUN_AS_NODE=1`).

**Return-handle-for-cleanup pattern** (lines 25-32, 77):
```typescript
export function runTranscription(...): { promise: Promise<void>; process: ChildProcess } {
  ...
  return { promise, process: proc }
}
```
This is the exact shape `backend-process.ts` should mirror: return `{ promise, process }` so `main.ts` can hold the `ChildProcess` handle for `tree-kill` on quit (D-03). The backend already proves out this handle-return convention in two places (`transcription.ts`, `diarization.ts`).

**Progress line parsing** (lines 41-54):
```typescript
const rl = readline.createInterface({ input: proc.stdout!, terminal: false })
rl.on('line', (line) => {
  try {
    const msg = JSON.parse(line) as { type: string; percent?: number }
    if (msg.type === 'progress' && msg.percent !== undefined && onProgress) {
      onProgress(msg.percent)
    }
  } catch {
    // Ignore non-JSON lines
  }
})
```
`first-run-setup.ts` should use this same JSON-line-over-stdout convention if the bundled `uv` invocation is wrapped by a small script that emits progress JSON; otherwise fall back to regex text-scraping per RESEARCH.md Assumption A2 (uv has no native progress API).

**Exit/error handling** (lines 61-74):
```typescript
proc.on('close', (code, signal) => {
  if (code === 0) { resolve() }
  else if (signal) { reject(new Error(`... killed by ${signal} ...`)) }
  else { reject(new Error(`... exited ${code}: ${stderr.slice(-500)}`)) }
})
proc.on('error', (err) => {
  reject(new Error(`Failed to spawn ...: ${err.message}. Ensure venv exists (run: just setup-python)`))
})
```
Reuse this three-way close/error handling shape for both `backend-process.ts` (backend health) and `first-run-setup.ts` (uv provisioning failures) — always truncate stderr to last ~500 chars and give an actionable remediation hint in the error message, matching this codebase's existing convention.

---

### `packages/desktop/src/config.ts` (config, transform)

**Analog:** `packages/backend/src/index.ts` (lines 23-31)

**Path resolution pattern:**
```typescript
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const DATA_ROOT = path.resolve(__dirname, '../../../data')

mkdirSync(DATA_ROOT, { recursive: true })
```
`config.ts` replaces the hardcoded `path.resolve(__dirname, '../../../data')` with `app.getPath('userData')`-derived paths (D-11), but keeps the same "resolve once at module load, `mkdirSync(..., { recursive: true })` eagerly" convention. Pass the resolved value into the backend child's `env.DATA_ROOT` (see backend-process.ts spawn env, RESEARCH.md Pattern 1) rather than the backend resolving it itself — `index.ts` must switch from `export const DATA_ROOT = path.resolve(...)` to `export const DATA_ROOT = process.env.DATA_ROOT ?? path.resolve(__dirname, '../../../data')` so dev mode (`just dev`) keeps working unmodified while packaged mode is Electron-injected.

---

### `packages/backend/src/index.ts` (modify in place)

**Current state (full file, 74 lines) — exact lines requiring changes:**
- Line 28: `export const DATA_ROOT = path.resolve(__dirname, '../../../data')` → must become env-overridable per D-11.
- Line 69: `await fastify.listen({ port: 3001, host: '0.0.0.0' })` → must become `host: process.env.HOST ?? '127.0.0.1'` per D-12 (comment on line 67 `// must bind to 0.0.0.0 for LAN access (PLAT-02)` is now stale — PLAT-02 is explicitly superseded per RESEARCH.md `<phase_requirements>`).
- Line 58-60: existing `/api/health` handler is already exactly what D-03's health-check polling (RESEARCH.md "Health-check poll loop for splash window") needs — **no change required here**, just confirm it stays fast/dependency-free.
- Lines 62-65: `initBundle()` call — needs the packaged-vs-dev branch per RESEARCH.md Pattern 2 (skip `bundle()` when `app.isPackaged`/`IS_PACKAGED` env var is set).
- **New addition needed:** a `SIGTERM`/`process.on('SIGTERM', ...)` handler that tree-kills tracked child handles (Python transcription/diarization processes, render worker) before `fastify.close()` — this is new code, not a modification of an existing handler; no existing SIGTERM handling exists in this file today (confirmed by full read).

---

### `packages/backend/src/services/transcription.ts` / `diarization.ts` (modify in place)

**Analog:** `transcription.ts` itself (lines 9-11)

```typescript
const REPO_ROOT = path.resolve(__dirname, '../../../../')
const VENV_PYTHON = path.join(REPO_ROOT, '.venv/bin/python3')
const SCRIPT = path.join(REPO_ROOT, 'scripts/transcribe.py')
```
Change to Windows path per D-07 (`'.venv/Scripts/python.exe'`), and make `VENV_PYTHON` env-overridable (`process.env.VENV_PYTHON ?? ...`) so Electron main can inject the userData-relative venv path instead of a repo-relative one, matching the `DATA_ROOT` override pattern in `index.ts`. `diarization.ts` was not read directly but RESEARCH.md's `<canonical_refs>` confirms it uses "the same venv-Python spawn pattern" — apply the identical two-line change there.

---

### `packages/backend/src/services/ffmpeg.ts` (modify in place)

**Current state (lines 4-14):**
```typescript
const FFMPEG = 'ffmpeg'
const FFPROBE = 'ffprobe'

try {
  execFileSync(FFMPEG, ['-version'], { stdio: 'ignore' })
} catch {
  const msg = 'FFmpeg not found. Install with: choco install ffmpeg (Windows) or brew install ffmpeg (Mac)'
  ...
}
```
Change `FFMPEG`/`FFPROBE` from PATH-lookup string literals to `process.env.FFMPEG_PATH ?? 'ffmpeg'` / `process.env.FFPROBE_PATH ?? 'ffprobe'`, resolved by Electron main to `<resourcesPath>/ffmpeg/ffmpeg.exe` in packaged mode (D-13, RESEARCH.md Anti-Patterns). The module-load-time existence check (lines 8-14) should stay — it's a good fail-fast pattern, just update the error message to reference bundled-binary troubleshooting instead of `choco install`/`brew install` when running packaged. All `spawn(FFMPEG, ...)`/`spawn(FFPROBE, ...)` call sites (this file, plus `waveform.ts`/`thumbnail.ts` per canonical_refs) inherit the fix automatically once the constants are parameterized here.

---

### `packages/backend/src/services/render.ts` (modify in place)

**Current state (lines 13-20):**
```typescript
export async function initBundle(): Promise<void> {
  const entryPoint = path.resolve(__dirname, '../../../remotion-composition/src/remotion-entry.ts')
  bundleLocation = await bundle({ entryPoint })
  console.log(`[render] Remotion bundle ready at ${bundleLocation}`)
}
```
Per RESEARCH.md Pattern 2, branch this function: if `process.env.IS_PACKAGED === '1'`, set `bundleLocation` to a prebuilt path (shipped via `extraResources`, built once by `electron-builder`'s build hook) instead of calling `bundle()`. The `getBundleLocation()` accessor (lines 22-25) and `dispatchRender()` (lines 27-88, worker spawn with `bundleLocation` in `workerData`) require **no changes** — they already treat `bundleLocation` as an opaque resolved path, which is exactly the abstraction the packaged-mode branch needs.

---

### `packages/backend/src/services/projectStore.ts` / `animationPresets.ts` / `lanePresets.ts` (modify in place)

**Analog:** `projectStore.ts` itself (full file, 47 lines) — the other two presets stores share this identical fastify-plugin + better-sqlite3 shape per RESEARCH.md canonical_refs.

**DB path + WAL + close-on-shutdown pattern** (lines 1-21, 40-43):
```typescript
import fp from 'fastify-plugin'
import Database from 'better-sqlite3'
import { DATA_ROOT } from '../index.ts'

async function projectStorePlugin(fastify: FastifyInstance): Promise<void> {
  const dbPath = path.join(DATA_ROOT, 'projects.db')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`CREATE TABLE IF NOT EXISTS projects (...)`)
  fastify.decorate('projectsDb', db)
  fastify.addHook('onClose', (_instance, done) => { db.close(); done() })
}
```
**No code change needed in these three files at all** — they already import `DATA_ROOT` from `index.ts` rather than hardcoding a path. Once `index.ts`'s `DATA_ROOT` export is made env-overridable (see above), all three DB files automatically relocate to `userData` with zero edits. This is the single biggest "free win" the RESEARCH.md summary calls out.

---

### `packages/backend/src/routes/transcribe.ts` / `diarize.ts` (modify in place)

**Current state (`diarize.ts` line 62, `transcribe.ts` line 69):**
```typescript
const hfToken = process.env.HUGGINGFACE_TOKEN
```
Per D-09, replace both call sites with a read from the new app-config store (Electron `safeStorage`-encrypted per RESEARCH.md V6 Security section, or a config file read exposed via `DATA_ROOT`/settings.json). Recommend introducing a small `packages/backend/src/services/appConfig.ts` (new file, no existing analog — closest shape is `projectStore.ts`'s fastify-plugin pattern but backed by a JSON file instead of SQLite, or reuse `electron-store`'s equivalent read via IPC/env at spawn time) that both routes import instead of touching `process.env` directly.

---

### `packages/frontend/src/components/SettingsDialog.tsx` (new)

**Analog:** `packages/frontend/src/components/TranscriptionOptionsDialog.tsx` (lines 1-60 read)

**Modal + localStorage-backed form state pattern:**
```typescript
import { useEffect, useRef, useState } from 'react'
import { loadX, saveX } from '../lib/transcriptionPrefs.ts'
import './TranscriptionOptionsDialog.css'

interface XDialogProps {
  title: string
  confirmLabel: string
  onConfirm: (options: X) => void
  onCancel: () => void
}

export function XDialog({ title, confirmLabel, onConfirm, onCancel }: XDialogProps) {
  const [value, setValue] = useState(() => loadX())
  const inputRef = useRef<HTMLInputElement>(null)
  // Enter confirms, Escape cancels (per file's documented convention)
```
`SettingsDialog.tsx` (HF token input + media-root path input, D-09/D-11) should follow this exact shape: props-driven `onConfirm`/`onCancel`, a paired `lib/*Prefs.ts` load/save module (new `lib/settingsPrefs.ts`, analogous to `lib/transcriptionPrefs.ts`), a co-located `.css` file, and the documented Enter/Escape keyboard convention. Reachable from the header per RESEARCH.md's "new page or dialog reachable from the header" integration point.

---

## Shared Patterns

### Child-process spawn/cleanup convention
**Source:** `packages/backend/src/services/transcription.ts` (spawn + stdio + close/error handling, lines 1-78), reused shape in `ffmpeg.ts` (lines 25-84, 90-154)
**Apply to:** `backend-process.ts`, `first-run-setup.ts`, and every modified spawn site (`transcription.ts`, `diarization.ts`, `ffmpeg.ts`, `render.ts`'s worker)
```typescript
const proc = spawn(BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] })
proc.stdout.on('data', (chunk: Buffer) => { /* parse progress */ })
proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
proc.on('close', (code) => { code === 0 ? resolve() : reject(new Error(`... exited ${code}: ${stderr.slice(-500)}`)) })
proc.on('error', (err) => reject(new Error(`Failed to spawn ...: ${err.message}`)))
```
Every new/modified process-spawning file in this phase should match this shape: JSON-line or `-progress pipe:1`-style stdout parsing, stderr buffering truncated to last 500 chars on error, explicit `error` event handling with an actionable remediation string.

### Env-driven config override (new cross-cutting convention this phase introduces)
**Source:** `packages/backend/src/index.ts` (`DATA_ROOT` export, lines 23-31) — the *only* existing example of a config value being resolved once at module scope and exported for reuse.
**Apply to:** `index.ts` (`DATA_ROOT`, `PORT`, `HOST`), `transcription.ts`/`diarization.ts` (`VENV_PYTHON`), `ffmpeg.ts` (`FFMPEG`/`FFPROBE` paths), `render.ts` (`IS_PACKAGED` bundle branch), routes (`HUGGINGFACE_TOKEN` → config-store read)
```typescript
export const DATA_ROOT = process.env.DATA_ROOT ?? path.resolve(__dirname, '../../../data')
```
This is the mechanical pattern the planner should apply everywhere a hardcoded const currently exists: fall back to the current dev-mode value so `just dev`/`just backend` keep working unmodified, and let Electron main override via `env` at spawn time (per RESEARCH.md Pattern 1).

### Fastify-plugin + better-sqlite3 store shape
**Source:** `packages/backend/src/services/projectStore.ts` (full file)
**Apply to:** No changes needed (see File Classification) — documented here because the planner must confirm `animationPresets.ts`/`lanePresets.ts` genuinely share this shape (RESEARCH.md canonical_refs states they do) rather than re-reading both files; this pattern's "free win" (DATA_ROOT re-export propagates automatically) is the reason those two files need zero direct edits.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/desktop/src/main.ts` | provider | event-driven | No Electron code exists anywhere in the repo yet; use RESEARCH.md Patterns 3 (tree-kill shutdown) and 4 (single-instance lock), sourced directly from Electron's own official docs |
| `packages/desktop/src/splash/*` (HTML/CSS window) | component | request-response | Not a React component — plain static HTML shown by a `BrowserWindow`; no analog in a React-only frontend codebase. Keep minimal per D-05, styled ad hoc |
| `packages/desktop/electron-builder.yml` | config | — | No packaging config exists anywhere in repo (web app only, no prior desktop build); follow RESEARCH.md Standard Stack + Don't Hand-Roll tables and the official `remotion-dev/template-electron` reference cited there |
| `packages/backend/src/services/appConfig.ts` (proposed, for D-09 token storage) | service | CRUD | No JSON-file-backed config store exists in the backend today (only SQLite via better-sqlite3 and env vars) — this is new territory; closest structural analog is `projectStore.ts`'s fastify-plugin decoration pattern, but the storage backend (JSON file + `safeStorage` encryption vs SQLite) has no precedent in this codebase |

## Metadata

**Analog search scope:** `packages/backend/src/{index.ts,services/*,routes/*}`, `packages/frontend/src/components/*Dialog*`, `justfile`, `packages/frontend/vite.config.ts`, root `package.json`/workspace layout
**Files scanned:** 8 read directly (index.ts, transcription.ts, ffmpeg.ts, render.ts, projectStore.ts, TranscriptionOptionsDialog.tsx, justfile, vite.config.ts) + 2 greps (HUGGINGFACE_TOKEN usage, dialog/settings component search)
**Pattern extraction date:** 2026-07-08
