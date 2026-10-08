---
phase: 15-desktop-app-port
plan: 05
subsystem: infra
tags: [electron, desktop-shell, single-instance, splash, tree-kill, electron-log, vitest]

requires:
  - phase: 15-01
    provides: env-driven backend config (DATA_ROOT/MEDIA_ROOT/PORT/HOST/PARENT_PID/FRONTEND_DIST), /api/health, SIGTERM shutdown + parent watchdog
  - phase: 15-02
    provides: VENV_PYTHON / FFMPEG_PATH / FFPROBE_PATH / IS_PACKAGED / REMOTION_BUNDLE_DIR env contract, MEDIA_ROOT routing
provides:
  - "@eigen/desktop workspace (Electron 43.1.0) that launches with `electron .`"
  - Pure config.ts (resolveDataRoot, resolveMediaRoot, buildBackendEnv, resolvePackagedPaths) with unit tests
  - backend-process.ts (startBackend, waitForBackendHealth, shutdownBackend)
  - main.ts lifecycle - single-instance lock, instant splash, health-gated main window, graceful-then-tree-kill quit
  - Sandboxed preload exposing only window.eigen.chooseFolder (IPC channel eigen:choose-folder)
affects: [15-06, 15-07, 15-08, 15-09, packaging]

actuals:
  tokens: 5700
  tasks: 3
  commits: 3

tech-stack:
  added: [electron@43.1.0, electron-log@5.4.4, tree-kill@1.2.2 (desktop)]
  patterns:
    - "Backend spawned as plain Node child via process.execPath + ELECTRON_RUN_AS_NODE=1; type-stripping, no build step"
    - "Electron-free pure config module (userDataDir passed in) so path/env logic unit-tests without launching Electron"
    - "Health-gated window: splash -> poll /api/health -> main window -> close splash"

key-files:
  created:
    - packages/desktop/package.json
    - packages/desktop/tsconfig.json
    - packages/desktop/vitest.config.ts
    - packages/desktop/src/config.ts
    - packages/desktop/src/config.test.ts
    - packages/desktop/src/backend-process.ts
    - packages/desktop/src/main.ts
    - packages/desktop/src/preload.cjs
    - packages/desktop/src/splash/index.html
    - packages/desktop/src/splash/splash.css
  modified:
    - package-lock.json

key-decisions:
  - "Preload is src/preload.cjs (plain CommonJS), not preload.ts: sandboxed renderers cannot load TS/ESM preloads"
  - "userData pinned to %APPDATA%\\Eigen via app.setPath before the single-instance lock, independent of package name"
  - "On win32 shutdownBackend goes straight to tree-kill: Node's proc.kill() there is TerminateProcess, so the backend's SIGTERM handler never runs"
  - "Dev-only EIGEN_DEV_NODE override runs the backend under system Node because better-sqlite3 is built for the system ABI, not Electron's"
  - "resolvePackagedPaths encodes Plan 08's documented extraResources layout (backend, bin, remotion-bundle, frontend/dist) and a userData venv"

patterns-established:
  - "Main-process modules import siblings with explicit .ts extensions (Node type-stripping, allowImportingTsExtensions + erasableSyntaxOnly)"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-11, D-12]

coverage:
  - id: D1
    description: "config.ts derives DATA_ROOT from userData, MEDIA_ROOT default/override, and backend env (HOST 127.0.0.1, ELECTRON_RUN_AS_NODE=1, PARENT_PID, packaged paths)"
    requirement: "D-11"
    verification:
      - kind: unit
        ref: "packages/desktop/src/config.test.ts (9 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Electron shell spawns the existing backend, shows splash, opens main window on 127.0.0.1:3001 only after /api/health 200"
    requirement: "D-05"
    verification:
      - kind: other
        ref: "Linux WSLg smoke: `electron .` with EIGEN_DEV_NODE; log shows backend spawn, listen, renderer requests for / , assets, /api/projects"
        status: pass
    human_judgment: true
    rationale: "Splash/window visuals and Windows behavior need eyes on a real Windows launch"
  - id: D3
    description: "Single-instance lock: second launch exits without spawning a second backend"
    requirement: "D-03"
    verification:
      - kind: other
        ref: "Linux smoke: second `electron .` exited 0 immediately, one backend process remained"
        status: pass
    human_judgment: false
  - id: D4
    description: "Quit gracefully signals backend (SIGTERM handler ran, exit 0) and leaves no strays"
    requirement: "D-03"
    verification:
      - kind: other
        ref: "Linux smoke: SIGTERM to Electron main -> before-quit -> backend logged 'Shutting down (SIGTERM)', exited code=0, no electron/backend processes remained"
        status: pass
    human_judgment: true
    rationale: "Windows tree-kill (taskkill /T /F) path and child reaping cannot be exercised on Linux"
  - id: D5
    description: "Secure renderer defaults and minimal preload bridge (eigen.chooseFolder)"
    requirement: "D-01"
    verification:
      - kind: other
        ref: "tsc --noEmit + grep of contextIsolation/nodeIntegration/sandbox and eigen:choose-folder"
        status: pass
    human_judgment: true
    rationale: "Folder picker dialog behavior needs interactive verification (consumed by Plan 07)"

duration: 12min
completed: 2026-10-08
status: complete
---

# Phase 15 Plan 05: Electron Shell Core Summary

**New @eigen/desktop Electron 43 workspace that spawns the existing TS backend with ELECTRON_RUN_AS_NODE, gates a splash-to-window handoff on /api/health, enforces a single instance, and tree-kills the backend on quit**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-10-08T05:40Z (approx.)
- **Completed:** 2026-10-08T05:52Z
- **Tasks:** 3
- **Files modified:** 11 (10 created, package-lock.json)

## Accomplishments
- `packages/desktop` joins the root `packages/*` workspace; existing packages untouched (backend `tsc -b` still green).
- `config.ts` is Electron-free and unit tested (9 tests): data root, media-root override/default, `buildBackendEnv`, and `resolvePackagedPaths`.
- `backend-process.ts`: spawn with piped stdio forwarded into electron-log; health poll every 300 ms (30 s cap, with a fail-fast hook if the child exits); graceful kill then tree-kill after 5 s.
- `main.ts`: single-instance lock, frameless 360x200 always-on-top splash, health-gated main window, navigation locked to the localhost origin, `before-quit` awaits backend shutdown, native folder picker IPC.
- Verified for real under WSLg on Linux (see Verification).

## Task Commits

1. **Task 1: Scaffold workspace + config.ts + unit test** - `be30d26` (feat)
2. **Task 2: backend-process.ts** - `a1e184c` (feat)
3. **Task 3: main.ts, preload, splash (plus resolvePackagedPaths)** - `c6431a4` (feat)

**Plan metadata:** docs(15-05) commit following this summary.

## Files Created/Modified
- `packages/desktop/src/main.ts` - app lifecycle, splash, window creation, IPC handler, shutdown
- `packages/desktop/src/backend-process.ts` - startBackend / waitForBackendHealth / shutdownBackend
- `packages/desktop/src/config.ts` - pure path/env derivation
- `packages/desktop/src/preload.cjs` - contextBridge `window.eigen.chooseFolder`
- `packages/desktop/src/splash/{index.html,splash.css}` - UI-SPEC splash with inlined token hex values and looping 4px accent-green bar
- `packages/desktop/{package.json,tsconfig.json,vitest.config.ts}` - workspace scaffolding; `package-lock.json` updated

## Decisions Made
See key-decisions in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preload is `preload.cjs`, not `preload.ts`**
- **Found during:** Task 3
- **Issue:** Plan lists `src/preload.ts` and a `contextIsolation`/sandbox-on window. Electron's sandboxed renderer can only load a plain CommonJS preload; a `.ts` file would never load and `window.eigen` would be undefined.
- **Fix:** `src/preload.cjs` (same content: only `eigen:choose-folder`). The plan's grep for `eigen:choose-folder` was run against this file.
- **Files modified:** packages/desktop/src/preload.cjs, main.ts (preload path)
- **Commit:** c6431a4

**2. [Rule 1 - Bug] Windows shutdown skips the graceful signal**
- **Found during:** Task 2
- **Issue:** On Windows Node's `proc.kill()` is an unconditional TerminateProcess; the backend's SIGTERM handler (which reaps python/ffmpeg children) would never run, and the parent watchdog dies with the backend, orphaning children.
- **Fix:** `shutdownBackend` uses graceful `proc.kill()` on POSIX only; on win32 it tree-kills immediately (taskkill /T /F via tree-kill).
- **Files modified:** packages/desktop/src/backend-process.ts
- **Commit:** a1e184c

**3. [Rule 3 - Blocking] Dev backend cannot load better-sqlite3 under Electron's Node**
- **Found during:** Task 2 verification (ran backend with `ELECTRON_RUN_AS_NODE=1` on Linux)
- **Issue:** `ERR_DLOPEN_FAILED` - better-sqlite3 is built for the system Node ABI; Electron's Node 24 ABI differs. Packaged builds fix this via electron-rebuild (Plan 08), but `electron .` in dev would crash.
- **Fix:** Optional `nodeBinary` on `startBackend`; `main.ts` honors `EIGEN_DEV_NODE` only when `!app.isPackaged`, adding `--experimental-strip-types` for older system Nodes. Packaged path is unchanged (Electron's Node).
- **Files modified:** backend-process.ts, main.ts
- **Commit:** a1e184c, c6431a4

**4. [Rule 2 - Missing critical] Packaged path resolution + navigation/ startup-failure hardening**
- **Found during:** Task 3
- **Issue:** Plan said main.ts resolves packaged binary paths but gave no unit-testable home for them; also no handling for backend failing before health (T-15-53) or renderer navigating away.
- **Fix:** Pure `resolvePackagedPaths` in config.ts (tested; follows Plan 08's stated layout); `will-navigate` locked to the app origin and `window.open` denied; backend-exit abort hook and an error dialog on startup failure.
- **Files modified:** config.ts, config.test.ts, main.ts
- **Commit:** c6431a4

---

**Total deviations:** 4 auto-fixed (3 bug/blocking, 1 missing-critical)
**Impact on plan:** All necessary for the shell to actually work; no scope creep. Electron pinned to 43.1.0 (RESEARCH version; `npm view` shows 44.7.0 is newer, deliberately not adopted since the Node 24 type-stripping assumption was researched against 43).

## Issues Encountered
- Frontend test suite has 5 pre-existing failures in `subtitleStore.test.ts` (unrelated); logged in `.planning/phases/15-desktop-app-port/deferred-items.md`.
- `npm install` did not fetch the Electron binary for the Linux sandbox; ran `node node_modules/electron/install.js` manually (local only).

## Verification
- `npm run test --workspace packages/desktop`: 9/9 pass.
- `npx tsc --noEmit -p packages/desktop`: exit 0. `npx tsc -b packages/backend`: exit 0.
- Task-level grep acceptance checks: all pass (preload check against `preload.cjs`).
- Real launch under WSLg (Linux Electron, `EIGEN_DEV_NODE`): TS main loaded unflagged; backend spawned and went healthy; main window requested `/`, built assets and `/api/projects` from 127.0.0.1:3001; second `electron .` exited immediately without a second backend; SIGTERM to Electron triggered `before-quit`, backend logged `Shutting down (SIGTERM)` and exited 0; no strays.

## Known Stubs

None. (`resolveMediaRoot` is called without an override in main.ts; Plan 07 wires the user's saved media-root setting - noted in a code comment.)

## Threat Flags

None beyond the plan's threat model. T-15-51/52/53/54 mitigations are implemented (contextIsolation + sandbox + minimal bridge, single-instance lock, bounded health wait with surfaced error, graceful-then-tree-kill).

## Env Contract Coverage / Gaps for Later Plans
`buildBackendEnv` covers DATA_ROOT, MEDIA_ROOT, PORT, HOST, PARENT_PID, ELECTRON_RUN_AS_NODE, IS_PACKAGED, VENV_PYTHON, FFMPEG_PATH, FFPROBE_PATH, UV_PATH, REMOTION_BUNDLE_DIR, FRONTEND_DIST. Gaps:
- Plan 07: user-saved media-root override and HF token are not read yet (no settings store exists in the shell).
- Plan 08: `resolvePackagedPaths` assumes the layout in 15-08-PLAN (`<resources>/backend/src/index.ts`, `bin/*.exe`, `remotion-bundle`, `frontend/dist`); adjust there if the electron-builder config differs. Also needs electron-rebuild for better-sqlite3 so the packaged `process.execPath` backend loads.
- `HF_HUB_DISABLE_SYMLINKS=1` (RESEARCH pitfall) is not injected here; Plan 06/09 can add it to the env.
- Dev launch requires `packages/frontend/dist` (`npm run build --workspace packages/frontend`) and `EIGEN_DEV_NODE=$(which node)`; no `just` recipe added.

## Human Verification Needed (deferred)
- On native Windows: `electron .` / installed app shows splash then window, quit leaves no `node`/`python`/`ffmpeg` strays (tree-kill path), second launch focuses the existing window, folder picker returns a path. Linux smoke does not cover the win32 code paths.

## Next Phase Readiness
- Plan 06/07 can build on `window.eigen.chooseFolder` and the injected env; Plan 08 must honor the resource layout and add native-module rebuild; Plan 09 verifies end to end on Windows.

## Self-Check: PASSED

- FOUND files: packages/desktop/{package.json,tsconfig.json,vitest.config.ts}, src/{config.ts,config.test.ts,backend-process.ts,main.ts,preload.cjs}, src/splash/{index.html,splash.css}
- FOUND commits: be30d26, a1e184c, c6431a4
- 9/9 unit tests and desktop + backend typechecks re-run green after final commit.
