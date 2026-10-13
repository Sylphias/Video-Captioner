---
phase: 16
slug: font-style-studio
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-13
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 (node environment, no jsdom) |
| **Config file** | `packages/frontend/vitest.config.ts`; backend uses defaults (`packages/backend/test/`); `packages/remotion-composition/vitest.config.ts` — none yet, Wave 0 installs |
| **Quick run command** | Per touched package: `cd packages/remotion-composition && npx vitest run` / `cd packages/backend && npx vitest run` / `npx vitest run --config packages/frontend/vitest.config.ts` (from repo root) |
| **Full suite command** | All three vitest commands + `just build-libs` + `npx tsc --noEmit -p packages/frontend` + `npx tsc --noEmit -p packages/backend` |
| **Estimated runtime** | ~60 seconds |

**Baseline:** frontend 78 pass / 5 pre-existing failures in `subtitleStore.test.ts` bulk actions (`mergePhrases`, `deletePhrases`, `duplicatePhrase`); backend 13 pass. Gate is "no new failures vs baseline".

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched package + its type check
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green (modulo the 5 baseline failures), then manual UAT against `ref-3d-extrude-shadow.png`
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

Per-decision map (task IDs are filled in by the planner / validate-phase once plans exist):

| Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|----------|----------|-----------|-------------------|-------------|--------|
| D-06 | Drop output byte-identical to legacy expression for defined/undefined `shadowType` | unit | `cd packages/remotion-composition && npx vitest run test/textShadow.test.ts` | ❌ W0 | ⬜ pending |
| D-06 | Extrude: 1px zero-blur steps to (X,Y); (0,0) none; negatives; stroke before extrude; clamp 64; blur ignored | unit | same | ❌ W0 | ⬜ pending |
| D-05 | `LOOK_STYLE_KEYS` is exactly the 14 keys, excludes layout keys; `pickLookProps` fills `shadowType: 'drop'` | unit | `cd packages/remotion-composition && npx vitest run test/lookStyle.test.ts` | ❌ W0 | ⬜ pending |
| D-05 | Backend allowlist equals `LOOK_STYLE_KEYS` (drift guard) | unit | `cd packages/backend && npx vitest run test/textStyleStore.test.ts` | ❌ W0 | ⬜ pending |
| D-13 | Built-ins (3D Shadow, Classic, Bold Pop, Minimal; 4–6 total) complete, real font families, 3D Shadow is extrude/black | unit | same | ❌ W0 | ⬜ pending |
| D-14 | Built-ins read-only (PUT/DELETE rejected), duplicate → user "(Copy)", idempotent re-seed | unit | same | ❌ W0 | ⬜ pending |
| D-15 | User style CRUD; invalid bodies rejected | unit | same | ❌ W0 | ⬜ pending |
| D-10 | Apply at global/speaker/phrase copies 14 keys, keeps layout overrides, one undo step | unit | `npx vitest run --config packages/frontend/vitest.config.ts src/lib/applyStyle` | ❌ W0 | ⬜ pending |
| D-11 | Save-as-style payload = `pickLookProps(style)`, no layout keys | unit | same | ❌ W0 | ⬜ pending |
| Pitfall 3 | Old project blob without `shadowType` loads and renders as drop | unit | `npx vitest run --config packages/frontend/vitest.config.ts src/lib/projectState` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/remotion-composition/vitest.config.ts` + `"test": "vitest run"` script; tests in `packages/remotion-composition/test/` (outside `src`)
- [ ] `packages/remotion-composition/test/textShadow.test.ts` — D-06
- [ ] `packages/remotion-composition/test/lookStyle.test.ts` — D-05
- [ ] `packages/backend/test/textStyleStore.test.ts` — D-05 drift guard, D-13, D-14, D-15
- [ ] `packages/frontend/src/lib/applyStyle.test.ts` — D-10, D-11
- [ ] projectState load test — Pitfall 3

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Preview vs render parity for extrude | D-06 | No browser/pixel test infra | Render a short clip with 3D Shadow; compare editor Player frame and MP4 frame to `ref-3d-extrude-shadow.png` |
| Studio tab, three-column layout, backdrops, static highlighted preview, styled picker entries | D-01–D-04, D-12 | Node-env vitest, no component tests | `just dev`, open Style Studio, walk the checklist |
| Auto-save indicator, persistence across reload, no Save button, no loss on selection/tab switch | D-16 | UI timing | Edit, pause, observe Saving→Saved; reload |
| Extrude uses shadow colour, outline uses stroke colour; Studio hides "Other Google Font..." | D-07, D-08 | Visual | Same UAT session (font count 26 also unit-checked) |
| Pickers in Global, speaker (both modes) and phrase panels | D-09 | UI | Same UAT session |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
