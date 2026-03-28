---
phase: 11
slug: text-editor-enhancements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (installed in Phase 10) |
| **Config file** | packages/frontend/vitest.config.ts |
| **Quick run command** | `npx vitest run --config packages/frontend/vitest.config.ts --reporter=verbose` |
| **Full suite command** | `npx vitest run --config packages/frontend/vitest.config.ts` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick suite
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | D-01,D-08 | unit | vitest run | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | D-02,D-03,D-08,D-09,D-10,D-11 | manual+tsc | tsc+vitest | N/A | ⬜ pending |
| 11-02-02 | 02 | 2 | D-09 | manual | browser | N/A | ⬜ pending |
| 11-03-01 | 03 | 2/3 | D-04,D-05,D-06,D-07 | unit | vitest run | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2/3 | D-04,D-05,D-06,D-07 | manual | browser | N/A | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `packages/frontend/src/store/subtitleStore.test.ts` — tests for mergePhrases, deletePhrases, duplicatePhrase, movePhraseUp/Down
- [ ] `packages/frontend/src/lib/findReplace.test.ts` — tests for findMatches, replaceAll

*Vitest framework already installed from Phase 10.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-select checkboxes + Shift+click | D-02 | DOM interaction | Click checkboxes, Shift+click range, verify selection state |
| Contextual toolbar appearance | D-09 | Visual layout | Select 2+ phrases, verify toolbar shows Merge/Delete/Reassign |
| Keyboard shortcuts | D-08 | Key events in context | Test each shortcut, verify correct behavior |
| Confidence underlines | D-10,D-11 | Visual styling | Check dotted underlines on low-confidence words, hover tooltip |
| Find/replace preview | D-06 | Dialog interaction | Open Ctrl+H, search, click Replace All, verify preview dialog |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
