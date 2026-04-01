---
phase: 13-project-persistence-and-landing-page
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, fastify, crud, rest-api]

# Dependency graph
requires:
  - phase: 07-text-animation-creator
    provides: better-sqlite3 plugin pattern (animationPresetsPlugin, lanePresetsPlugin)
provides:
  - ProjectRecord shared type in shared-types
  - projectStore.ts SQLite plugin with projects table and projectsDb Fastify decorator
  - 7 REST API routes for project CRUD and thumbnail serving
  - Reference-counting delete that protects shared job directories
affects:
  - 13-02: landing page and project list UI (consumes all routes built here)
  - 13-03: nav restructure (needs project context awareness)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SQLite WAL plugin with fp() decorator registration (existing pattern extended)
    - Row mapper function (snake_case DB columns -> camelCase API response)
    - Reference-count guard on DELETE to protect shared job directory data

key-files:
  created:
    - packages/shared-types/src/index.ts (ProjectRecord interface added at end)
    - packages/backend/src/services/projectStore.ts
    - packages/backend/src/routes/projects.ts
  modified:
    - packages/backend/src/index.ts (imports + plugin/route registrations)

key-decisions:
  - "projectsDb decorator registered as separate SQLite instance (projects.db) — avoids collision with fastify.db (presets) and fastify.lanePresetsDb"
  - "GET /api/projects omits stateJson from list response — stateJson can be large; detail endpoint provides full record"
  - "DELETE uses countByJobIdStmt reference count — duplicate projects share jobId; only delete files when last project referencing that jobId is deleted"
  - "POST /api/projects/:id/duplicate shares jobId with original — no file copy needed, just a new project record"

patterns-established:
  - "SQLite plugin pattern: new Database(dbPath), pragma WAL, db.exec CREATE TABLE IF NOT EXISTS, fastify.decorate, addHook onClose, export default fp(plugin)"
  - "Route plugin pattern: fp()-wrapped async function, prepared statements bound at plugin init time, rowToMapper for DB->API shape conversion"

requirements-completed: [D-04, D-05, D-11, D-12, D-14, D-15, D-16, D-17]

# Metrics
duration: 2min
completed: 2026-04-01
---

# Phase 13 Plan 01: Backend Project Persistence Summary

**SQLite projects.db with 7 REST API routes (full CRUD, duplicate, thumbnail), reference-counting delete, and ProjectRecord shared type**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T12:41:55Z
- **Completed:** 2026-04-01T12:43:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `ProjectRecord` interface added to `shared-types/src/index.ts` with all fields needed for project list cards and state persistence
- `projectStore.ts` Fastify plugin creates `projects.db` with WAL mode and `projectsDb` decorator (separate from `fastify.db` and `fastify.lanePresetsDb`)
- 7 API routes covering full project lifecycle: list (no heavy stateJson), get-by-id (full), create, update, delete (with reference counting), duplicate (shared jobId), and thumbnail serving

## Task Commits

1. **Task 1: Shared type + SQLite project store plugin** - `9487c13` (feat)
2. **Task 2: CRUD routes + thumbnail endpoint + registration** - `80902c1` (feat)

## Files Created/Modified

- `packages/shared-types/src/index.ts` - Added `ProjectRecord` interface at end of file
- `packages/backend/src/services/projectStore.ts` - New SQLite plugin with WAL mode, projects table, `projectsDb` decorator
- `packages/backend/src/routes/projects.ts` - 7 API routes with row mapper and reference-count delete guard
- `packages/backend/src/index.ts` - Added imports and registrations for plugin and routes

## Decisions Made

- `GET /api/projects` omits `stateJson` from list response (large field, only needed in detail view)
- Reference counting via `countByJobIdStmt` in DELETE: only deletes job directory files when the last project for that `jobId` is removed (duplicate projects share same job data)
- `POST /api/projects/:id/duplicate` creates a new project record with shared `jobId` — no file duplication needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 7 endpoints ready for Plan 13-02 (landing page and project list UI)
- `ProjectRecord` type exported from shared-types and available to frontend
- `GET /api/jobs/:jobId/thumbnail` enables thumbnail display in project cards
- `POST /api/projects/:id/duplicate` supports project duplication from the UI

---
*Phase: 13-project-persistence-and-landing-page*
*Completed: 2026-04-01*
