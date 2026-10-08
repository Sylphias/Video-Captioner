---
phase: 15-desktop-app-port
plan: 01
subsystem: infra
tags: [fastify, fastify-static, tree-kill, electron-prep, process-lifecycle]

requires: []
provides:
  - Env-overridable backend runtime config (DATA_ROOT, MEDIA_ROOT, PORT, HOST, FRONTEND_DIST, PARENT_PID)
  - Backend serves the Vite-built SPA at / with SPA fallback when a dist exists
  - childRegistry service (registerChild / unregisterChild / killAll) for tree-kill cleanup
  - SIGTERM/SIGINT graceful shutdown and parent-PID orphan watchdog
affects: [15-02, 15-05, desktop-shell, transcription, diarization, render]

actuals:
  tokens: 2500
  tasks: 3
  commits: 3

tech-stack:
  added: [tree-kill@1.2.2]
  patterns:
    - "Env-driven config with dev-mode fallbacks (process.env.X ?? repo-relative default)"
    - "Central child-process registry reaped via tree-kill on shutdown"

key-files:
  created:
    - packages/backend/src/services/childRegistry.ts
  modified:
    - packages/backend/src/index.ts
    - packages/backend/package.json
    - package-lock.json

key-decisions:
  - "MEDIA_ROOT defaults to DATA_ROOT so dev behavior is unchanged; consumers still read DATA_ROOT (Plan 02+ redirects heavy media)"
  - "Static root registered only if dist exists (existsSync) so just dev is unaffected"
  - "Watchdog treats only ESRCH as parent-gone (EPERM means alive); interval is unref'd"

patterns-established:
  - "Spawned descendants register their pid with childRegistry; shutdown calls killAll('SIGKILL') then fastify.close()"

requirements-completed: [D-03, D-04, D-11, D-12]

coverage:
  - id: D1
    description: "Backend binds 127.0.0.1 by default and reads DATA_ROOT/MEDIA_ROOT/PORT/HOST from env with dev fallbacks"
    requirement: "D-11"
    verification:
      - kind: other
        ref: "npx tsc -b packages/backend --force + grep acceptance checks; smoke: ss -ltn shows 127.0.0.1:3055"
        status: pass
    human_judgment: false
  - id: D2
    description: "Backend serves built frontend at / via @fastify/static with SPA fallback; /api 404s intact"
    requirement: "D-04"
    verification:
      - kind: other
        ref: "curl smoke on PORT=3055: / 200, /some/route 200, /api/nope 404 JSON, asset 200, /api/health ok"
        status: pass
    human_judgment: false
  - id: D3
    description: "SIGTERM/SIGINT tree-kills tracked children then closes Fastify; parent-death watchdog self-exits"
    requirement: "D-03"
    verification:
      - kind: other
        ref: "smoke: SIGTERM and SIGINT exit cleanly; PARENT_PID watchdog self-exits ~2s after parent death; killAll removes sh+grandchild sleeps"
        status: pass
    human_judgment: false
  - id: D4
    description: "Behavior on native Windows (taskkill /T /F semantics, Electron-spawned backend)"
    verification: []
    human_judgment: true
    rationale: "Executed under WSL Linux; Windows tree-kill path and Electron integration cannot be verified here"

duration: 12min
completed: 2026-10-08
status: complete
---

# Phase 15 Plan 01: Backend Electron-Hosting Foundation Summary

**Fastify backend made env-configurable (data/media root, port, localhost-only host), serves the built SPA via @fastify/static, and reaps its full process tree via a tree-kill child registry on SIGTERM/SIGINT or parent death**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-10-08T05:43Z
- **Tasks:** 3
- **Files modified:** 4 (1 created)

## Accomplishments
- `DATA_ROOT`/`MEDIA_ROOT`/`PORT`/`HOST` come from env with dev fallbacks; default bind is `127.0.0.1` and the stale LAN (PLAT-02) comment/`0.0.0.0` are gone.
- Frontend dist (default `packages/frontend/dist`, override `FRONTEND_DIST`) is served at `/` when present, with index.html fallback for non-`/api` GETs.
- `childRegistry.ts` provides `registerChild`, `unregisterChild`, `killAll(signal)`; shutdown handlers and a `PARENT_PID` watchdog call it, then `fastify.close()`, then exit (re-entry guarded).

## Task Commits

1. **Task 1: Env-overridable runtime config** - `3358356` (feat)
2. **Task 2: Serve built frontend via @fastify/static** - `871e07c` (feat)
3. **Task 3: Child registry, tree-kill shutdown, orphan watchdog** - `816c0e3` (feat)

**Plan metadata:** see docs(15-01) commit following this summary.

## Files Created/Modified
- `packages/backend/src/index.ts` - env config, static serving + SPA fallback, shutdown handlers, watchdog
- `packages/backend/src/services/childRegistry.ts` - pid Set + tree-kill-backed `killAll`
- `packages/backend/package.json`, `package-lock.json` - `tree-kill` 1.2.2 (exact pin)

## Decisions Made
- `MEDIA_ROOT` defaults to `DATA_ROOT`; nothing consumes `MEDIA_ROOT` yet (plan said not to change consumers) - a later plan must move uploads/renders/thumbnails/job dirs onto it.
- Watchdog only reacts to `ESRCH`; `.unref()` so it never holds the process open.

## Deviations from Plan

None - plan executed exactly as written. (tree-kill was installed with `--save-exact` to match the plan's `@1.2.2` pin; it was the audited package from RESEARCH.)

## Issues Encountered
- Nothing registers pids into `childRegistry` yet (that is Plan 02), so end-to-end "python/ffmpeg are killed on quit" is only verified at registry level (a registered `sh` with two `sleep` grandchildren was fully reaped).
- `frontend/dist` exists locally, so static serving is also active under `just backend` on this machine; harmless (Vite on 5173 still proxies `/api`).

## Known Stubs

None.

## Threat Flags

None - new surface (static file serving) is covered by T-15-03; bind address reduction covered by T-15-02.

## User Setup Required

None - no external service configuration required.

## Human Verification Needed (deferred)
- On native Windows: confirm `taskkill /T /F` reaping and the PARENT_PID watchdog with a real Electron parent (Plan 05 / phase verification). Not testable in WSL.

## Next Phase Readiness
- Plan 02 can register spawned python/ffmpeg/render-worker pids into `childRegistry` and migrate job/media paths onto `MEDIA_ROOT`.
- Plan 05 (Electron shell) can pass `DATA_ROOT`, `MEDIA_ROOT`, `PORT`, `HOST`, `PARENT_PID`, `FRONTEND_DIST` at spawn and health-gate on `/api/health`.

## Self-Check: PASSED

- FOUND: packages/backend/src/services/childRegistry.ts
- FOUND commits: 3358356, 871e07c, 816c0e3
- All task acceptance/verify commands re-run green (`npx tsc -b packages/backend --force` exit 0).

---
*Phase: 15-desktop-app-port*
*Completed: 2026-10-08*
