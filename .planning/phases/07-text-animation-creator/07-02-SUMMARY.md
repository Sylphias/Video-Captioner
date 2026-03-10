---
phase: 07-text-animation-creator
plan: 02
subsystem: database
tags: [sqlite, better-sqlite3, fastify, crud, presets]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Fastify server with plugin pattern (fp()), DATA_ROOT export, route conventions
provides:
  - SQLite animation_presets table with WAL mode
  - 7 seeded built-in animation presets
  - /api/presets CRUD API (GET, POST, PUT, DELETE, POST duplicate)
  - fastify.db decorator available to all route plugins
affects:
  - 07-03 (frontend preset picker will consume GET /api/presets)
  - 07-04 (preset selection in animation application)
  - 07-05 (render integration uses stored preset params)

# Tech tracking
tech-stack:
  added: [better-sqlite3, @types/better-sqlite3]
  patterns:
    - Fastify plugin with fp() decorator pattern for SQLite db access
    - Prepared statements for all DB queries (better-sqlite3 best practice)
    - Idempotent built-in seeding — checks existence before insert, safe to run on every startup
    - WAL journal mode for improved read concurrency

key-files:
  created:
    - packages/backend/src/services/animationPresets.ts
    - packages/backend/src/routes/presets.ts
  modified:
    - packages/backend/src/index.ts
    - packages/backend/package.json

key-decisions:
  - "better-sqlite3 requires Node 20+ — use nvm to switch from system Node 18 (set in .nvmrc as 22)"
  - "fastify.db decorated by animationPresetsPlugin registered before presetsRoutes — ensures DB available to route handlers"
  - "Built-in preset IDs are deterministic strings (builtin-xxx) — simplifies protection logic (no flag needed, pattern sufficient, but is_builtin=1 used for explicitness)"
  - "Seeding uses staggered timestamps (now - N*1000ms) so ORDER BY created_at ASC keeps built-ins at top of list"
  - "PUT /api/presets/:id merges provided fields into existing params JSON — partial updates supported without full replacement"

patterns-established:
  - "Preset plugin pattern: SQLite plugin registers before route plugins; routes access db via fastify.db"
  - "Row mapper function (rowToPreset) converts DB row shape to API response shape — single source of truth for field naming (is_builtin -> isBuiltin, created_at -> createdAt)"
  - "Built-in protection: fetch row first, check is_builtin, return 403 with descriptive error before any mutation"

# Metrics
duration: 7min
completed: 2026-03-10
---

# Phase 7 Plan 02: Preset Backend — SQLite CRUD API Summary

**SQLite animation preset storage with better-sqlite3, 7 seeded built-ins, and full CRUD REST API at /api/presets with built-in protection**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-10T14:57:22Z
- **Completed:** 2026-03-10T15:04:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- Installed better-sqlite3 native SQLite library with Node 22 (node-gyp requires Node 20+)
- Created animationPresets Fastify plugin: WAL SQLite at data/presets.db, animation_presets table, fastify.db decorator, onClose hook, 7 built-in preset seeding
- Created presetsRoutes with 5 endpoints: GET (list), POST (create), PUT (update), DELETE (remove), POST duplicate
- Built-in presets protected from modification/deletion with 403 responses
- Presets persist across server restarts (verified via restart test)
- Server registers plugin + routes without errors; 7 built-in presets seeded on first run

## Task Commits

Each task was committed atomically:

1. **Task 1: Install better-sqlite3 and create animation presets Fastify plugin** - `eae1f9b` (feat)
2. **Task 2: Create preset CRUD routes and register in server** - `7cbd9c5` (feat)

**Plan metadata:** (see final commit below)

## Files Created/Modified
- `packages/backend/src/services/animationPresets.ts` - Fastify plugin: opens presets.db with WAL mode, creates table, decorates fastify.db, seeds 7 built-in presets
- `packages/backend/src/routes/presets.ts` - 5 CRUD endpoints using prepared statements, rowToPreset mapper, built-in protection
- `packages/backend/src/index.ts` - Registers animationPresetsPlugin + presetsRoutes
- `packages/backend/package.json` - Added better-sqlite3 + @types/better-sqlite3

## Decisions Made
- Used better-sqlite3 (synchronous SQLite) rather than async alternatives — matches plan's locked decision; synchronous API simplifies route handlers (no async DB calls needed)
- Staggered timestamps on built-in seeding (now - N*1000ms) ensures ORDER BY created_at ASC keeps built-ins sorted before user presets
- PUT endpoint merges provided fields against existing params JSON (partial update) — user doesn't need to resend the full preset to rename it
- Node 22 required for better-sqlite3 native addon — used nvm to switch; project .nvmrc already pins v22

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Node version mismatch blocked better-sqlite3 install**
- **Found during:** Task 1 (npm install better-sqlite3)
- **Issue:** Shell was running Node 18.12.1; better-sqlite3 requires Node 20+ and its native addon requires node-gyp which failed due to Python `distutils` not available in Python 3.12+ on macOS
- **Fix:** Ran `source ~/.nvm/nvm.sh && nvm use 22` to switch to Node 22 (already pinned in .nvmrc); re-ran npm install — succeeded
- **Files modified:** None (environment fix only)
- **Verification:** `node -e "require('better-sqlite3')"` succeeded after switch
- **Committed in:** eae1f9b (Task 1 commit — package.json includes the installed dependency)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Environment issue, not code issue. Fix was switching to correct Node version already specified in .nvmrc. No scope creep.

## Issues Encountered
- Port 3001 was in use (existing dev server running) during verification — killed existing process, verified new server starts and registers all routes correctly

## User Setup Required
None - no external service configuration required. SQLite file created automatically at data/presets.db on first server start.

## Next Phase Readiness
- /api/presets fully operational — ready for frontend preset picker (Plan 03)
- 7 built-in presets seeded: Classic Fade, Slide Up, Pop In, Word Cascade, Typewriter, Blur Reveal, Jiggle Pop
- fastify.db decorator available to any future route plugins that need SQLite access
- data/presets.db exists at repo root data/ directory

## Self-Check: PASSED

- packages/backend/src/services/animationPresets.ts: FOUND
- packages/backend/src/routes/presets.ts: FOUND
- data/presets.db: FOUND
- commit eae1f9b: FOUND
- commit 7cbd9c5: FOUND

---
*Phase: 07-text-animation-creator*
*Completed: 2026-03-10*
