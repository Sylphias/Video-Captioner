---
phase: 15-desktop-app-port
plan: 02
subsystem: infra
tags: [electron-prep, python-venv, ffmpeg, remotion, worker-threads, media-root]

requires:
  - phase: 15-01
    provides: childRegistry (registerChild/unregisterChild/killAll), DATA_ROOT/MEDIA_ROOT exports
provides:
  - Env-overridable Python venv path (VENV_PYTHON) with platform-aware default
  - Env-overridable FFmpeg/FFprobe paths (FFMPEG_PATH, FFPROBE_PATH) across all spawn sites
  - Packaged-mode prebuilt Remotion bundle branch (IS_PACKAGED, REMOTION_BUNDLE_DIR)
  - terminateActiveRenders() wired into shutdown
  - All per-job media paths routed through MEDIA_ROOT
affects: [15-03, 15-05, 15-08, desktop-shell, packaging]

actuals:
  tokens: 2200
  tasks: 4
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Env-injected binary paths with dev PATH/venv fallbacks"
    - "Module-level Set of live Worker threads terminated on shutdown"

key-files:
  created: []
  modified:
    - packages/backend/src/services/transcription.ts
    - packages/backend/src/services/diarization.ts
    - packages/backend/src/services/ffmpeg.ts
    - packages/backend/src/services/thumbnail.ts
    - packages/backend/src/services/waveform.ts
    - packages/backend/src/services/render.ts
    - packages/backend/src/workers/render-worker.ts
    - packages/backend/src/index.ts
    - packages/backend/src/routes/upload.ts
    - packages/backend/src/routes/transcribe.ts
    - packages/backend/src/routes/diarize.ts
    - packages/backend/src/routes/waveform.ts
    - packages/backend/src/routes/jobs.ts
    - packages/backend/src/routes/render.ts
    - packages/backend/src/routes/projects.ts

key-decisions:
  - "VENV_PYTHON default is platform-aware (win32 -> .venv/Scripts/python.exe, else .venv/bin/python3) so WSL dev keeps working"
  - "Render workers are in-process threads (threadId is not an OS pid), so they are tracked in a Worker Set and terminated via terminateActiveRenders(), not childRegistry"
  - "ffmpeg/ffprobe processes are not registered in childRegistry (plan scope: python + render only)"
  - "SQLite DBs (projects, lane_presets, presets) stay on DATA_ROOT; only per-job media moves to MEDIA_ROOT"

patterns-established:
  - "Backend external binaries: process.env.X ?? dev fallback; Electron main injects X at spawn"

requirements-completed: [D-07, D-13, D-04]

coverage:
  - id: D1
    description: "Python subprocesses use env-overridable VENV_PYTHON and register/unregister pids in childRegistry"
    requirement: "D-07"
    verification:
      - kind: other
        ref: "npx tsc -b packages/backend --force + grep acceptance checks (VENV_PYTHON, Scripts/python.exe, registerChild in both services)"
        status: pass
    human_judgment: false
  - id: D2
    description: "FFmpeg/FFprobe resolve from FFMPEG_PATH/FFPROBE_PATH with PATH fallback in ffmpeg, thumbnail, waveform, render-worker"
    requirement: "D-13"
    verification:
      - kind: other
        ref: "tsc + grep acceptance checks; no bare spawn('ffmpeg' left in render-worker"
        status: pass
    human_judgment: false
  - id: D3
    description: "IS_PACKAGED=1 skips bundle() and uses REMOTION_BUNDLE_DIR, failing fast when missing; terminateActiveRenders wired into shutdown"
    requirement: "D-04"
    verification:
      - kind: other
        ref: "smoke: IS_PACKAGED=1 with no REMOTION_BUNDLE_DIR aborts startup with 'Packaged app missing its prebuilt Remotion bundle'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Per-job media paths use MEDIA_ROOT; DBs stay on DATA_ROOT"
    requirement: "D-11"
    verification:
      - kind: other
        ref: "tsc + smoke boot with distinct DATA_ROOT/MEDIA_ROOT: /api/health ok, 3 SQLite DBs created under DATA_ROOT only, jobs 404 path works"
        status: pass
    human_judgment: false
  - id: D5
    description: "Behavior on native Windows (Scripts/python.exe layout, bundled ffmpeg.exe, asar-packaged prebuilt bundle, worker termination)"
    verification: []
    human_judgment: true
    rationale: "Executed under WSL Linux; Windows runtime and packaged Electron cannot be verified here"

duration: 10min
completed: 2026-10-08
status: complete
---

# Phase 15 Plan 02: Backend External-Binary Parameterization Summary

**Python venv, FFmpeg/FFprobe, and Remotion bundle location are now env-injected with dev fallbacks; python pids and render worker threads are cleanup-tracked, and all per-job media paths follow MEDIA_ROOT**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-10-08
- **Tasks:** 4 (3 plan + 1 orchestrator-requested)
- **Files modified:** 15

## Accomplishments
- `transcription.ts` / `diarization.ts`: `VENV_PYTHON` env override; default `.venv/Scripts/python.exe` on win32; spawned pids registered in `childRegistry` and unregistered on close; error hint now points at `just setup-python-windows`.
- `ffmpeg.ts`, `thumbnail.ts`, `waveform.ts`, `render-worker.ts`: `FFMPEG_PATH` / `FFPROBE_PATH` with PATH fallback; module-load check message mentions the bundled path.
- `render.ts`: `initBundle()` uses `REMOTION_BUNDLE_DIR` when `IS_PACKAGED === '1'` (no webpack), erroring clearly if absent; live Workers tracked, `terminateActiveRenders()` exported and called from `index.ts` shutdown before `killAll`.
- MEDIA_ROOT migration (orchestrator-requested): every job-dir/normalized/output/thumbnail/transcript/waveform/upload/project-delete path now uses `MEDIA_ROOT`.

## Task Commits

1. **Task 1: venv Python path + childRegistry wiring** - `1ca8299` (feat)
2. **Task 2: FFmpeg/FFprobe env paths** - `331252f` (feat)
3. **Task 3: prebuilt Remotion bundle + render worker termination** - `b86e99f` (feat)
4. **Task 4 (orchestrator-added): route job media via MEDIA_ROOT** - `964f21e` (refactor)

## Decisions Made
See key-decisions in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Platform-aware VENV_PYTHON default**
- **Found during:** Task 1
- **Issue:** Plan specified a hard `.venv/Scripts/python.exe` default; on WSL/Linux that breaks transcription and diarization under `just dev`, which project notes require to keep working.
- **Fix:** Default is `.venv/Scripts/python.exe` on `process.platform === 'win32'`, `.venv/bin/python3` otherwise. `process.env.VENV_PYTHON` still wins. All plan grep checks (`process.env.VENV_PYTHON`, `Scripts/python.exe`) still pass.
- **Files modified:** transcription.ts, diarization.ts
- **Commit:** 1ca8299

**2. [Rule 3 - Blocking/wiring] terminateActiveRenders() actually called from shutdown**
- **Found during:** Task 3
- **Issue:** Plan asks for the export to be "wired to be callable from shutdown"; adding an unused export would leave T-15-21 unmitigated.
- **Fix:** `index.ts` imports and calls it in `shutdown()` before `killAll`. (index.ts was not in the plan's `files_modified`.)
- **Commit:** b86e99f

**3. [Orchestrator-requested] MEDIA_ROOT consumer migration**
- **Found during:** orchestrator review of 15-01 (MEDIA_ROOT exported but unused, so D-11 would have had no effect).
- **Fix:** Replaced `DATA_ROOT` with `MEDIA_ROOT` in routes/upload.ts, transcribe.ts, diarize.ts, waveform.ts, jobs.ts (3 sites), render.ts (3 sites), projects.ts. Grep for other job-path joins found none beyond a stale comment in services/render.ts (updated). projectStore/lanePresets/animationPresets stay on DATA_ROOT. Import-cycle check: routes already imported from `../index.ts` before this change and read the binding only inside handlers, so the cycle is unchanged and no new import edges were added.
- **Verification:** `npx tsc -b packages/backend --force` passes; booted backend with distinct `DATA_ROOT`/`MEDIA_ROOT`: health OK, all three `.db` files created under DATA_ROOT only. In dev MEDIA_ROOT defaults to DATA_ROOT so behavior is unchanged.
- **Commit:** 964f21e

**Total deviations:** 2 auto-fixed + 1 orchestrator-requested. **Impact:** None on scope; dev behavior preserved.

## Issues Encountered
- Source files are CRLF; edits were made preserving line endings so diffs stay minimal.
- Remotion's own bundled compositor ffmpeg inside `renderMedia` is unaffected by `FFMPEG_PATH`; only the repo's own spawn sites (audio mux etc.) use it.

## Known Stubs

None.

## Threat Flags

None - no new network/auth surface; env-injected paths covered by T-15-22 (accepted).

## Human Verification Needed (deferred)
- On native Windows: confirm `.venv/Scripts/python.exe` spawn, bundled `ffmpeg.exe` via `FFMPEG_PATH`, prebuilt Remotion bundle loading from packaged resources (`IS_PACKAGED=1` + `REMOTION_BUNDLE_DIR`), and that quitting kills render workers and python children. Not testable in WSL.
- Not exercised: a full dev render/transcription run (only tsc, startup, health and fail-fast smoke were run).

## Next Phase Readiness
- Plan 05 (Electron main) must inject `VENV_PYTHON`, `FFMPEG_PATH`, `FFPROBE_PATH`, `IS_PACKAGED=1`, `REMOTION_BUNDLE_DIR`, `MEDIA_ROOT`.
- Plan 08 must ship the prebuilt Remotion bundle at the path given by `REMOTION_BUNDLE_DIR`.

## Self-Check: PASSED

- FOUND commits: 1ca8299, 331252f, b86e99f, 964f21e
- `npx tsc -b packages/backend --force` exits 0 after final commit; all task grep checks re-run green.
