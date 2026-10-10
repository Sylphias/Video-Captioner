---
phase: 15-desktop-app-port
verified: 2026-10-10T12:13:19Z
status: passed
score: 33/33 must-haves verified
behavior_unverified: 0
overrides_applied: 0
behavior_unverified_items:
  - truth: "Backend self-exits if its parent (Electron) process disappears (orphan watchdog, D-03); CONTEXT requires no strays on any exit path: quit, crash, force-kill"
    test: "In the installed app, start a transcription (python running), then kill only the Eigen.exe main process from Task Manager 'End task' (not 'End process tree'). Repeat during an active render. Wait about 5 seconds."
    expected: "The backend node process (Eigen.exe running as node) exits within about 2-4s. No python.exe, uv.exe, ffmpeg.exe or Remotion chrome-headless-shell/compositor processes remain under the Eigen install or %APPDATA%\\Eigen."
    why_human: "The 2026-10-10 UAT covered normal quit only, where Electron runs taskkill /T on the backend tree. The watchdog path (PARENT_PID poll, then shutdown(), then killAll()) is a different code path with no automated test. On that path ffmpeg spawns and Remotion's browser/compositor processes are NOT registered in childRegistry, so they may outlive the backend on Windows."
human_verification:
  - test: "Force-kill only the Eigen.exe main process (Task Manager 'End task') while a transcription is running, then again while a render is running"
    expected: "Within about 5s the backend exits by itself and no python.exe / uv.exe / ffmpeg.exe / chrome-headless-shell / remotion compositor processes from Eigen remain"
    why_human: "Crash/force-kill exit path (explicit user concern in 15-CONTEXT specifics) is not covered by the quit-path UAT; it requires native Windows process inspection"
---

# Phase 15: Desktop App Port Verification Report

**Phase Goal:** Package the app as a desktop application: web frontend, Node server, Python ML backend and Remotion rendering wrapped in an Electron shell. Also fix the remaining small webapp workflow issues found in daily use.
**Verified:** 2026-10-10T12:13:19Z
**Status:** human_needed
**Re-verification:** No (initial verification)

ROADMAP Phase 15 has no Success Criteria block, so the must-haves come from the frontmatter of the 9 plans (33 truths). These are cross-checked against D-01 to D-14 in 15-CONTEXT.md. As instructed, the human UAT the user approved on 2026-10-10 counts as behavioural evidence for the items it covered (recorded in the 15-04, 15-08 and 15-09 SUMMARYs). Every code claim below was checked against the source at HEAD aa5d205.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Backend binds 127.0.0.1 and reads port/host/data-root/media-root from env with dev fallbacks (D-11, D-12) | VERIFIED | `index.ts:34,38` DATA_ROOT/MEDIA_ROOT env with fallbacks; `:101` `host: process.env.HOST ?? '127.0.0.1'`. No `0.0.0.0` in backend or desktop src |
| 2 | Backend serves the Vite-built frontend at / via @fastify/static; /api and the dev proxy keep working (D-04) | VERIFIED | `index.ts:73-86` registers fastifyStatic when the dist exists, with SPA fallback for non-/api GETs and a JSON 404 for /api. UAT: main window loads the SPA |
| 3 | On SIGTERM/SIGINT the backend tree-kills tracked children, then closes Fastify (D-03) | VERIFIED (with warning) | `index.ts:108-125` shutdown(): terminateActiveRenders, `killAll('SIGKILL')`, fastify.close, exit. `childRegistry.ts` uses tree-kill. **Caveat:** ffmpeg spawns are not tracked (15-02 decision), contrary to the "(python, ffmpeg, render worker)" wording. On Windows quit this does not matter because Electron runs taskkill /T on the whole backend tree (UAT: no strays) |
| 4 | Backend self-exits if its parent (Electron) process disappears (orphan watchdog, D-03) | PRESENT_BEHAVIOR_UNVERIFIED | `index.ts:129-141` polls `process.kill(PARENT_PID,0)` every 2s and calls shutdown on ESRCH. PARENT_PID is injected by `config.ts buildBackendEnv`. I confirmed on this Windows machine that `process.kill(deadPid,0)` throws ESRCH. However, no test or UAT step covered an Electron crash or force-kill (see Human Verification) |
| 5 | Python spawned from an env-overridable Windows venv path, `.venv/Scripts/python.exe` default (D-07) | VERIFIED | `transcription.ts:13-17`, `diarization.ts:13-17` (platform-aware default); packaged path `<userData>/venv/Scripts/python.exe` comes from `resolvePackagedPaths` |
| 6 | FFmpeg/FFprobe resolve from env-injected bundled paths with PATH fallback (D-13) | VERIFIED | `FFMPEG_PATH`/`FFPROBE_PATH` in ffmpeg.ts, thumbnail.ts, waveform.ts, render-worker.ts. Injected by `buildBackendEnv`. `dist/win-unpacked/resources/bin/{ffmpeg,ffprobe,uv}.exe` present |
| 7 | Every spawned python/render-worker process registers for shutdown cleanup (D-03 wiring) | VERIFIED | `registerChild`/`unregisterChild` in transcription.ts, diarization.ts and pythonEnv.ts (uv). Render Workers are tracked in `activeWorkers` and terminated by `terminateActiveRenders()` (render.ts:16-24, 88, 110) |
| 8 | Packaged mode reuses a prebuilt Remotion bundle (Pattern 2) | VERIFIED | `render.ts:29-40` IS_PACKAGED + REMOTION_BUNDLE_DIR, failing fast if missing. `build-remotion-bundle.mjs` runs at build time. `resources/remotion-bundle` is present in win-unpacked |
| 9 | Windows cuDNN/cuBLAS DLL dirs are registered before whisperx/ctranslate2 import (Pitfall 1) | VERIFIED | `register_windows_cuda_dlls()` is called at transcribe.py:38 / diarize.py:31, before `import torch` (transcribe.py:42). 15-04 GPU run: no DLL errors |
| 10 | The HF cache works without Developer Mode (HF_HUB_DISABLE_SYMLINKS default) | VERIFIED | `os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS","1")` in both scripts |
| 11 | A native-Windows uv setup recipe resolves torch cu128 + whisperx + pyannote (D-07) | VERIFIED | justfile:40-43 `setup-python-windows`; pyproject cu128 index gated to win32. 15-04 human: clean resolve, torch 2.8.0+cu128 |
| 12 | A from-scratch uv install on native Windows resolves with no index conflict | VERIFIED | 15-04 human result (RTX 4080) |
| 13 | transcribe.py transcribes on the RTX 4080 using CUDA (word-level output) | VERIFIED | 15-04 human result: cuda/float16, 97 word entries. Re-confirmed in 15-09 E2E GPU transcription |
| 14 | A packages/desktop Electron workspace exists and `electron .` launches it (D-01) | VERIFIED | `packages/desktop/package.json` (electron 43.1.0, main src/main.ts). The installed app launched in UAT |
| 15 | The single-instance lock focuses the existing window on a second launch (D-03) | VERIFIED | `main.ts:35-45` requestSingleInstanceLock + second-instance focus. UAT: single-instance relaunch PASS |
| 16 | Electron spawns the backend via process.execPath + ELECTRON_RUN_AS_NODE=1 with injected config (D-02, D-03, D-11, D-12) | VERIFIED | `backend-process.ts:28-35`; `config.ts buildBackendEnv` sets DATA_ROOT/MEDIA_ROOT/PORT/HOST/PARENT_PID. No IPC rewrite: preload exposes only `eigen:choose-folder` |
| 17 | Instant splash; the main window opens on 127.0.0.1:3001 only after /api/health returns 200 (D-04, D-05) | VERIFIED | `main.ts boot()`: createSplash, then `waitForBackendHealth`, then createMainWindow(APP_URL). UAT: splash then main window PASS |
| 18 | On quit the backend is signalled, then tree-killed within about 5s (D-03) | VERIFIED | `main.ts before-quit` and `shutdownBackend(proc,5000)`. On win32 it goes straight to treeKill (taskkill /T /F), a documented deviation that still achieves the intent. UAT: no Eigen/ffmpeg/uv strays after quit |
| 19 | config.ts path resolution has passing unit tests | VERIFIED | Ran `vitest run` in packages/desktop: 13/13 pass |
| 20 | The app detects a missing venv on launch and shows the first-run setup screen (D-08) | VERIFIED | `App.tsx:16,49-52` gates on `useSetup().status !== 'ready'`; `GET /api/setup/status` uses venvExists() plus an incomplete marker |
| 21 | Set Up Environment runs uv provisioning that mirrors the recipe and streams progress (D-08) | VERIFIED | `pythonEnv.ts buildSteps` matches justfile:41-43 (plus `--python 3.12`); SSE `POST /api/setup/start`. 15-08 UAT: first-run setup in the packaged app PASS |
| 22 | Setup failure shows an actionable error with Retry; mid-download cancel asks for confirmation | VERIFIED | FirstRunSetup.tsx: "Retry Setup", "Cancel Setup?" / "Continue Setup"; `/api/setup/cancel`. The useSetup tests pass |
| 23 | Once the venv exists, the app goes straight to the editor | VERIFIED | App gate; the UAT reinstall/relaunch went straight in |
| 24 | The HF token is entered once in settings and persisted in app config (D-09) | VERIFIED | `appConfig.ts` writes settings.json under DATA_ROOT (atomic, 0600); `routes/settings.ts` PUT. UAT: settings with HF token PASS |
| 25 | transcribe/diarize read the HF token from app config (D-09) | VERIFIED | transcribe.ts:86, diarize.ts:63 `appConfig.getSetting('hfToken') ?? env`. UAT: diarization worked |
| 26 | The media root can be viewed and changed through a native folder picker (D-11) | VERIFIED | SettingsDialog `window.eigen.chooseFolder` calls IPC `eigen:choose-folder` (main.ts) and `dialog.showOpenDialog`. `readSavedMediaRoot` feeds MEDIA_ROOT at next launch. UAT: storage folder PASS |
| 27 | First-transcription model download shows progress | VERIFIED | `modelCache.ts` plus `Job.phase='downloading_model'`; SubtitlesPage.tsx:663-664 "Downloading transcription model… N%" |
| 28 | electron-builder produces a per-user NSIS installer with Start Menu entry and uninstaller, no admin (D-10) | VERIFIED | electron-builder.yml nsis: `oneClick:false, perMachine:false, allowElevation:false, createStartMenuShortcut:true`; `dist/Eigen-Setup-0.0.1.exe` (222 MB, built 2026-10-10 15:45). 15-08 human PASS |
| 29 | Backend source + node_modules + frontend dist, the Remotion bundle, ffmpeg/ffprobe and uv ship as real files outside asar | VERIFIED | `dist/win-unpacked/resources/{backend(node_modules,src),frontend,remotion-bundle,bin,scripts}` present; app.asar holds only the shell |
| 30 | better-sqlite3 and the Remotion compositor are rebuilt/unpacked for Electron's ABI | VERIFIED | `stage-backend.mjs` runs @electron/rebuild; `after-pack.cjs` asserts both exist. `resources/backend/node_modules/better-sqlite3/build/Release/better_sqlite3.node` present. The packaged app ran (UAT) |
| 31 | The Remotion composition is pre-bundled at build time and referenced via REMOTION_BUNDLE_DIR | VERIFIED | `package.json prebuild` runs build-remotion-bundle.mjs; `resolvePackagedPaths.remotionBundleDir` is passed into env and consumed by render.ts |
| 32 | The user's named workflow fixes are implemented within the reserved budget (D-14) | VERIFIED | Three user-named fixes: `lib/timelineZoom.ts` (playhead-anchored zoom, offscreen indicator) and `lib/edgeHandleZones.ts`, both wired into TimingEditor.tsx (imports at lines 8-13, used at :253, :287, :703, :782) and MiniTimeline.tsx. Helper tests pass (34 tests across 4 files run). UAT: timeline fixes PASS |
| 33 | The packaged app completes the full Windows loop: install, provision, GPU transcribe, render, download, quit with no orphans (D-03) | VERIFIED | 15-09 E2E UAT approved by the user 2026-10-10 (rebuilt installer); Win32_Process parent-chain trace showed no Eigen/ffmpeg/uv strays |

**Score:** 32/33 truths verified (1 present but behaviour unverified)

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| packages/backend/src/services/childRegistry.ts | VERIFIED | Implemented with tree-kill; imported by index, transcription, diarization, pythonEnv |
| packages/backend/src/index.ts | VERIFIED | Env config, static serving, shutdown, watchdog, setup/settings routes registered |
| packages/backend/src/services/transcription.ts / render.ts | VERIFIED | Env paths, registry wiring, prebuilt-bundle branch |
| scripts/transcribe.py, scripts/diarize.py, justfile | VERIFIED | DLL registration before imports; Windows recipes |
| packages/desktop/src/{main,backend-process,config}.ts, preload.cjs, splash/ | VERIFIED | Substantive and wired (`preload.ts` became `preload.cjs`, a justified deviation) |
| packages/backend/src/services/pythonEnv.ts, routes/setup.ts | VERIFIED | Wired to FirstRunSetup through useSetup |
| packages/frontend/src/components/FirstRunSetup.tsx, hooks/useSetup.ts | VERIFIED | Gates App |
| packages/backend/src/services/appConfig.ts, routes/settings.ts | VERIFIED | Registered in index.ts; consumed by transcribe/diarize routes |
| packages/frontend/src/components/SettingsDialog.tsx | VERIFIED | Opened from the Header gear (`data-tooltip="Settings"`) |
| packages/desktop/electron-builder.yml, scripts/{build-remotion-bundle,fetch-binaries,stage-backend}.mjs, after-pack.cjs | VERIFIED | Installer artifact present; binaries are SHA-256 pinned |
| packages/frontend/src/lib/{timelineZoom,edgeHandleZones}.ts | VERIFIED | Imported and used by both timelines |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| index.ts shutdown | childRegistry.killAll + terminateActiveRenders | direct call | WIRED |
| transcription/diarization/pythonEnv spawn | childRegistry.registerChild | pid on spawn, unregister on close | WIRED |
| desktop config.buildBackendEnv | backend env (VENV_PYTHON, FFMPEG_PATH, FFPROBE_PATH, UV_PATH, IS_PACKAGED, REMOTION_BUNDLE_DIR, FRONTEND_DIST, SCRIPTS_DIR, PARENT_PID) | spawn env | WIRED |
| electron-builder extraResources layout | resolvePackagedPaths | process.resourcesPath | WIRED (matches win-unpacked layout) |
| main.ts | /api/health | waitForBackendHealth, then loadURL(127.0.0.1:3001) | WIRED |
| App.tsx | /api/setup/status, /start, /cancel | useSetup fetch + SSE | WIRED |
| SettingsDialog | /api/settings + window.eigen.chooseFolder → ipcMain `eigen:choose-folder` | settingsPrefs fetch / preload bridge | WIRED |
| settings.json mediaRoot | MEDIA_ROOT at next launch | main.ts readSavedMediaRoot → resolveMediaRoot | WIRED |
| routes transcribe/diarize | appConfig hfToken | fastify.appConfig.getSetting | WIRED |
| TimingEditor / MiniTimeline | timelineZoom / edgeHandleZones | imports + calls | WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Desktop config/env unit tests | `cd packages/desktop && npx vitest run` | 13/13 pass | PASS |
| D-14 helpers + setup/settings client tests | `npx vitest run --config packages/frontend/vitest.config.ts timelineZoom edgeHandleZones settingsPrefs useSetup` | 4 files, 34/34 pass | PASS |
| Desktop typecheck | `npx tsc --noEmit -p packages/desktop` | exit 0 | PASS |
| Backend typecheck | `npx tsc -b packages/backend --force` | exit 0 | PASS |
| Watchdog liveness semantics on Windows | node: `process.kill(exitedPid,0)` | throws ESRCH; self-probe OK | PASS (semantics only, not the end-to-end watchdog) |
| Packaged layout | `ls dist/win-unpacked/resources{,/bin,/backend}` | backend, frontend, remotion-bundle, scripts, bin/{ffmpeg,ffprobe,uv}.exe, better_sqlite3.node | PASS |

### Probe Execution

Step 7c: SKIPPED. No `scripts/*/tests/probe-*.sh` files exist and no plan declares one.

### Requirements Coverage

D-01 to D-14 are defined in 15-CONTEXT.md. REQUIREMENTS.md has no D-xx traceability rows.

| Req | Source Plan(s) | Status | Evidence |
|-----|----------------|--------|----------|
| D-01 Electron shell | 15-05 | SATISFIED | packages/desktop Electron 43 workspace |
| D-02 keep HTTP split, no IPC rewrite | 15-05 | SATISFIED | Backend is a child over HTTP; the only IPC is the folder picker |
| D-03 managed child lifecycle (health gate, graceful/tree-kill, watchdog, single-instance) | 15-01, 15-05, 15-09 | SATISFIED for quit / single-instance (UAT). Watchdog crash path NEEDS HUMAN | Truths 3, 4, 15, 18, 33 |
| D-04 static frontend served by the backend; window loads localhost:3001 | 15-01, 15-02, 15-05 | SATISFIED | Truths 2, 8, 17 |
| D-05 splash until health | 15-05 | SATISFIED | Truth 17 + UAT |
| D-06 Windows only | 15-03, 15-04, 15-08 | SATISFIED | win target only; native Windows GPU verified |
| D-07 fully native Windows stack | 15-02, 15-03, 15-04, 15-06 | SATISFIED | Scripts/python.exe venv, cu128, no WSL |
| D-08 in-app first-run setup | 15-06 | SATISFIED | Truths 20-23 |
| D-09 HF token in settings; model auto-download with progress | 15-07 | SATISFIED | Truths 24, 25, 27 (download progress is tracked for whisper large-v3 only; the pyannote download has no progress UI, which is minor) |
| D-10 per-user NSIS installer | 15-08 | SATISFIED | Truth 28 |
| D-11 userData data layout, configurable media root | 15-01, 15-05, 15-07 | SATISFIED | %APPDATA%\Eigen\data and media, settings picker |
| D-12 localhost only | 15-01, 15-05 | SATISFIED | 127.0.0.1 default + injected HOST |
| D-13 bundled ffmpeg/ffprobe | 15-02, 15-08 | SATISFIED | SHA-pinned ffmpeg 9.0.2 in resources/bin, FFMPEG_PATH |
| D-14 user-named workflow fixes | 15-09 | SATISFIED | Truth 32 |

Orphaned requirements: none. All 14 IDs are claimed by at least one plan.

Traceability note (info): REQUIREMENTS.md still lists **PLAT-02** ("accessible from other devices on the local network", Phase 1, Pending). D-12 deliberately drops LAN access. Mark PLAT-02 as superseded/descoped so traceability stays consistent.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (64 phase-touched source files) | n/a | TBD/FIXME/XXX/TODO/HACK scan | n/a | None found |
| packages/backend/src/services/{ffmpeg,thumbnail,waveform}.ts, workers/render-worker.ts | spawn sites | ffmpeg children not registered in childRegistry; Remotion renderMedia browser/compositor processes not tracked | WARNING | Harmless on the Windows quit path (taskkill /T reaps the whole backend tree). On the watchdog path (Electron crash/force-kill), shutdown() only reaps python/uv and terminates worker threads, so in-flight ffmpeg or Remotion headless-browser processes may be orphaned. This contradicts the 15-CONTEXT "no strays under any exit path". Covered by the human item below |
| packages/desktop/src/backend-process.ts | 125-131 | win32 skips the graceful signal and tree-kills immediately | INFO | Documented deviation. Node's kill() on Windows is TerminateProcess, so this is the correct way to meet "no stragglers" |
| packages/backend (CORS `origin: true`) | pre-existing | Unauthenticated local API | INFO | Noted in 15-06/15-07 threat flags; loopback-only bind limits exposure |

### Pre-existing Debt (not a Phase 15 regression)

- `packages/frontend/src/store/subtitleStore.test.ts`: 5 failing bulk-action tests (mergePhrases x2, deletePhrases x2, duplicatePhrase x1). They date from Phase 11 and are logged in `deferred-items.md`. Phase 15 did not touch subtitleStore.ts or its tests; the last commits on those files are pre-phase. The frontend suite is 78 pass / 5 fail at HEAD.

### Human Verification Required

#### 1. Orphan watchdog on crash / force-kill

**Test:** In the installed app, start a transcription. In Task Manager, end only the Eigen.exe main (browser) process with "End task", not "End process tree". Repeat while a render is in progress.
**Expected:** The backend child exits on its own within about 2-4s, and no python.exe, uv.exe, ffmpeg.exe or Remotion chrome-headless-shell/compositor processes from Eigen remain.
**Why human:** The approved UAT covered normal quit only, where Electron runs taskkill /T on the backend. The crash/force-kill exit path is a separate code path (PARENT_PID poll, then shutdown(), then killAll()) with no automated test, and the user explicitly asked for it ("no straggler processes under any exit path (quit, crash, force-kill)"). Static analysis shows ffmpeg and Remotion browser processes are not in childRegistry, so this path may leave strays. If it does, the fix is to register ffmpeg spawn pids and make the watchdog shutdown tree-kill the backend's own descendants, for example `treeKill(process.pid)` minus self, or tracking Remotion's browser via an explicit `openBrowser` instance.

### Gaps Summary

No blocking gaps. All 14 decisions (D-01 to D-14) are implemented, wired and, where they depend on behaviour, confirmed by the user-approved native Windows UAT:
- installer
- splash
- health gate
- settings
- first-run setup
- GPU transcription with diarization
- render and download
- clean quit
- single-instance
- the three D-14 timeline fixes

One truth stays present but behaviourally unverified: the D-03 orphan watchdog on the Electron crash/force-kill path. The code is present and correct in principle (I confirmed the ESRCH semantics on Windows). However, no test or UAT step exercised it, and ffmpeg/Remotion browser processes are outside the registry it reaps. One human check is requested. If it shows strays, it becomes a small gap-closure item.

Housekeeping (info, not gaps):
- In ROADMAP.md, the Phase 15 overview checkbox is still unchecked and a stale "- [ ] TBD (run /gsd-plan-phase 15 to break down)" line remains.
- The PLAT-02 traceability row conflicts with D-12.

---

_Verified: 2026-10-10T12:13:19Z_
_Verifier: Claude (gsd-verifier)_

## Resolution (2026-10-10)

The one item left unverified (crash/force-kill orphan watchdog, D-03) was closed by human UAT. See 15-UAT.md, status complete.

- **Mid-transcription force-kill:** the backend and its Python processes exited within 1s.
- **Mid-render force-kill:** all 23 descendant processes exited within 1s. These were the backend, ffmpeg, remotion.exe and 12 chrome-headless-shell processes.
- **Hardening:** 0d3927a makes the watchdog shutdown tree-kill the backend's own process tree.

That UAT also surfaced two gaps, both fixed (merge 716b054) and approved by the user:

- **A, crash recovery:** jobs are rebuilt from disk, so a project crashed mid-transcription restarts on open.
- **B/C, multiple media roots:** each project records its media root, so projects created before the storage folder changed get their thumbnail and video back. Projects whose media is truly missing are flagged with a Delete action.

Follow-ups are in deferred-items.md.

**Final status: passed. 33/33 must-haves.**
