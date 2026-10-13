---
phase: 16-font-style-studio
plan: 02
subsystem: api
tags: [fastify, better-sqlite3, vitest, react-hook, text-styles]

requires:
  - phase: 16-01
    provides: "LOOK_STYLE_KEYS / LookStyleProps look-style contract (D-05)"
provides:
  - "Global text-style library: SQLite store with six read-only built-ins and user CRUD"
  - "/api/styles routes (GET, POST, PUT/DELETE :id, POST :id/duplicate)"
  - "useTextStyles hook with cross-instance refresh"
  - "Drift test tying backend TEXT_STYLE_KEYS to composition LOOK_STYLE_KEYS"
affects: [16-03, 16-04, 16-05, 16-06]

actuals:
  tokens: 26000
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Pure store functions over a Database handle (testable on :memory:) with thin Fastify route/plugin wrappers"
    - "Backend src is self-contained (no workspace-package imports); only tests import composition sources by relative path"

key-files:
  created:
    - packages/backend/src/services/textStyleDefaults.ts
    - packages/backend/src/services/textStyleStore.ts
    - packages/backend/src/services/textStyles.ts
    - packages/backend/src/routes/styles.ts
    - packages/backend/test/textStyleStore.test.ts
    - packages/backend/test/stylesRoutes.test.ts
    - packages/frontend/src/hooks/useTextStyles.ts
  modified:
    - packages/backend/src/index.ts

key-decisions:
  - "Own text_styles.db + fastify.textStylesDb decorator, decoupled from animation presets (lanePresets precedent)"
  - "TEXT_STYLE_KEYS duplicated in backend src (installer ships backend/src only); drift guarded by test"
  - "Validation rejects out-of-range values rather than clamping"

patterns-established:
  - "StoreResult<T> union maps directly to HTTP status in routes"

requirements-completed: [D-05, D-08, D-13, D-14, D-15]

duration: ~15min
completed: 2026-10-13
status: complete
---

# Phase 16 Plan 02: Text style library backend and client hook Summary

SQLite-backed global text-style library served at `/api/styles` (six immutable built-ins, validated user CRUD, duplicate), plus the shared `useTextStyles` React hook.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 (RED) | Failing text style store tests | bccbed9 |
| 1 (GREEN) | Store, built-in data, validation | 2c55578 |
| 2 | text_styles.db plugin, /api/styles routes, index.ts registration, route tests | 17dd146 |
| 3 | useTextStyles hook | 1206b89 |

## Verification

- `cd packages/backend && npx vitest run`: 3 files, 34 tests pass (13 baseline jobDirs + 16 store + 5 routes).
- `npx tsc --noEmit -p packages/backend` clean; `just build-libs && npx tsc --noEmit -p packages/frontend` clean.
- `@eigen/` grep over the four new backend src files: 0 matches each; `builtin-` count in defaults: 6.
- Acceptance greps on the hook: 5 `/api/styles`, 1 `new EventTarget()`, 5 `notifyTextStylesChanged()` (4 mutations + definition).
- Not exercised: a live server boot (index.ts bundles Remotion on startup); the plugin mirrors lanePresets.ts and the store/routes are covered through in-memory tests.

## Deviations from Plan

None - plan executed as written. Tests (16 store tests, 5 route tests) cover every behaviour item; the font cross-check test imports composition `fonts.ts` directly and loads fine under vitest in the backend.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. T-16-03 (parameterised SQL, hostile-name test), T-16-04 (server-side built-in check), T-16-05 (key/hex/range/enum validation), T-16-06 (name/fontFamily/numeric bounds) and T-16-07 (no workspace imports in backend src) are implemented and tested or grep-verified.

## Self-Check: PASSED

All created files exist; commits bccbed9, 2c55578, 17dd146, 1206b89 are present in git log.
