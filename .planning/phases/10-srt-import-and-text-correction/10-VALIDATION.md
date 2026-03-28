---
phase: 10
slug: srt-import-and-text-correction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if present) or manual browser testing |
| **Config file** | TBD — planner determines |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick suite
- **After every plan wave:** Run full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SRT parsing | unit | TBD | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Timestamp alignment | unit | TBD | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | Diff rendering | manual | browser | N/A | ⬜ pending |
| TBD | TBD | TBD | Accept/reject flow | manual | browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] SRT parsing unit tests — parse valid SRT, handle DaVinci Resolve HTML tags
- [ ] Alignment unit tests — timestamp matching, proportional time distribution
- [ ] Test fixtures — sample SRT files, sample Whisper transcript data

*Planner will finalize Wave 0 tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Side-by-side diff rendering | SC-4 | Visual layout | Import SRT, verify left/right columns show Whisper vs SRT text |
| Per-phrase accept/reject | SC-4 | Interaction flow | Click Accept Correction on a phrase, verify text updates in preview |
| Undo after accept | SC-4 | Store integration | Accept a phrase, Ctrl+Z, verify it reverts |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
