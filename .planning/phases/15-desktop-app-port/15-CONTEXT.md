# Phase 15: Desktop App Port - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Package Eigen Video Editor as a Windows desktop application: the React frontend, Fastify backend, Python WhisperX/pyannote ML pipeline, FFmpeg, and Remotion rendering wrapped in an Electron shell, installed via a proper Windows installer and running fully natively (no WSL dependency). Includes a reserved fix-budget task for small webapp workflow issues surfaced during daily use.

</domain>

<decisions>
## Implementation Decisions

### Shell Technology & Architecture
- **D-01:** Electron is the desktop shell (chosen over Tauri and a lightweight tray-launcher). The all-Node stack (Fastify, Remotion renderer, better-sqlite3) makes Electron the natural host.
- **D-02:** Keep the HTTP frontend/backend split — NO rewrite to Electron IPC. The backend remains a Fastify HTTP server; all existing fetch/SSE/video-streaming code stays unchanged.
- **D-03:** Backend runs as a managed child process of the Electron main process with strict lifecycle guarantees:
  - Started with the app; Electron waits for `/api/health` before showing the main window.
  - Graceful shutdown on quit: backend receives SIGTERM-equivalent, kills its own tracked children (Python transcription, FFmpeg, Remotion render workers) before exiting.
  - Tree-kill fallback if graceful shutdown times out (~5s) — no straggler processes, ever (Windows: `taskkill /T` semantics).
  - Orphan watchdog: backend monitors parent PID and self-exits if the Electron process vanishes.
  - Single-instance lock: second launch focuses the existing window, never spawns a second backend on the port.
- **D-04:** Frontend is Vite-built to static files and served by the backend via `@fastify/static`; the Electron window loads `http://localhost:3001`. Relative `/api` fetches work untouched.
- **D-05:** Startup UX: a small splash/loading window appears instantly and shows startup progress until the backend health check passes (Remotion bundling takes several seconds), then the main window opens.

### Target Platform & Python/ML Strategy
- **D-06:** Windows only for this phase (user's daily-driver Windows/RTX 4080 machine). No macOS build. The M4 Mac Mini target in PROJECT.md is stale.
- **D-07:** Fully native Windows stack — the WSL dependency is removed entirely:
  - Python venv on Windows (uv-managed) with Windows CUDA torch wheels (cu128) + WhisperX + pyannote.
  - Backend spawns `.venv/Scripts/python.exe` (Windows path) instead of `.venv/bin/python3`.
  - Backend Node process runs natively on Windows inside Electron.
- **D-08:** Python environment provisioning: in-app first-run setup. The app detects a missing venv on launch and runs the uv-based setup itself (~5-6GB download), showing download/install progress in the UI. Installer stays small.
- **D-09:** HuggingFace token + models: in-app settings screen where the token is pasted once and stored in app config (no env vars). WhisperX large-v3 and pyannote models auto-download on first transcription with progress shown.

### Packaging, Data & Startup
- **D-10:** Distribution: Windows installer built with electron-builder (NSIS) — Start Menu entry, per-user install without admin rights, proper uninstaller.
- **D-11:** Data layout: settings + SQLite DBs live in the user-data dir (`%APPDATA%\Eigen` or Electron `app.getPath('userData')`); the heavy media root (videos, renders, thumbnails) defaults to a sensible user folder but is user-configurable in settings so it can point at a big drive. Repo-root `data/` convention is replaced.
- **D-12:** Network binding: localhost only (`127.0.0.1`). The LAN multi-device workflow is intentionally dropped for the desktop app.
- **D-13:** FFmpeg/FFprobe: static Windows binaries bundled inside the install — version-pinned, self-contained, replacing the current on-PATH requirement.

### Remaining Webapp Workflow Fixes
- **D-14:** Fix-budget approach: the plan reserves a small "workflow fixes" task without enumerating items now. The user names the specific fixes when execution reaches that task (or during verification of the desktop build). Do not invent a fix list.

### Claude's Discretion
- Exact Electron process API for the backend child (utilityProcess vs child_process) and health-check/retry details
- electron-builder configuration details (app id, icon, install dir defaults)
- Exact %APPDATA% directory naming and settings/config file format
- How the first-run setup invokes uv (bundled uv binary vs downloaded) and its progress-reporting mechanism
- Default location for the configurable media root
- Splash window visual design
- How bundled ffmpeg paths are injected into the existing ffmpeg service (env var vs config)
- Whether the Vite dev workflow (hot reload against the backend) is preserved alongside the packaged app

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above. Key source files for the port:

### Process Lifecycle & Spawning (all must change or be wrapped for Windows-native)
- `packages/backend/src/index.ts` — Server entry: port 3001, `0.0.0.0` binding (→ localhost per D-12), `DATA_ROOT` at repo root (→ configurable per D-11), Remotion `initBundle()` at startup
- `packages/backend/src/services/transcription.ts` — Spawns `.venv/bin/python3 scripts/transcribe.py` (Linux path → Windows venv path per D-07); tracks ChildProcess handle (basis for D-03 child cleanup)
- `packages/backend/src/services/diarization.ts` — Same venv-Python spawn pattern
- `packages/backend/src/services/ffmpeg.ts` — FFmpeg/FFprobe from PATH (→ bundled binaries per D-13)
- `packages/backend/src/services/render.ts` + `packages/backend/src/workers/render-worker.ts` — Remotion render via worker_threads; worker spawns ffmpeg directly
- `packages/backend/src/services/waveform.ts`, `packages/backend/src/services/thumbnail.ts` — Additional ffmpeg spawn sites

### Environment Provisioning
- `justfile` — `setup-python-cuda` recipe is the model for the in-app first-run setup (D-08); `dev` recipe shows current two-process launch
- `pyproject.toml` — Python deps: torch/torchaudio pins, whisperx from git, uv override-dependencies for the cpu/cu128 index conflict
- `scripts/transcribe.py`, `scripts/diarize.py` — The Python entry points the backend spawns

### Frontend Serving & Config
- `packages/frontend/vite.config.ts` — Dev proxy `/api` → 127.0.0.1:3001; production build must be served by backend (D-04)
- `packages/backend/src/routes/transcribe.ts`, `packages/backend/src/routes/diarize.ts` — Read `process.env.HUGGINGFACE_TOKEN` (→ app-config token per D-09)

### Persistence (data relocation per D-11)
- `packages/backend/src/services/projectStore.ts`, `packages/backend/src/services/animationPresets.ts`, `packages/backend/src/services/lanePresets.ts` — better-sqlite3 stores whose DB paths must move to userData
- `packages/backend/src/services/jobStore.ts` — Job dirs under `DATA_ROOT/{jobId}/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Backend already runs as a plain Node HTTP process with no dev-server coupling — can be child-processed by Electron as-is once paths/binding are parameterized
- `@fastify/static` is already a backend dependency — serving the built frontend is wiring, not new tech
- `transcription.ts` already returns `{ promise, process }` — the ChildProcess handle needed for D-03 cleanup exists
- SSE progress patterns (upload/transcribe/render) work unchanged over localhost HTTP
- justfile setup recipes encode the exact uv commands the first-run setup must replicate on Windows

### Established Patterns
- All child work goes through `node:child_process` spawn with JSON-line progress over stdout — the same pattern extends to the first-run uv setup
- Config currently comes from hardcoded consts (`DATA_ROOT`, port, venv path) and env vars (`HUGGINGFACE_TOKEN`) — the port introduces a real config layer (userData settings file) that these read from
- better-sqlite3 is a native module — Electron packaging must handle native-module rebuilds (electron-builder does this; version alignment matters)

### Integration Points
- New `packages/desktop` (or similar) Electron package in the npm workspace: main process, splash, single-instance lock, child-process manager, first-run setup UI
- `packages/backend/src/index.ts`: accept config (port binding, data root, ffmpeg path, venv path) instead of hardcoding
- Frontend: needs a settings surface (HF token, media root) — new page or dialog reachable from the header
- Windows watch-outs: `--experimental-strip-types` backend needs Node ≥22 inside Electron's runtime or a build step to plain JS; process tree-kill uses Windows semantics; long paths for model caches

</code_context>

<specifics>
## Specific Ideas

- Startup should feel like a real desktop editor: instant splash, then the app — never a blank window while Remotion bundles
- First-run setup modeled on how LM Studio-style apps provision large runtimes: in-app, progress-visible, one-time
- No straggler processes under any exit path (quit, crash, force-kill) — this was an explicit user concern

</specifics>

<deferred>
## Deferred Ideas

- macOS / M4 Mac Mini build — dropped from this phase (Windows only per D-06); revisit if the Mac Mini deployment becomes real again
- LAN multi-device access — intentionally dropped (D-12); could return later as a settings toggle
- Auto-update mechanism — not discussed; personal tool, manual reinstall acceptable for now

</deferred>

---

*Phase: 15-desktop-app-port*
*Context gathered: 2026-07-08*
