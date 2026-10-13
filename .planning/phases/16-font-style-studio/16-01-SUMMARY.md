---
phase: 16-font-style-studio
plan: 01
subsystem: ui
tags: [remotion, text-shadow, extrude, zustand, vitest]

requires: []
provides:
  - "ShadowType and optional StyleProps.shadowType ('drop' | 'extrude')"
  - "textShadow.ts pure builders: buildStrokeShadow, buildExtrudeShadow, buildTextShadow, MAX_EXTRUDE_STEPS (100)"
  - "lookStyle.ts D-05 contract: LOOK_STYLE_KEYS (14), pickLookProps, shadowTypePatch, scaleLookStyle, EXTRUDE_SEED_OFFSET, EXTRUDE_SEED_THRESHOLD"
  - "Drop/Extrude toggle in the Global Styling Shadow section"
  - "Composition vitest suite (test/textShadow.test.ts, test/lookStyle.test.ts)"
  - "Legacy-safe project load: DEFAULT_STYLE merged under stored style"
affects: [16-02, 16-03, 16-04, 16-05, 16-06]

actuals:
  tokens: 22000
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Pure, type-only-import modules in the composition package so tests and backend can load them without fonts/remotion"
    - "strict === 'extrude' test so undefined shadowType falls through to legacy drop"

key-files:
  created:
    - packages/remotion-composition/src/textShadow.ts
    - packages/remotion-composition/src/lookStyle.ts
    - packages/remotion-composition/vitest.config.ts
    - packages/remotion-composition/test/textShadow.test.ts
    - packages/remotion-composition/test/lookStyle.test.ts
    - packages/frontend/src/lib/projectState.test.ts
  modified:
    - packages/remotion-composition/src/types.ts
    - packages/remotion-composition/src/SubtitleOverlay.tsx
    - packages/remotion-composition/src/index.ts
    - packages/remotion-composition/src/Root.tsx
    - packages/remotion-composition/package.json
    - packages/frontend/src/store/subtitleStore.ts
    - packages/frontend/src/components/StylePanel/StylePanel.tsx
    - packages/frontend/src/components/AnimationEditor/AnimationPreview.tsx
    - packages/frontend/src/components/AnimationBuilder/KeyframePreview.tsx
    - packages/frontend/src/lib/projectState.ts

key-decisions:
  - "MAX_EXTRUDE_STEPS raised from 64 to 100 (user request)"
  - "Extrude auto-seed offsets are x=20, y=40 (user request); EXTRUDE_SEED_OFFSET is exported as { x, y } rather than a scalar"
  - "Merge DEFAULT_STYLE under the stored style on project load (RESEARCH Pitfall 3 option c); speaker overrides stay Partial"

patterns-established:
  - "Outline ring (strokeColor) always precedes extrude steps (shadowColor) in the text-shadow list"

requirements-completed: [D-05, D-06, D-07]

duration: ~35min
completed: 2026-10-13
status: complete
---

# Phase 16 Plan 01: Extrude shadow tracer and look-style contract Summary

Extrude (stacked zero-blur 3D block) shadow rendered by the shared SubtitleOverlay and toggled from the Global Style panel, plus the D-05 look-style key contract, a composition test harness, and legacy-safe project loading.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 (tracer) | Extrude end to end, Global panel toggle through SubtitleOverlay | ccdcc85 |
| 2 (RED) | Composition vitest harness and failing look-style tests | 91477c0 |
| 2 (GREEN) | lookStyle.ts, package exports, user-requested constant changes | 7ab5d70 |
| 3 | Legacy-safe defaults and loadProjectBlob merge | 8ab4ced |

Tracer checkpoint (human-verify) was approved by the user: "extrude works" in the live editor.

## Verification

- `cd packages/remotion-composition && npx vitest run`: 16 tests pass (2 files).
- `npx vitest run --config packages/frontend/vitest.config.ts src/lib/projectState`: 5 pass.
- Full frontend suite: 83 pass, 5 fail, all 5 being the pre-existing `subtitleStore bulk actions` baseline failures (no new failures).
- `npx tsc --noEmit -p packages/frontend` clean; `just build-libs` clean; dist/index.d.ts exposes the new symbols; no test files in dist.

## Deviations from Plan

### User-requested changes

**1. MAX_EXTRUDE_STEPS 64 -> 100.** Applied in `textShadow.ts` (originally committed in ccdcc85) in the Task 2 GREEN commit; the cap test expects 100 entries for extrude(500, 500).

**2. Extrude auto-seed 8/8 -> 20/40.** `shadowTypePatch` now seeds `shadowOffsetX: 20, shadowOffsetY: 40` (trigger condition unchanged: both |offset| < 3). Because the seed has two values, `EXTRUDE_SEED_OFFSET` is exported as `{ x: 20, y: 40 }` instead of the scalar the plan described; `EXTRUDE_SEED_THRESHOLD` stays 3.

### User feedback recorded (no change in this plan)

During tracer verification the user said the StylePanel shadow offset ranges (-20..20) are too small for Extrude. This is handled by plan 16-03 (Depth X/Y range +/-100 in the updated plan, matching MAX_EXTRUDE_STEPS). StylePanel ranges were deliberately not changed here.

### Auto-fixed issues

None.

### Process notes

- Tests for `textShadow` passed immediately in the Task 2 RED commit because the builders already existed from the tracer; only the lookStyle tests were genuinely RED. The plan-level gate sequence (test commit, then feat commit) is satisfied for lookStyle.
- `.planning/ROADMAP.md` and the plan files were modified by the orchestrator; plan files were not committed by this executor.

## Known Stubs

None.

## Threat Flags

None. T-16-01 (unbounded extrude steps) is mitigated by MAX_EXTRUDE_STEPS and the non-finite guard, both unit-tested.

## Self-Check: PASSED

All created files exist; commits ccdcc85, 91477c0, 7ab5d70, 8ab4ced are present in git log.
