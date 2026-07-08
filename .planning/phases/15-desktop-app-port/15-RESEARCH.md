# Phase 15: Desktop App Port - Research

**Researched:** 2026-07-08
**Domain:** Electron desktop packaging of an existing Fastify + React + Python-ML + Remotion web app, native Windows target
**Confidence:** MEDIUM (packaging/process-lifecycle patterns HIGH; native-Windows CUDA/cuDNN behavior MEDIUM — genuinely unresolvable without hands-on verification on the target RTX 4080 machine)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Shell Technology & Architecture**
- D-01: Electron is the desktop shell (chosen over Tauri and a lightweight tray-launcher). The all-Node stack (Fastify, Remotion renderer, better-sqlite3) makes Electron the natural host.
- D-02: Keep the HTTP frontend/backend split — NO rewrite to Electron IPC. The backend remains a Fastify HTTP server; all existing fetch/SSE/video-streaming code stays unchanged.
- D-03: Backend runs as a managed child process of the Electron main process with strict lifecycle guarantees:
  - Started with the app; Electron waits for `/api/health` before showing the main window.
  - Graceful shutdown on quit: backend receives SIGTERM-equivalent, kills its own tracked children (Python transcription, FFmpeg, Remotion render workers) before exiting.
  - Tree-kill fallback if graceful shutdown times out (~5s) — no straggler processes, ever (Windows: `taskkill /T` semantics).
  - Orphan watchdog: backend monitors parent PID and self-exits if the Electron process vanishes.
  - Single-instance lock: second launch focuses the existing window, never spawns a second backend on the port.
- D-04: Frontend is Vite-built to static files and served by the backend via `@fastify/static`; the Electron window loads `http://localhost:3001`. Relative `/api` fetches work untouched.
- D-05: Startup UX: a small splash/loading window appears instantly and shows startup progress until the backend health check passes (Remotion bundling takes several seconds), then the main window opens.

**Target Platform & Python/ML Strategy**
- D-06: Windows only for this phase (user's daily-driver Windows/RTX 4080 machine). No macOS build. The M4 Mac Mini target in PROJECT.md is stale.
- D-07: Fully native Windows stack — the WSL dependency is removed entirely:
  - Python venv on Windows (uv-managed) with Windows CUDA torch wheels (cu128) + WhisperX + pyannote.
  - Backend spawns `.venv/Scripts/python.exe` (Windows path) instead of `.venv/bin/python3`.
  - Backend Node process runs natively on Windows inside Electron.
- D-08: Python environment provisioning: in-app first-run setup. The app detects a missing venv on launch and runs the uv-based setup itself (~5-6GB download), showing download/install progress in the UI. Installer stays small.
- D-09: HuggingFace token + models: in-app settings screen where the token is pasted once and stored in app config (no env vars). WhisperX large-v3 and pyannote models auto-download on first transcription with progress shown.

**Packaging, Data & Startup**
- D-10: Distribution: Windows installer built with electron-builder (NSIS) — Start Menu entry, per-user install without admin rights, proper uninstaller.
- D-11: Data layout: settings + SQLite DBs live in the user-data dir (`%APPDATA%\Eigen` or Electron `app.getPath('userData')`); the heavy media root (videos, renders, thumbnails) defaults to a sensible user folder but is user-configurable in settings so it can point at a big drive. Repo-root `data/` convention is replaced.
- D-12: Network binding: localhost only (`127.0.0.1`). The LAN multi-device workflow is intentionally dropped for the desktop app.
- D-13: FFmpeg/FFprobe: static Windows binaries bundled inside the install — version-pinned, self-contained, replacing the current on-PATH requirement.

**Remaining Webapp Workflow Fixes**
- D-14: Fix-budget approach: the plan reserves a small "workflow fixes" task without enumerating items now. The user names the specific fixes when execution reaches that task (or during verification of the desktop build). Do not invent a fix list.

### Claude's Discretion
- Exact Electron process API for the backend child (utilityProcess vs child_process) and health-check/retry details
- electron-builder configuration details (app id, icon, install dir defaults)
- Exact %APPDATA% directory naming and settings/config file format
- How the first-run setup invokes uv (bundled uv binary vs downloaded) and its progress-reporting mechanism
- Default location for the configurable media root
- Splash window visual design
- How bundled ffmpeg paths are injected into the existing ffmpeg service (env var vs config)
- Whether the Vite dev workflow (hot reload against the backend) is preserved alongside the packaged app

### Deferred Ideas (OUT OF SCOPE)
- macOS / M4 Mac Mini build — dropped from this phase (Windows only per D-06); revisit if the Mac Mini deployment becomes real again
- LAN multi-device access — intentionally dropped (D-12); could return later as a settings toggle
- Auto-update mechanism — not discussed; personal tool, manual reinstall acceptable for now
</user_constraints>

<phase_requirements>
## Phase Requirements

No formal REQUIREMENTS.md IDs are mapped to this phase (TBD/none mapped per orchestrator scope). REQUIREMENTS.md v1 requirements (PLAT-02: "Backend runs on M4 Mac Mini and is accessible from other devices on the local network") are explicitly **superseded** by this phase's locked decisions D-06 (Windows only) and D-12 (localhost only) — the planner should treat PLAT-02 as stale/out-of-date for this phase, not as a constraint to satisfy. No other v1/v2 requirement references desktop packaging.

| ID | Description | Research Support |
|----|-------------|------------------|
| — | (none mapped) | This phase is infrastructure/packaging work; see `## Architecture Patterns` and `## Common Pitfalls` for what the plan must cover instead of requirement-driven tasks. |
</phase_requirements>

## Summary

This phase wraps an already-working three-tier app (Vite/React frontend, Fastify/Node backend, Python WhisperX+pyannote ML subprocess, Remotion renderer) in an Electron shell and ships it as a Windows NSIS installer. The good news, confirmed by reading the actual codebase: the backend already exposes `/api/health`, already returns `{promise, process}` handles from `transcription.ts`/`diarization.ts` for cleanup, already centralizes all SQLite paths through one `DATA_ROOT` export in `index.ts`, and already uses `@fastify/static`. This means the Electron-specific work is almost entirely *additive* (a new `packages/desktop` workspace member) rather than *invasive* — very little existing backend code needs restructuring beyond parameterizing `DATA_ROOT`, port binding, ffmpeg path, and venv path instead of hardcoding them.

The three areas of genuine, unresolved risk are: (1) native-Windows CUDA/cuDNN DLL resolution for `ctranslate2` (WhisperX's inference engine) — well-documented community pitfall, mitigable but must be verified hands-on; (2) correctly excluding the backend, its `node_modules` (especially `better-sqlite3` and the platform-specific `@remotion/compositor-win32-x64-msvc` package), and the Remotion bundle from Electron's `asar` archive, since none of these tolerate running from inside a compressed archive; (3) getting Remotion's `bundle()`/`renderMedia()` pipeline to use a **prebuilt** bundle in production instead of re-bundling via webpack on every app launch, which is both slow and asar-incompatible. All three are solvable with patterns lifted directly from Remotion's own official `template-electron` reference app (fetched and inspected below) and from electron-builder's documented `asarUnpack`/`extraResources`/`npmRebuild` options.

**Primary recommendation:** Build a new `packages/desktop` workspace with an Electron main process that (a) spawns the *existing* backend TypeScript source directly via `process.execPath` + `ELECTRON_RUN_AS_NODE=1` (Electron 43 bundles Node 24.17, which runs `--experimental-strip-types` unflagged — no backend build step needed), (b) ships the backend + its `node_modules` as `extraResources` (real files, outside `asar`, so `better-sqlite3`'s native binary and ffmpeg/uv binaries all work unmodified), (c) pre-bundles the Remotion composition at `electron-builder` build time and switches `render.ts`'s `initBundle()` to skip `bundle()` and reuse the prebuilt path when `app.isPackaged`, and (d) uses `tree-kill` + `taskkill /T` semantics plus `app.requestSingleInstanceLock()` for the process-lifecycle guarantees in D-03.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Window chrome, splash screen, app lifecycle | Electron Main Process | — | Only the main process can create `BrowserWindow`s and hook `app` lifecycle events (D-05) |
| Backend process spawn/health-check/tree-kill | Electron Main Process | Backend (self-monitors orphan watchdog) | D-03 requires the main process to own start/stop of the backend child, but the backend also self-polices via parent-PID watch |
| HTTP API, SSE progress, job orchestration | Backend (Fastify, Node) | — | Unchanged from web app — D-02 explicitly forbids moving this to Electron IPC |
| Frontend UI (React/Vite build) | Browser tier (Electron `BrowserWindow` loading `localhost:3001`) | — | D-04 — served as static files by the backend, loaded like any browser page; no Electron renderer-specific code needed |
| Transcription / diarization (WhisperX, pyannote) | Backend-spawned Python subprocess | — | Unchanged pattern (`child_process.spawn` of `.venv/Scripts/python.exe`), only the venv path changes (D-07) |
| Video rendering (Remotion) | Backend-spawned worker_thread → headless Chrome | — | Unchanged `worker_threads` pattern; only bundle-location resolution changes for packaged mode |
| FFmpeg normalize/waveform/thumbnail/mux | Backend (`child_process.spawn`) | — | Path resolution changes from PATH-lookup to bundled binary path (D-13); spawn pattern unchanged |
| Settings (HF token, media root) | Backend (reads/writes config file) | Electron Main (provides `app.getPath('userData')` to backend at spawn time) | Config is passed from Electron main → backend via env var/CLI arg at spawn (D-09, D-11) |
| SQLite persistence (projects, presets, jobs) | Backend (`better-sqlite3`) | — | Unchanged code, only `DATA_ROOT` value changes to point at `userData` (D-11) |
| First-run Python env provisioning (uv) | Electron Main Process | Backend (could alternatively own this) | Must run *before* the backend can start (backend depends on the venv existing), so main process orchestrates it and shows progress in the splash window (D-08) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `electron` | 43.1.0 (latest, `[VERIFIED: npm registry]`) | Desktop shell runtime | D-01 locked; embeds Node.js v24.17.0 and Chromium `[CITED: electronjs.org/blog/electron-43-0]` |
| `electron-builder` | 26.15.3 (latest, `[VERIFIED: npm registry]`) | Packages the app into an NSIS Windows installer | D-10 locked; industry standard for Electron NSIS/asar packaging, actively maintained (electron-userland org) |
| `@electron/rebuild` | 4.2.0 (latest, `[VERIFIED: npm registry]`) | Rebuilds native modules (`better-sqlite3`) against Electron's Node ABI | Required whenever a native N-API module is used inside Electron `[CITED: github.com/electron/rebuild]` |
| `tree-kill` | 1.2.2 (latest, `[VERIFIED: npm registry]`) | Kills a process and all its descendants (Windows: `taskkill /pid <pid> /T /F`) | D-03's "no straggler processes" guarantee is impossible with plain `child.kill()`, which only signals the direct child, not grandchildren (ffmpeg spawned by Python/render worker) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `electron-store` | 11.0.2 (latest, `[VERIFIED: npm registry]`) | JSON settings file backed by `userData`, with schema/defaults/atomic writes | For app-level config (media root path, window bounds) if the Electron main process needs its own settings separate from the backend's SQLite-backed config; avoids hand-rolling a settings file reader/writer with atomic-write safety |
| `electron-log` | 5.4.4 (latest, `[VERIFIED: npm registry]`) | File-based logging for main process + child process stdout capture | Startup failures (backend fails health check, venv missing, port in use) need to be diagnosable without a dev console — write to a log file under `userData/logs` |
| `wait-on` | 6.8.9 (latest, `[VERIFIED: npm registry]`) | Polls a URL/port until available | Optional — only useful for the *dev* workflow (Vite hot-reload + backend concurrently); production health-check should be a small hand-rolled retry loop against `/api/health` since it needs UI progress callbacks that `wait-on` doesn't provide |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `electron-builder` (D-10 locked) | Electron Forge + `@electron-forge/plugin-vite` | Forge is what Remotion's own official template uses (see Code Examples below) and has slightly smoother Vite integration, but D-10 already locked electron-builder + NSIS; the packaging *concepts* (asarUnpack, extraResources equivalent, prebuilt Remotion bundle) transfer directly, only the config file syntax differs |
| `process.execPath` + `ELECTRON_RUN_AS_NODE=1` to run backend TS directly | Add an `esbuild`/`tsc` build step to compile backend to plain `.js` before packaging | A build step is more conventional and removes reliance on Electron's bundled Node version supporting type-stripping, but the codebase already confirmed compatible (no enums/namespaces) and Electron 43's Node 24.17 fully supports it — adding a build step is unnecessary complexity for this phase. Revisit only if a future Electron downgrade or non-erasable TS syntax is introduced. |
| `child_process.spawn` for the backend child | Electron `utilityProcess` API | `utilityProcess` is Electron's modern recommended API for Node-enabled children with renderer IPC, but it's designed for MessagePort-based IPC to a `BrowserWindow`, not for a plain standalone HTTP server. Since D-02 keeps all communication over HTTP (not Electron IPC), plain `child_process.spawn` giving a standard `ChildProcess` (pid, `.kill()`, stdout/stderr streams) is simpler and is what `tree-kill` expects. |

**Installation:**
```bash
npm install --workspace packages/desktop electron-builder electron-store electron-log tree-kill @electron/rebuild
npm install --workspace packages/desktop --save-dev electron
```

**Version verification:** All versions above were confirmed via `npm view <package> version` against the live npm registry on 2026-07-08 (see Package Legitimacy Audit for registry signal details — the "too-new" SUS flags on `electron`/`electron-builder`/`@electron/rebuild` are a false-positive of a recency heuristic, not a legitimacy concern; see audit table).

## Package Legitimacy Audit

| Package | Registry | Age (first publish, approx.) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-------------------------------|---------------|--------------|---------|-------------|
| `electron` | npm | ~11 yrs (org: electron/electron) | 4,277,587 | github.com/electron/electron | SUS (`too-new` — latest *version* published 2026-07-07) | Approved — false positive; official Electron org package, releases weekly, download count confirms legitimacy. No checkpoint needed. |
| `electron-builder` | npm | ~10 yrs (org: electron-userland) | 2,586,692 | github.com/electron-userland/electron-builder | SUS (`too-new`) | Approved — same false-positive pattern; canonical packaging tool, D-10 already locked this choice. |
| `@electron/rebuild` | npm | ~9 yrs (org: electron/rebuild) | 3,717,274 | github.com/electron/rebuild | SUS (`too-new`) | Approved — official Electron org scoped package. |
| `tree-kill` | npm | 2019 (latest version) | 38,600,861 | github.com/pkrumins/node-tree-kill | OK | Approved |
| `electron-log` | npm | mature, latest 2026-05-14 | 866,897 | github.com/megahertz/electron-log | OK | Approved |
| `electron-store` | npm | mature, latest 2025-10-05 | 912,128 | github.com/sindresorhus/electron-store | OK | Approved |
| `wait-on` | npm | mature, latest 2026-05-11 | 8,569,254 | github.com/jeffbski/wait-on | OK | Approved (optional, dev-only) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `electron`, `electron-builder`, `@electron/rebuild` — flagged only by the automated "too-new" heuristic (which measures latest-version publish recency, not package age); all three are official, extremely high-download, long-established packages from the Electron org itself. Given the download counts (millions/week) and repo provenance, **no `checkpoint:human-verify` is required before installing these three** — the automated heuristic misfires on any fast-release-cadence official package. The planner may skip a checkpoint for these specifically but should still verify the exact installed version against `npm view electron version` at execution time in case a newer version has shipped since this research.

*No packages in this phase were discovered via WebSearch/training data without registry+official-source corroboration — all core packages above are cross-referenced against their official GitHub orgs.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Electron Main Process (packages/desktop/src/main.ts)                 │
│                                                                        │
│  app.whenReady()                                                     │
│    │                                                                  │
│    ├─► requestSingleInstanceLock() ──fail──► app.quit()              │
│    │         │ success                                               │
│    │         ▼                                                       │
│    ├─► create Splash BrowserWindow (instant, shows progress text)    │
│    │         │                                                       │
│    ├─► venv exists? ──no──► run bundled uv.exe (uv venv + pip        │
│    │         │              install torch/whisperx/pyannote,         │
│    │         │              parse stdout for progress) ──► splash    │
│    │         │ yes                                                   │
│    │         ▼                                                       │
│    ├─► spawn(process.execPath, [backend/dist-src/index.ts],          │
│    │         { env: { ELECTRON_RUN_AS_NODE:'1', DATA_ROOT,           │
│    │                  PORT, FFMPEG_PATH, VENV_PYTHON, ... } })       │
│    │         │                                                       │
│    ├─► poll GET http://127.0.0.1:3001/api/health until 200 OK        │
│    │         │ (splash shows "Starting backend…" / "Bundling…")      │
│    │         ▼                                                       │
│    ├─► create Main BrowserWindow, loadURL('http://127.0.0.1:3001')   │
│    │         │                                                       │
│    └─► close Splash window                                           │
│                                                                        │
│  app.on('before-quit') / 'window-all-closed'                         │
│    └─► backend.send SIGTERM-equivalent → wait ≤5s → tree-kill(pid)   │
│                                                                        │
│  app.on('second-instance') ──► focus existing Main window            │
└─────────────────────────────────────────────────────────────────────┘
              │ spawns (real files via extraResources, not asar)
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Backend child process (unchanged Fastify app, packages/backend)      │
│  - binds 127.0.0.1:PORT (was 0.0.0.0:3001 — D-12 change)             │
│  - serves Vite-built frontend via @fastify/static                    │
│  - initBundle(): packaged → reuse prebuilt Remotion bundle path      │
│                   dev      → bundle() as today                       │
│  - orphan watchdog: setInterval checking parent PID still alive      │
│  - spawns Python: .venv/Scripts/python.exe scripts/transcribe.py     │
│  - spawns FFmpeg: <resources>/ffmpeg/ffmpeg.exe (bundled, D-13)      │
│  - worker_thread: render-worker.ts → @remotion/renderer renderMedia  │
│         with binariesDirectory pointing at unpacked compositor pkg   │
│         and browserExecutable pointing at unpacked chrome-headless   │
└─────────────────────────────────────────────────────────────────────┘
              │ HTTP (unchanged: fetch, SSE, video streaming)
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend (Electron BrowserWindow, plain browser context)             │
│  - React/Vite build, loaded from http://127.0.0.1:3001               │
│  - all existing relative /api fetches, SSE, <video> streaming work   │
│    unmodified — this is the payoff of D-02/D-04                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
packages/desktop/
├── src/
│   ├── main.ts              # app lifecycle, splash, single-instance lock
│   ├── backend-process.ts   # spawn/health-check/shutdown/tree-kill for backend child
│   ├── first-run-setup.ts   # uv venv provisioning + progress parsing
│   ├── remotion-bundle.ts   # build-time bundle() call + prebuilt-path resolution (build script, not runtime)
│   ├── config.ts            # userData paths, media-root default/override, env passed to backend
│   └── splash/              # minimal HTML/CSS for the splash window
├── build/
│   └── icon.ico
├── electron-builder.yml     # NSIS target, extraResources, asarUnpack, files
└── package.json
```

### Pattern 1: Spawning the existing backend TS source with no build step
**What:** Use Electron's own binary as the Node runtime for the backend child, avoiding a separate Node install or a TS→JS build step.
**When to use:** Whenever the child process needs full Node APIs but not Electron APIs (`require('electron')` is unavailable under this mode — fine, since the backend never imports it).
**Example:**
```typescript
// Source: pattern synthesized from Electron docs (ELECTRON_RUN_AS_NODE) + Node.js type-stripping docs
// [CITED: electronjs.org/docs/latest/api/app, nodejs.org/api/typescript.html]
import { spawn } from 'node:child_process'

const backendEntry = path.join(resourcesPath, 'backend', 'src', 'index.ts')
const proc = spawn(process.execPath, [backendEntry], {
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',   // makes electron.exe behave as plain `node`
    DATA_ROOT: dataRoot,          // userData-derived path (D-11)
    PORT: '3001',
    HOST: '127.0.0.1',            // D-12: localhost only
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
```
Node 22.18+ (Electron 43 bundles Node 24.17) runs `.ts` files with erasable-only syntax without any flag; the repo's backend has no enums/namespaces (verified by grep), so this works unmodified.

### Pattern 2: Prebuilt Remotion bundle for packaged mode (from official Remotion Electron template)
**What:** Bundle the Remotion composition once at `electron-builder` build time; at runtime, packaged apps skip `bundle()` entirely and point `serveUrl`/rendering APIs at the prebuilt bundle directory + platform-specific compositor package resolved outside `asar`.
**When to use:** Any Electron app that renders with `@remotion/renderer` in production — calling `bundle()` (a webpack build) on every app launch is slow and cannot run against files inside a compressed `asar` archive.
**Example:**
```typescript
// Source: remotion-dev/template-electron (official, fetched 2026-07-08)
// [CITED: github.com/remotion-dev/template-electron/blob/main/src/render-video.ts]
function getBinariesDirectory({ isPackaged, projectRoot }: { isPackaged: boolean; projectRoot: string }) {
  if (!isPackaged) return null
  const compositorPackage = getCompositorPackage({ arch: process.arch, platform: process.platform })
  // win32-x64 -> "@remotion/compositor-win32-x64-msvc"
  return path.join(path.dirname(projectRoot), 'app.asar.unpacked', 'node_modules', compositorPackage)
}

async function getServeUrl({ isPackaged, projectRoot }: { isPackaged: boolean; projectRoot: string }) {
  if (isPackaged) {
    if (!hasPrebuiltRemotionBundle(projectRoot)) {
      throw new Error('Packaged app missing its prebuilt Remotion bundle — rebuild the app.')
    }
    return getPrebuiltRemotionBundlePath(projectRoot)
  }
  return bundleRemotionProject({ projectRoot }) // dev only — current initBundle() behavior
}
```
Apply this by modifying `packages/backend/src/services/render.ts`'s `initBundle()`: branch on an `IS_PACKAGED` env var passed by Electron main, and skip `bundle()` in favor of a path to a prebuilt bundle shipped as `extraResources`.

### Pattern 3: Tree-kill + graceful-then-forceful shutdown (D-03)
**What:** Send a graceful signal, wait a bounded timeout, then force-kill the entire process tree.
**When to use:** Any time the app quits, to guarantee no orphaned Python/ffmpeg/render-worker processes survive.
**Example:**
```typescript
// Source: tree-kill README + Electron app lifecycle docs
// [CITED: github.com/pkrumins/node-tree-kill, electronjs.org/docs/latest/api/app]
import treeKill from 'tree-kill'

async function shutdownBackend(proc: ChildProcess, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      treeKill(proc.pid!, 'SIGKILL', () => resolve())  // Windows: taskkill /pid <pid> /T /F
    }, timeoutMs)
    proc.once('exit', () => { clearTimeout(timer); resolve() })
    proc.kill()  // best-effort graceful — backend's own SIGTERM handler tree-kills its children first
  })
}

app.on('before-quit', async (e) => {
  if (!backendProc) return
  e.preventDefault()
  await shutdownBackend(backendProc)
  app.exit()
})
```

### Pattern 4: Single-instance lock (D-03)
**What:** Prevent a second app launch from spawning a second backend on the same port.
**Example:**
```typescript
// Source: Electron official docs
// [CITED: electronjs.org/docs/latest/api/app#apprequestsingleinstancelock]
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
```

### Anti-Patterns to Avoid
- **Calling `bundle()` on every app launch in production:** Slow (several seconds of webpack work) and will fail against `asar`-packed source files. Pre-bundle at build time (Pattern 2).
- **Packaging the backend's `node_modules` inside `asar`:** `better-sqlite3`'s compiled `.node` binary and the platform-specific `@remotion/compositor-*` package cannot execute from inside a compressed archive. Ship the entire backend (source + `node_modules`) via `extraResources` as real files, or use `asarUnpack` globs for just those two packages if keeping the rest of the app in `asar`.
- **Using `child.kill()` alone for cleanup:** Only signals the direct child; ffmpeg processes spawned by the Python script or the render worker thread are grandchildren and will survive. Always use `tree-kill` (D-03's explicit requirement).
- **Relying on `PATH` for ffmpeg/uv/python in production:** The current `ffmpeg.ts` does `execFileSync('ffmpeg', ...)` assuming PATH — in a packaged app there is no guarantee of a PATH-available ffmpeg (that's the point of D-13 bundling it). Resolve absolute paths from `process.resourcesPath` instead, injected via env var or config as Claude's-discretion item states.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Native module ABI mismatch (`better-sqlite3` inside Electron) | A custom rebuild script that recompiles from source | `@electron/rebuild` (`electron-rebuild -f -w better-sqlite3`) + `electron-builder`'s `npmRebuild: true` | Handles Electron's specific Node ABI version automatically, tracks Electron version bumps |
| Process-tree termination on Windows | Manual `taskkill` shelling via `child_process.exec` | `tree-kill` npm package | Already wraps the correct Windows (`taskkill /T`) vs POSIX (`SIGTERM` walk) behavior; 38M+ weekly downloads, battle-tested |
| App settings persistence (window bounds, media root override) | Hand-rolled JSON read/write with manual `userData` path construction | `electron-store` | Atomic writes, schema/defaults, migrations — trivial problem with real edge cases (partial writes, concurrent access) |
| Health-check retry/backoff loop for splash screen | Hand-rolled `setInterval` polling with manual counters | Small hand-rolled retry loop is actually *fine* here (simpler than a dependency, needs custom progress-text callbacks `wait-on` doesn't provide) — noted as an exception, not a hand-roll violation |
| Windows CUDA/cuDNN DLL discovery | Guessing DLL search paths at random | `os.add_dll_directory()` (Python) pointed at the exact `site-packages/nvidia/{cudnn,cublas}/bin` directories that `pip`/`uv` already installed — see Pitfall 1 | This is a well-documented, narrow, deterministic fix, not a build-your-own-loader problem |

**Key insight:** Nearly everything in this phase has a known-good, official or community-verified pattern (Electron's own docs, `tree-kill`, `electron-store`, and — most importantly — Remotion's own official `template-electron` reference app, which solves the exact bundling/asar/compositor-path/headless-Chrome problem this phase faces). The only genuinely novel work is wiring these together and the first-run uv provisioning flow, which has no off-the-shelf library (uv itself has no progress API) and must be hand-built with text-scraping of `uv`'s stdout.

## Runtime State Inventory

> Rename/refactor/migration audit — this phase changes how the app is launched, where data lives, and how the Python venv is created, so it must account for state left behind by the current WSL-based dev workflow.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `data/*.db` (projects.db, presets.db, lane_presets.db) currently live at repo-root `DATA_ROOT` (`packages/backend/src/index.ts` resolves `../../../data` from `src`). Job directories (`DATA_ROOT/{jobId}/`) hold uploaded videos, transcripts, renders. | **Code edit, not data migration** — this is a personal dev machine, not a shipped-to-users app yet; there is no existing installed base to migrate. The plan should simply point `DATA_ROOT` at `app.getPath('userData')`/configurable media root going forward. If the user wants their existing `data/` dev content preserved, that's a manual one-time copy the user performs, not an automated migration task (no other users exist to migrate). |
| Live service config | None — no external services (n8n, Datadog, etc.) reference this app. | None — verified by reading `packages/backend/src` for third-party service registrations; found none. |
| OS-registered state | None on Windows yet (`no scheduled tasks / pm2 / launchd entries currently reference this app — it currently runs via `just dev` in a terminal, per justfile). | None — nothing to re-register. Installing via NSIS creates a Start Menu entry as new state, not a migration. |
| Secrets/env vars | `HUGGINGFACE_TOKEN` currently read from `process.env` (`.env` file, loaded via justfile's `dotenv-load`) by `routes/transcribe.ts`/`routes/diarize.ts`. | **Code edit** — D-09 moves this to an in-app settings screen storing the token in app config (`userData`), not an env var. The route handlers' `process.env.HUGGINGFACE_TOKEN` reads must be replaced with a config-store read. This is a behavior change, not a data migration (no existing users have a token stored anywhere durable yet). |
| Build artifacts | `.venv/` (WSL-side per Phase 09.1's WSL venv at `/root/.venv-wsl`, and/or a Windows-side venv from earlier `just setup-python-cuda` runs) — stale once native-Windows venv provisioning (D-07/D-08) replaces it. `packages/backend/dist/` (if `tsc --build` was ever run — currently `noEmit: true` so likely empty/unused). | **None required from this phase's automation** — the old WSL venv and any prior Windows dev venv are dev-machine-local artifacts the user can delete manually; the in-app first-run setup (D-08) creates a fresh venv under app-managed storage regardless of what exists. No code needs to detect/migrate the old venv location. |

**Nothing found in categories:** Live service config and OS-registered state — confirmed via source-tree read (no config files, no scheduled-task/service-registration code anywhere in `packages/backend` or `justfile`).

## Common Pitfalls

### Pitfall 1: ctranslate2 cannot find cuDNN/cuBLAS DLLs on native Windows
**What goes wrong:** `whisperx`'s transcription pipeline (via `faster-whisper` → `ctranslate2`) fails at runtime with `Could not locate cudnn_ops_infer64_8.dll` (or the cuDNN-9-era equivalent `cudnn64_9.dll`) even though `torch` itself successfully detects CUDA.
**Why it happens:** WhisperX's own `pyproject.toml` requires `ctranslate2>=4.5.0`, which moved to cuDNN 9 exclusively `[CITED: github.com/OpenNMT/CTranslate2 issue #1780]`. The `ctranslate2` PyPI wheel does **not** bundle cuDNN/cuBLAS DLLs and does not declare `nvidia-cudnn-cu12`/`nvidia-cublas-cu12` as pip dependencies (confirmed: inspected the actual `ctranslate2` wheel contents — no `.dll`/`.so` cudnn/cublas files inside, `[VERIFIED: PyPI wheel inspection]`). `torch`'s own `cu128` wheel *does* pull `nvidia-cudnn-cu12`/`nvidia-cublas-cu12` into `site-packages/nvidia/{cudnn,cublas}/bin`, but that directory registration is scoped to `torch`'s own DLL loader, not visible to `ctranslate2` as a separate C++ extension. This is a well-documented, still-live community issue as of the WhisperX 3.4.2-era Windows-GPU-broken report `[CITED: github.com/m-bain/whisperX issue #1216]` and multiple `faster-whisper` discussions `[CITED: github.com/SYSTRAN/faster-whisper discussion #715]`.
**How to avoid:** In `scripts/transcribe.py`/`scripts/diarize.py`, before importing `ctranslate2`/`whisperx`, add (Windows only):
```python
import sys, os
if sys.platform == 'win32':
    import nvidia.cudnn, nvidia.cublas
    os.add_dll_directory(os.path.join(os.path.dirname(nvidia.cudnn.__file__), 'bin'))
    os.add_dll_directory(os.path.join(os.path.dirname(nvidia.cublas.__file__), 'bin'))
```
This is a straightforward, deterministic fix once the `nvidia-cudnn-cu12`/`nvidia-cublas-cu12` packages are present in the venv (they will be, as transitive deps of `torch` cu128). This must be added as an explicit plan task, not assumed to "just work" because it worked under WSL (WSL's Linux `.so` dynamic linker behaves differently — `LD_LIBRARY_PATH`/rpath resolution — than Windows DLL search order).
**Warning signs:** First-run transcription test fails immediately with a `RuntimeError`/`OSError` mentioning a `.dll` name; symptom appears only on the CUDA/GPU code path, not CPU fallback, so it may not surface until a real video is transcribed.
**Confidence:** MEDIUM `[CITED: multiple corroborating GitHub sources]` — the *fix* is standard, but must be verified hands-on against the actual pinned versions (`torch~=2.8.0`, `ctranslate2>=4.5.0`, `pyannote-audio>=4.0.4`) on the target RTX 4080 machine before considering this pitfall closed. **Recommend a `checkpoint:human-verify` task specifically for "first native-Windows GPU transcription succeeds."**

### Pitfall 2: pyannote/HuggingFace cache symlinks require Windows Developer Mode
**What goes wrong:** Model downloads for pyannote pipelines fail or silently fall back to a slower, more disk-hungry mode with a warning about symlinks.
**Why it happens:** `huggingface_hub`'s cache system uses symlinks by default; Windows requires either admin rights or Developer Mode enabled to create symlinks as a non-admin user `[CITED: dev.to/danc — huggingface Developer Mode fix, github.com/huggingface/huggingface_hub issue #1062]`.
**How to avoid:** Two options — (a) instruct the user to enable Windows Developer Mode once (Settings → Privacy & Security → For Developers), or (b) set `HF_HUB_DISABLE_SYMLINKS=1` in the venv's environment before model downloads, which degrades gracefully to copying files instead of symlinking (more disk usage, still functional — no hard failure). Given this is a personal single-user app, **option (b) is the safer default** since it requires no user action and "it still works, just uses a bit more disk" is an acceptable tradeoff; expose Developer Mode as an optional recommendation in first-run setup UI copy, not a hard requirement.
**Warning signs:** Console warnings mentioning "symlink" during first model download; degraded mode does not fail transcription, so this is lower severity than Pitfall 1.

### Pitfall 3: Remotion `bundle()` and `renderMedia()` cannot run from inside `asar`
**What goes wrong:** Backend fails to bundle the Remotion composition (webpack cannot resolve module paths inside a compressed archive), or `renderMedia()` cannot find the platform compositor binary/headless Chrome.
**Why it happens:** `asar` is a read-only virtual filesystem; Electron patches Node's `fs` module to transparently read *individual files* from it, but tools that need real disk paths for spawning subprocesses, memory-mapping, or webpack's file-watching resolve logic do not work correctly against it.
**How to avoid:** Follow Pattern 2 above — pre-bundle at build time, ship the bundle + compositor package + headless-Chrome outside `asar` via `extraResources`/`asarUnpack`, and pass `binariesDirectory`/`browserExecutable` explicitly to `selectComposition()`/`renderMedia()` in packaged mode. This is exactly what the official `remotion-dev/template-electron` does.
**Warning signs:** Works fine in `npm run dev` but breaks only after `electron-builder` packaging — always test against a *built* installer, not just `electron .` in dev mode, before considering Remotion rendering "done."

### Pitfall 4: Orphaned ffmpeg/Python processes surviving app quit
**What goes wrong:** User quits the app, but a Python transcription process or an ffmpeg encode keeps running in the background (visible in Task Manager), consuming the GPU/CPU indefinitely.
**Why it happens:** `child.kill()` (or Electron simply exiting) only terminates the direct child; ffmpeg is spawned as a grandchild (by the Python script, or by the render-worker thread), and Windows does not automatically propagate process termination to a process tree the way POSIX process groups sometimes do.
**How to avoid:** This is exactly D-03's requirement — implement the graceful-then-tree-kill pattern (Pattern 3) at both the Electron-main→backend boundary AND ensure the backend itself tree-kills its own tracked Python/ffmpeg/worker children on SIGTERM (the backend already has the `ChildProcess` handles from `transcription.ts`/`diarization.ts`'s `{promise, process}` return shape — this just needs a SIGTERM handler added to `index.ts` that calls `tree-kill` on all currently-tracked handles).
**Warning signs:** Task Manager shows `python.exe`/`ffmpeg.exe` processes after the Electron window has closed; GPU memory not released.

## Code Examples

### Windows CUDA DLL directory registration (Pitfall 1 fix)
```python
# Source: synthesized from CTranslate2/faster-whisper community fixes
# [CITED: github.com/SYSTRAN/faster-whisper discussion #715, github.com/OpenNMT/CTranslate2 docs]
import sys, os

def register_windows_cuda_dlls() -> None:
    if sys.platform != 'win32':
        return
    try:
        import nvidia.cudnn
        import nvidia.cublas
        os.add_dll_directory(os.path.join(os.path.dirname(nvidia.cudnn.__file__), 'bin'))
        os.add_dll_directory(os.path.join(os.path.dirname(nvidia.cublas.__file__), 'bin'))
    except ImportError:
        pass  # CPU-only fallback path — no CUDA nvidia-* packages installed

# Call this at the very top of scripts/transcribe.py and scripts/diarize.py,
# before `import whisperx` / `import ctranslate2`.
```

### Health-check poll loop for splash window
```typescript
// Source: pattern synthesized — no single library covers this with custom progress callbacks
async function waitForBackendHealth(port: number, onProgress: (msg: string) => void, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`)
      if (res.ok) return
    } catch {
      onProgress('Starting backend…')
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('Backend did not become healthy in time')
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `--experimental-strip-types` behind a flag | Type-stripping unflagged/default | Node 22.18.0 (2025) `[CITED: nodejs.org/api/typescript.html]` | Electron 43's bundled Node 24.17 needs no flag at all to run this repo's backend TS directly |
| `child_process.fork` as the only Node-enabled child API in Electron | `utilityProcess` (Services-API-based) recommended for new code | Introduced Electron ~22, now the documented recommendation `[CITED: electronjs.org/docs/latest/api/utility-process]` | Not adopted this phase (D-02 keeps HTTP-only, plain `child_process.spawn` is sufficient and simpler for a standalone HTTP server child) |
| pyannote 3.x manual model licenses (`speaker-diarization-3.1`) | pyannote-audio 4.x `speaker-diarization-community-1` backend | WhisperX v3.8.6 (May 2025) switched default diarization backend | Already reflected in this repo's existing `pyproject.toml` pin (`pyannote-audio>=4.0.4`) — no change needed for this phase, just confirming the Windows port doesn't need to touch this |

**Deprecated/outdated:**
- WSL-based Python execution (`toWslPath()`, `/root/.venv-wsl`) from Phase 09.1 — fully removed per D-07; grep of current codebase confirms no `toWslPath`/`WSL` references remain in `packages/backend/src`, so there is no WSL-specific code to delete (already clean or never landed on this branch).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact fix for Pitfall 1 (`os.add_dll_directory` on `nvidia.cudnn`/`nvidia.cublas` package paths) will fully resolve CUDA transcription on the target RTX 4080 Windows machine with the repo's pinned `torch~=2.8.0`/`ctranslate2>=4.5.0`/`pyannote-audio>=4.0.4` versions | Common Pitfalls > Pitfall 1 | If wrong, transcription silently falls back to CPU (very slow) or hard-fails; this is exactly why a `checkpoint:human-verify` task is recommended rather than treating this as solved by research alone |
| A2 | uv has no JSON/machine-readable progress output for `uv venv`/`uv pip install`, requiring text-scraping of stdout for the first-run setup progress UI | Standard Stack > uv research digest; Don't Hand-Roll | If uv has since added a `--output json` or similar flag, the plan could use structured progress instead of fragile regex text-parsing — worth a quick `uv pip install --help` check at execution time |
| A3 | Electron's `app.getPath('userData')` on Windows resolves to `%APPDATA%\<productName>` and no additional configuration is needed to change the folder name from the default `package.json` `name` field | Architecture Patterns; D-11 | Low risk — this is standard, well-documented Electron behavior; worth explicitly setting `productName` in `electron-builder.yml` to control the exact folder name (e.g. "Eigen" per D-11's `%APPDATA%\Eigen` example) |
| A4 | HF_HUB_DISABLE_SYMLINKS=1 is a safe default that avoids requiring the user to enable Windows Developer Mode, with only a disk-usage tradeoff and no functional regression | Common Pitfalls > Pitfall 2 | If wrong (e.g. some pyannote code path assumes symlinks exist), model loading could fail in an unexpected way — low risk given HF's own docs describe this as an intentional graceful-degradation flag, but should be spot-checked during first-run testing |

## Open Questions

1. **Does the exact pinned dependency combination in this repo's `pyproject.toml` (`torch>=2.8.0,<2.9`, `whisperx` from git main, `pyannote-audio>=4.0.4`) actually resolve cleanly with `uv pip install` on native Windows, or does `whisperx`'s git-main `pyproject.toml`'s own `[tool.uv.sources]` index configuration (which the repo's `pyproject.toml` does NOT currently override the same way) cause a conflict?**
   - What we know: whisperX's own `pyproject.toml` (fetched from `main`) declares `[[tool.uv.index]] name = "pytorch" url = ".../whl/cu128" explicit = true` with a marker restricting to `(x86_64 or AMD64) and not darwin` — this **does** cover Windows/AMD64. The current repo's `pyproject.toml` has its own, simpler `override-dependencies` pinning torch/torchaudio version ranges but does not mirror whisperX's explicit index routing.
   - What's unclear: whether `uv`'s dependency resolution correctly merges the repo's top-level `pyproject.toml` overrides with the git-dependency's own `[tool.uv.sources]`/`[[tool.uv.index]]` blocks, or whether the repo needs to replicate the same index-routing config for a clean Windows resolve.
   - Recommendation: the planner should have the first execution task be a from-scratch `uv venv` + `uv pip install -e .` (or equivalent) run on the actual Windows machine as an early checkpoint, before building any of the Electron-specific first-run automation around it — don't build the provisioning UI against an unverified resolve.

2. **Should the backend's `node_modules` be shipped as `extraResources` (entirely outside `asar`) or should the app keep everything in `asar` except `better-sqlite3`/`@remotion/compositor-*` via `asarUnpack` globs?**
   - What we know: both patterns are documented and functional; `extraResources` for the whole backend is simpler to reason about (no asar-path-translation edge cases) but larger on disk (asar's compression is skipped entirely for the backend tree); `asarUnpack` keeps most of the backend compressed but requires careful glob patterns for every native/binary dependency.
   - What's unclear: whether the frontend's static build assets should be inside `asar` (served by `@fastify/static` reading from a real resolved path — either works since the backend does its own `fs.readFile`, not Electron's asar-patched `fs`, when it's spawned as a plain Node child outside Electron's renderer context — actually this matters: **a plain `child_process.spawn`'d Node process (via `ELECTRON_RUN_AS_NODE`) does NOT get Electron's asar `fs` patch**, since that patch is applied by Electron's own `app`/renderer initialization, not by plain Node. This means if the backend runs as a detached Node process, it **cannot** read frontend static files from inside `app.asar` at all.
   - Recommendation: **ship the entire backend package (source, `node_modules`, and the Vite-built frontend `dist/`) via `extraResources`, keeping it entirely outside `asar`.** This sidesteps the asar-fs-patch-doesn't-apply-to-spawned-children issue entirely and is the simplest, lowest-risk choice for this phase. Only the Electron main-process code itself (small, no native deps) needs to live inside `asar`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Dev tooling, backend (via Electron's embedded Node in production) | ✓ | v22.16.0 (dev machine; irrelevant to packaged app, which uses Electron 43's embedded v24.17.0) | — |
| electron (npm) | Desktop shell | ✓ (resolvable via npm registry) | 43.1.0 latest | — |
| electron-builder (npm) | NSIS packaging | ✓ (resolvable via npm registry) | 26.15.3 latest | — |
| uv | Python venv provisioning | Not yet installed in this research session's environment check scope — verify on the actual Windows target machine before relying on a system-wide `uv`; plan should bundle uv.exe regardless (D-08 discretion) | GitHub releases provide `uv-x86_64-pc-windows-msvc.zip` | Bundle uv.exe as `extraResources` rather than depending on system PATH `uv` |
| CUDA-capable GPU driver (RTX 4080) | WhisperX/pyannote GPU inference | Assumed ✓ (user's stated daily-driver machine) — not verifiable from this research environment (Linux/WSL dev sandbox, no Windows GPU access) | — | CPU fallback exists in the Python scripts already (device selection logic), but is much slower — acceptable degraded mode, not a blocker |
| FFmpeg/FFprobe static Windows binaries | Video normalize/waveform/thumbnail/render-mux | Available for download from gyan.dev and BtbN — both officially linked from ffmpeg.org/download.html | Latest builds updated within days of this research (gyan.dev "essentials" build, or BtbN `ffmpeg-master-latest-win64-gpl.zip`) | — |

**Missing dependencies with no fallback:** None identified — every dependency has either a verified-available path or an existing fallback (CPU inference, bundled binaries).

**Missing dependencies with fallback:**
- System-wide `uv` — not required; bundle the standalone binary instead.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend only, `packages/frontend/vitest.config.ts`) — backend and desktop packages have **no** existing test framework |
| Config file | `packages/frontend/vitest.config.ts` (frontend); none for backend/desktop |
| Quick run command | `npm run test --workspace packages/frontend` (`vitest run`) |
| Full suite command | Same — only 3 existing test files (`subtitleStore.test.ts`, `srtAlignment.test.ts`, `findReplace.test.ts`), none touch desktop/packaging concerns |

### Phase Requirements → Test Map
This phase has no mapped REQUIREMENTS.md IDs (see `<phase_requirements>`). Its "requirements" are the CONTEXT.md decisions (D-01…D-14). Most are infrastructure/packaging behaviors that are inherently better validated by **running the actual packaged installer** than by unit tests. Recommended mapping:

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|---------------------|-------------|
| D-03 (tree-kill/no stragglers) | On quit, no orphan python.exe/ffmpeg.exe processes remain | manual (Task Manager check) | — | ❌ Wave 0 — no automation possible for OS process inspection without a Windows-specific test harness; document as manual UAT step |
| D-03 (health check gate) | Splash window doesn't dismiss until `/api/health` returns 200 | smoke (could be a small script) | `node packages/desktop/scripts/smoke-health-check.mjs` | ❌ Wave 0 — write a minimal smoke script if the planner wants automation; otherwise manual |
| D-04 (frontend served correctly) | Loading `http://127.0.0.1:3001` in the Electron window renders the app | manual / smoke | — | ❌ Wave 0 |
| D-11 (config path resolution) | `DATA_ROOT` resolves under `userData` and is configurable | unit | `vitest run packages/desktop/src/config.test.ts` | ❌ Wave 0 — pure logic, easy to unit test once `config.ts` exists |
| Pitfall 1 fix (CUDA DLL registration) | Transcription succeeds on GPU on the real Windows machine | manual (`checkpoint:human-verify`) | — | ❌ Wave 0 — cannot be automated from this research environment; must be a human-verify checkpoint task |

### Sampling Rate
- **Per task commit:** `npm run test --workspace packages/frontend` (only frontend has tests; desktop/backend changes are validated by running the app, not automated tests, for most of this phase)
- **Per wave merge:** Full manual smoke test — launch the packaged installer, transcribe a short clip, render, quit, verify no orphan processes
- **Phase gate:** Full manual UAT walkthrough (install → first-run setup → transcribe → render → quit-and-recheck-processes) before `/gsd-verify-work`, given how much of this phase is infrastructure that unit tests cannot meaningfully cover

### Wave 0 Gaps
- [ ] `packages/desktop/src/config.test.ts` — unit tests for `userData`-relative path resolution logic (pure function, testable without Electron running)
- [ ] `packages/desktop/scripts/smoke-health-check.mjs` — optional standalone smoke script that spawns the backend and polls `/api/health`, usable both as a Wave gate and as a manual debugging tool
- [ ] No framework install needed — Vitest already present at the frontend workspace level; `packages/desktop` can add its own minimal `vitest.config.ts` reusing the same dependency if unit tests are added

*Most of this phase's verification is necessarily manual (installer behavior, Windows process lifecycle, GPU inference) — this is expected and acceptable for a packaging/infra phase. The planner should lean on `checkpoint:human-verify` tasks rather than forcing brittle automation of OS-level behavior.*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Single-user personal desktop app, no auth system (REQUIREMENTS.md explicitly excludes multi-user/auth) |
| V3 Session Management | No | No sessions — localhost-only, single user |
| V4 Access Control | No | No access control boundaries within a single-user local app |
| V5 Input Validation | Partial | Existing Fastify route validation patterns (unchanged by this phase) apply; the new settings screen (HF token input, media root path input) should validate the media-root path is a real, writable directory before saving, to avoid silent failures later |
| V6 Cryptography | Yes (narrow) | The HuggingFace token (D-09) is a bearer credential stored at rest in app config. **Do not store it in plaintext if avoidable** — Electron's `safeStorage` API (OS-level encryption: DPAPI on Windows) is the standard, non-hand-rolled way to encrypt small secrets like API tokens before writing them to disk `[CITED: electronjs.org/docs/latest/api/safe-storage]`. This is new-to-this-phase and should be called out explicitly to the planner since D-09 only said "stored in app config" without specifying encryption-at-rest. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Electron `nodeIntegration`/`contextIsolation` misconfiguration exposing Node APIs to remote/untrusted web content | Elevation of Privilege | Since the main `BrowserWindow` loads `http://127.0.0.1:3001` (locally-served, trusted first-party content, not remote/untrusted), the risk surface is much lower than a typical Electron app loading remote URLs — but `contextIsolation: true` and `nodeIntegration: false` should still be the default `BrowserWindow` webPreferences, since there's no reason for the renderer (a plain React SPA) to need Node access at all (D-02: no Electron IPC used) |
| Localhost port squatting / another local process binding 127.0.0.1:3001 first | Denial of Service | Health-check timeout + clear error UI if the backend fails to bind; consider using a fixed port only after confirming no conflict, or falling back to a dynamic port communicated to the Electron main process via stdout (not required by D-04, which explicitly wants a fixed `localhost:3001` — flag as an edge case, not a blocker) |
| HuggingFace token stored in plaintext app config | Information Disclosure | `safeStorage.encryptString()`/`decryptString()` (Electron built-in, OS keychain-backed) — see V6 above |
| Bundled ffmpeg/uv binaries tampered with post-install (supply-chain / local tampering) | Tampering | Out of scope for a personal single-user tool with no network distribution — noted for completeness, not actionable this phase |

## Sources

### Primary (HIGH confidence)
- `npm view <package> version` — direct npm registry queries for electron, electron-builder, @electron/rebuild, tree-kill, electron-log, electron-store, wait-on, better-sqlite3, @remotion/renderer versions (2026-07-08)
- `pip index versions <package>` — direct PyPI registry queries for ctranslate2, faster-whisper, pyannote-audio, nvidia-cudnn-cu12 (2026-07-08)
- GitHub API (`api.github.com/repos/astral-sh/uv/releases/latest`) — confirmed uv standalone Windows binary asset names
- Direct wheel inspection (downloaded `ctranslate2-4.8.1` wheel, enumerated contents) — confirmed no bundled cuDNN/cuBLAS DLLs
- `raw.githubusercontent.com/m-bain/whisperX/main/pyproject.toml` — exact current upstream dependency/index configuration
- Repo source read: `packages/backend/src/index.ts`, `transcription.ts`, `diarization.ts`, `ffmpeg.ts`, `render.ts`, `render-worker.ts`, `projectStore.ts`, `animationPresets.ts`, `lanePresets.ts`, `jobStore.ts`, `pyproject.toml`, `justfile`, package.json files across workspaces

### Secondary (MEDIUM confidence)
- `github.com/remotion-dev/template-electron` — official Remotion Electron reference app, fetched source (`packaged-browser.ts`, `compositor-package.ts`, `remotion-bundle.ts`, `render-video.ts`)
- `electronjs.org/blog/electron-43-0`, `electronjs.org/docs/latest/api/app`, `.../utility-process`, `.../safe-storage` — official Electron docs
- `nodejs.org/api/typescript.html` — official Node.js type-stripping docs
- `www.electron.build/nsis.html` and NSIS options docs — official electron-builder docs
- `docs.astral.sh/uv/*` — official uv docs (environment variables, installation)
- `opennmt.net/CTranslate2/installation.html` — official CTranslate2 docs

### Tertiary (LOW confidence — community reports, cross-corroborated but not official)
- `github.com/m-bain/whisperX` issues #1216, #1225 — Windows GPU cuDNN DLL issues
- `github.com/SYSTRAN/faster-whisper` discussion #715, issue #1086 — ctranslate2 CUDA/cuDNN compatibility community fixes
- `github.com/OpenNMT/CTranslate2` issue #1780, #1630 — cuDNN 9 migration issues
- `dev.to/danc` — HuggingFace Developer Mode symlink fix (community writeup, but aligns with official `huggingface_hub` issue #1062)

## Metadata

**Confidence breakdown:**
- Standard stack (Electron/electron-builder/tree-kill/etc.): HIGH — all versions registry-verified, all packages official/high-download
- Architecture (process spawning, Remotion packaging, tree-kill): HIGH — directly sourced from official Electron docs and Remotion's own official Electron template
- Python/CUDA/Windows-native pitfalls: MEDIUM — well-documented community issue with a known, deterministic fix, but genuinely unverifiable from this research environment (no Windows GPU access); flagged for a mandatory `checkpoint:human-verify` task
- uv first-run provisioning UX: MEDIUM — the mechanism (bundle uv.exe, run venv+pip install, scrape text progress) is sound, but no official progress API exists, so the exact UX will need iteration during implementation

**Research date:** 2026-07-08
**Valid until:** ~2026-08-07 (30 days) for Electron/npm ecosystem facts; the CUDA/cuDNN/ctranslate2 compatibility landscape moves faster and should be re-verified if implementation is delayed more than ~2 weeks — Astral/PyTorch/ctranslate2 release cadence is high
