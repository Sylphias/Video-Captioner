---
phase: 16-font-style-studio
plan: 05
subsystem: ui
tags: [react, zustand, text-styles, style-picker, apply-style]

requires:
  - phase: 16-02
    provides: "useTextStyles hook and /api/styles library"
  - phase: 16-03
    provides: "Shared StyleControls and Global StylePanel"
provides:
  - "applyLookStyle(target, props) and buildSaveAsStylePayload(name, style) in lib/applyStyle.ts, tested against the real store"
  - "StylePicker: stateless 'Apply style...' dropdown whose entries are drawn in their own style via buildTextShadow"
  - "Apply style pickers at global, per-speaker (list and single-speaker mode) and phrase level"
  - "Save as style inline form in Global Styling"
affects: [16-06]

requirements-completed: [D-09, D-10, D-11, D-12]

actuals:
  tokens: 14000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Apply = one merge call into the existing store action (setStyle / setSpeakerStyle / setPhraseStyle) with pickLookProps(props): one undo step, layout overrides kept, no library id stored"
    - "Picker entries share the renderer's buildTextShadow + scaleLookStyle so outline/drop/extrude match the render"

key-files:
  created:
    - packages/frontend/src/lib/applyStyle.ts
    - packages/frontend/src/lib/applyStyle.test.ts
    - packages/frontend/src/components/StylePicker/StylePicker.tsx
    - packages/frontend/src/components/StylePicker/StylePicker.css
  modified:
    - packages/frontend/src/components/StylePanel/StylePanel.tsx
    - packages/frontend/src/components/StylePanel/StylePanel.css
    - packages/frontend/src/components/StylePanel/SpeakerStylePanel.tsx
    - packages/frontend/src/components/StylePanel/SpeakerStylePanel.css
    - packages/frontend/src/components/StyleDrawer/PhraseStylePanel.tsx

key-decisions:
  - "Picker is a stateless action menu (no selected value) because styles are copied, not linked"
  - "Save as style uses an inline name field (default 'My style'); no native prompt"
  - "Override panels get the picker and widened sliders (font size 200, stroke 30) but no shadow controls; shadow fields are apply-only there"

duration: 15min
completed: 2026-10-13
status: complete
---

# Phase 16 Plan 05: Apply style and Save as style Summary

**Styled "Apply style..." picker at global, speaker and phrase level that copies a library style's 14 look values into the project in one undo step, plus an inline "Save as style" in Global Styling.**

## Accomplishments
- `applyLookStyle` makes exactly one store call per apply, strips non-look keys through `pickLookProps`, and keeps layout overrides (verticalPosition) via the store's merge. Six store-level tests cover global, speaker, phrase, key-stripping, copy semantics and the save-as payload.
- `StylePicker` shows Built-in and My styles groups; each name is drawn at 22px with the style's font, weight, colour, letter spacing and `buildTextShadow` output, plus a highlight swatch.
- Global Styling has the picker and a "Save as style" button opening an inline form (Enter saves, Escape cancels, inline error, 3s success notice).
- Speaker sections (both list and single-speaker mode) and the phrase panel have the picker and a hint line; override font-size and stroke sliders now go to 200 and 30.

## Task Commits
1. Task 1 (apply helper, tests, picker, global picker): `472e628`
2. Task 2 (Save as style): `97f1191`
3. Task 3 (speaker/phrase pickers, slider ranges): `439f874`

## Deviations from Plan
- TDD RED was verified (test run failed on the missing module) but the RED and GREEN steps were committed together as a single Task 1 commit, as the plan defines one task commit.
- No other deviations.

## Verification
- `npx vitest run src/lib/applyStyle`: 6/6 pass.
- `npx tsc --noEmit -p packages/frontend`: clean.
- Full frontend suite: 97 passed, 5 failed, all the pre-existing `subtitleStore bulk actions` baseline failures.
- Not verified in a running browser (no UI run performed).

## Known Stubs
None.

## Threat Flags
None. T-16-15/16 mitigated through `pickLookProps`.

## Self-Check: PASSED
