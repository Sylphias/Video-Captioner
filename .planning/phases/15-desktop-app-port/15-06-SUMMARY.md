---
phase: 15-desktop-app-port
plan: 06
subsystem: infra
tags: [uv, python-venv, sse, first-run-setup, fastify, react]

requires:
  - phase: 15-01
    provides: childRegistry (registerChild/unregisterChild/killAll), env-driven backend config
  - phase: 15-02
    provides: VENV_PYTHON env parameterization
  - phase: 15-03
    provides: justfile setup-python-windows recipe (canonical uv sequence)
provides:
  - venvExists() / provisionVenv() uv-based venv provisioning service
  - GET /api/setup/status, POST /api/setup/start (SSE), POST /api/setup/cancel
  - FirstRunSetup full-page screen + useSetup hook gating App launch
affects: [15-08, 15-09, desktop-shell]

actuals:
  tokens: 11500
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Private uv cache beside the venv: measurable download progress + disk reclaimed on success"
    - "Incomplete-marker sibling file so a half-built venv is never reported ready"
    - "SSE over fetch (POST) with a pure, testable frame parser"

key-files:
  created:
    - packages/backend/src/services/pythonEnv.ts
    - packages/backend/src/routes/setup.ts
    - packages/frontend/src/components/FirstRunSetup.tsx
    - packages/frontend/src/components/FirstRunSetup.css
    - packages/frontend/src/hooks/useSetup.ts
    - packages/frontend/src/hooks/useSetup.test.ts
  modified:
    - packages/backend/src/index.ts
    - packages/frontend/src/App.tsx

key-decisions:
  - "Progress percent = bytes written to a private UV_CACHE_DIR / ~6GiB (uv prints no download lines when not on a TTY, so stdout scraping alone yields only Resolved/Prepared/Installed)"
  - "venvExists() = interpreter present AND no <venv>.setup-incomplete marker; dev venvs created by just recipes (no marker) still report ready"
  - "Cancel and failure both delete the partial venv; cancel also deletes the uv cache (discard), failure keeps it so Retry resumes quickly"
  - "uv venv pinned with --python 3.12 so uv never picks a too-new interpreter on a fresh machine"
  - "If /api/setup/status is unreachable the frontend falls through to the editor rather than blocking behind a screen it cannot drive"

patterns-established:
  - "Single in-flight setup run; later POST /start calls attach as extra SSE listeners; 5s grace after the last listener leaves before uv is killed"

requirements-completed: [D-07, D-08]

coverage:
  - id: D1
    description: "Backend reports venv readiness and provisions it via uv (venv, torch cu128, whisperx/pyannote/nvidia-cudnn/cublas) mirroring setup-python-windows, streaming SSE progress"
    requirement: "D-08"
    verification:
      - kind: other
        ref: "tsc -b packages/backend --force + grep acceptance checks; node smoke via real uv: venv step then torch download streamed percent 0->23% over 20s"
        status: pass
    human_judgment: false
  - id: D2
    description: "Failure/cancel are clean: bad uv path rejects with actionable message and leaves venvExists false; cancel kills the uv tree and removes venv, cache and marker"
    requirement: "D-08"
    verification:
      - kind: other
        ref: "smoke: UV_PATH=nonexistent -> 'Failed to spawn uv', marker kept; cancel at 20s -> SetupCancelledError, no venv/cache/marker, no uv.exe left"
        status: pass
    human_judgment: false
  - id: D3
    description: "HTTP layer: status, start SSE, second start attaches to same run, cancel endpoint emits terminal cancelled event"
    requirement: "D-08"
    verification:
      - kind: other
        ref: "route smoke on 127.0.0.1:3077 with real uv (setupRoutes only)"
        status: pass
    human_judgment: false
  - id: D4
    description: "FirstRunSetup UI renders UI-SPEC copy/CTAs/progress/error/retry/cancel-confirm and App gates on it"
    requirement: "D-08"
    verification:
      - kind: other
        ref: "npm run build --workspace packages/frontend exit 0 + grep acceptance checks; SSE parser exercised via node strip-types script"
        status: pass
    human_judgment: true
    rationale: "Visual fidelity and the real end-to-end 5-6GB flow in the Electron window are not exercised here (Plan 09)"

duration: 40min
completed: 2026-10-09
status: complete
---

# Phase 15 Plan 06: First-Run Python Environment Setup Summary

**In-app first-run provisioning: backend runs the verified uv recipe (venv, cu128 torch, whisperx/pyannote + CUDA libs) with cache-growth-based SSE progress, and a full-page FirstRunSetup screen with retry and confirmed cancel gates the app until the venv exists**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-10-09
- **Tasks:** 2 (plus one follow-up fix commit)
- **Files:** 6 created, 2 modified

## Accomplishments
- `pythonEnv.ts`: `venvExists()`, `provisionVenv(onProgress)` returning `{ promise, process (getter), cancel() }`. Steps come from `buildSteps()`: `uv venv <root> --python 3.12`; `uv pip install torch/torchaudio >=2.8,<2.9 --index-url .../cu128` (no index on macOS); `uv pip install whisperx pyannote-audio>=4.0.4` plus `nvidia-cudnn-cu12 nvidia-cublas-cu12` on win32. uv comes from `UV_PATH ?? 'uv'`; every pid is registered with `childRegistry`; errors carry the last 500 chars of stderr.
- `routes/setup.ts`: `GET /api/setup/status` -> `{ready, running}`, `POST /api/setup/start` (hijacked SSE, `progress | done | error | cancelled` events), `POST /api/setup/cancel`. One in-flight run; extra starts attach to it; last listener leaving triggers cancel after a 5s grace.
- `useSetup` / `FirstRunSetup` / `App`: status check on mount (re-attaches if a run is already in flight), UI-SPEC copy, accent-border CTA, reused `subtitles-page__progress-track/fill` (indeterminate looping fill for "Installing dependencies…"), `Setup failed: {reason}. Check your internet connection and available disk space.` + "Retry Setup", and "Cancel Setup?" confirm reusing `delete-confirm-*` chrome (danger confirm "Cancel Setup", keep "Continue Setup", Escape closes). App renders nothing while checking and the setup screen instead of Header+pages until ready.

## Task Commits

1. **Task 1: pythonEnv service + /api/setup routes** - `9a3002e` (feat)
   - follow-up: `f23c244` (fix) 5s disconnect grace so a reloaded window can re-attach
2. **Task 2: FirstRunSetup + useSetup + App gate** - `f2c752c` (feat)

## Verification Results
- `npx tsc -b packages/backend --force`: exit 0 (after both backend commits). Task 1 grep checks: pass.
- `npm run build --workspace packages/frontend` (after building shared-types/remotion-composition libs): exit 0. Task 2 grep checks: pass.
- Smoke with the real uv 0.12.6 against a temp venv location (no full provisioning):
  - bad `UV_PATH` -> rejects `Failed to spawn uv (nonexistent-uv): spawn ... ENOENT`, `venvExists()` false, marker retained.
  - `cancel()` 20s into the torch download -> progress streamed 0,1,6,10,13,17,21,23%; promise rejects `SetupCancelledError`; venv dir, uv cache and marker all gone; no `uv.exe` left running.
  - HTTP smoke (Fastify with only `setupRoutes` on 127.0.0.1): status `{ready:false,running:false}` -> start 200 `text/event-stream` with `: connected` then progress events -> status `running:true` -> second start immediately received the current progress (attach works) -> `/cancel` `{cancelled:true}` -> first stream received `{"type":"cancelled"}` and ended -> status `running:false`.
  - SSE frame parser (`parseSseBuffer`) checked via a node script: multi-frame, partial remainder, malformed JSON.

## Deviations from Plan

### Auto-fixed / added items

**1. [Rule 2 - Missing critical] Incomplete marker so partial venvs are not "ready"**
- `uv venv` creates `python.exe` immediately, so a naive `venvExists()` would report ready after a cancel/failure and drop the user into a broken editor. Added `<venv>.setup-incomplete` marker (written before provisioning, removed on success).

**2. [Rule 2] Added `POST /api/setup/cancel` (not in the plan's artifact list)**
- Gives the UI an explicit cancel independent of stream-abort semantics. Disconnect-kills-process is still implemented (with grace) per the plan/T-15-62.

**3. [Design] Progress source is cache-byte growth, not stdout scraping**
- Verified that uv prints no per-download lines without a TTY (only Resolved/Prepared/Installed). A private `UV_CACHE_DIR` (`<venv>.uv-cache`) is polled every 1.5s and divided by an assumed ~6GiB (capped at 97%); the final step's `Prepared N packages` line flips to the indeterminate "Installing dependencies…" phase. The ~6GiB denominator is a guess to calibrate in Plan 09.

**4. [Design] `uv venv --python 3.12`** added (recipe uses bare `uv venv`) so a fresh machine cannot resolve a too-new system Python; uv fetches a managed 3.12 if none is present.

**5. [Design] `hf_xet` NOT added.** The 15-04 observation suggested it, but it is outside the audited/verified package set (T-15-61: fixed recipe only). Left for a deliberate follow-up.

**6. [Design] Frontend falls through to the editor if `/api/setup/status` is unreachable** rather than blocking.

**7. [Env] Frontend vitest could not run locally**: the worktree's `rolldown` native binding (`@rolldown/binding-win32-x64-msvc`) is missing from the Linux-authored lockfile install. I did not install packages to work around it; `useSetup.test.ts` is committed but was verified via an equivalent node script instead. The production `vite build` works.

## Known Stubs
None.

## Threat Flags
None beyond the plan's threat model. Mitigations: fixed package list (T-15-61/SC), single in-flight guard plus disconnect/cancel kill (T-15-62), loopback bind inherited from Plan 01 (T-15-63). Note the API still has `origin: true` CORS (pre-existing), so a hostile local web page could trigger `POST /api/setup/start`; impact is limited to the fixed install recipe.

## Human Verification Needed (deferred to Plan 09)
- Full real provisioning on the packaged app with bundled `UV_PATH`: check the percent curve (denominator calibration), the "Installing dependencies…" transition, and that the `.uv-cache` is removed afterwards.
- Visual check of the FirstRunSetup card/cancel dialog in the Electron window.
- Run `npm test --workspace packages/frontend` on a machine with a working rolldown binding to execute `useSetup.test.ts`.

## Self-Check: PASSED
- FOUND: pythonEnv.ts, setup.ts, FirstRunSetup.tsx/.css, useSetup.ts, useSetup.test.ts
- FOUND commits: 9a3002e, f23c244, f2c752c
