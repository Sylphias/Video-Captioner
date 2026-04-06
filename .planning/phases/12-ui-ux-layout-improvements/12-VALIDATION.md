---
phase: 12
slug: ui-ux-layout-improvements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual visual verification (CSS/layout phase — no automated UI tests) |
| **Config file** | none |
| **Quick run command** | `cd packages/frontend && npx tsc --noEmit` |
| **Full suite command** | `cd packages/frontend && npx tsc --noEmit` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/frontend && npx tsc --noEmit`
- **After every plan wave:** Run `cd packages/frontend && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-XX-XX | XX | X | Layout | typecheck | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This is a CSS/TSX layout restructuring phase — TypeScript compilation is the primary automated check.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full-height side panels render correctly | D-13 | Visual layout | Verify Lane (left) and Style (right) panels span full page height |
| Toolbar button grouping with separators | D-01, D-02 | Visual layout | Verify buttons grouped: [Undo/Redo] [Save] [Shift] | [Render/Download] | [Re-transcribe/Replace/New] |
| Stage tabs styled as proper tabs | D-04 | Visual styling | Verify active tab highlighted, inactive muted, consistent sizing |
| Right panel swaps Global/Override content | D-09, D-10, D-11 | Interactive behavior | Click phrase → panel shows override; click close → returns to Global |
| Lane panel visible on all stages | D-14 | Interactive behavior | Switch between Text Edit, Word Timing, Animation — lane panel always visible |
| Compact text editor buttons | D-05 | Visual sizing | Verify Upload SRT and Go to subtitle buttons are compact inline |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
