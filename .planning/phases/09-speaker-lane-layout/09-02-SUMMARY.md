---
phase: 09-speaker-lane-layout
plan: 02
subsystem: api
tags: [sqlite, better-sqlite3, fastify, crud, rest-api]

# Dependency graph
requires:
  - phase: 07-text-animation-creator
    provides: animationPresets.ts and presetsRoutes.ts patterns that lane presets mirror exactly
provides:
  - SQLite-backed lane preset CRUD at /api/lane-presets (GET, POST, PUT, DELETE)
  - fastify.lanePresetsDb decorator via lanePresetsPlugin
  - lane_presets.db separate from presets.db (avoids decorator collision)
affects:
  - 09-03 (frontend lane preset picker will consume /api/lane-presets endpoints)

# Tech tracking
tech-stack:
  added: []
  patterns: [fastify-plugin decorator pattern for new SQLite DB (lanePresetsDb vs db)]

key-files:
  created:
    - packages/backend/src/services/lanePresets.ts
    - packages/backend/src/routes/lanePresets.ts
  modified:
    - packages/backend/src/index.ts

key-decisions:
  - "lane_presets.db separate SQLite file (not same as presets.db) — avoids fastify.db decorator collision"
  - "No built-in lane presets — all user-created (unlike animation presets which seed built-ins)"
  - "DELETE returns 204 (no body) matching REST convention; animation presets route returns 200 {ok:true}"
  - "PUT replaces entire layout JSON when layout provided — no partial-layout merging needed given flat structure"

patterns-established:
  - "New SQLite plugin: separate .db file + fastify.decorate with unique name + fp() wrapping"

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 9 Plan 02: Lane Presets Backend Summary

**SQLite-backed lane preset CRUD (GET/POST/PUT/DELETE at /api/lane-presets) storing speaker lane positions, overlap gap, and max visible rows as JSON, following animationPresets plugin pattern with a dedicated lane_presets.db**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-25T08:01:45Z
- **Completed:** 2026-03-25T08:06:50Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Created `lanePresetsPlugin` — opens `lane_presets.db` with WAL mode, creates `lane_presets` table, decorates `fastify.lanePresetsDb`
- Created `lanePresetsRoutes` — four REST endpoints mirroring the animation presets pattern, layout stored as JSON
- Registered both plugin and routes in `index.ts` after `animationPresetsPlugin`

## Task Commits

Each task was committed atomically:

1. **Task 1: Lane presets SQLite plugin and CRUD routes** - `ce2af22` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/backend/src/services/lanePresets.ts` - Fastify plugin: WAL SQLite, lane_presets table, fastify.lanePresetsDb decorator
- `packages/backend/src/routes/lanePresets.ts` - CRUD routes: GET all, POST create, PUT update, DELETE 204
- `packages/backend/src/index.ts` - Import and register lanePresetsPlugin + lanePresetsRoutes

## Decisions Made
- `lane_presets.db` stored as a separate SQLite file from `presets.db` — `fastify.db` is already taken by animationPresets; using a distinct decorator name `lanePresetsDb` avoids any conflict
- No built-in presets — lane layouts are entirely user-defined; no need for seeding logic unlike animation presets
- DELETE returns 204 (empty body) aligning with REST conventions for delete operations
- PUT replaces the entire `layout` JSON field when provided — the flat structure (speakerLanes, overlapGap, maxVisibleRows) has no partial update use case

## Deviations from Plan
None — plan executed exactly as written.

## Issues Encountered
None - TypeScript compiled cleanly (`npx tsc --project packages/backend/tsconfig.json --noEmit`). All four endpoints verified live against the running backend.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend lane preset API fully operational and verified
- Frontend can now build a lane preset picker that calls `GET /api/lane-presets` to list, `POST` to save, `PUT` to update, `DELETE` to remove
- `lane_presets.db` will be created in `data/` on first server start (same directory as `presets.db`)

---
*Phase: 09-speaker-lane-layout*
*Completed: 2026-03-25*
