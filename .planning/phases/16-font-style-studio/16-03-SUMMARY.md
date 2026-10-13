---
phase: 16-font-style-studio
plan: 03
subsystem: ui
tags: [react, zustand, style-controls, extrude, shared-component]

requires:
  - phase: 16-01
    provides: "pickLookProps, shadowTypePatch, LookStyleProps/ShadowType, Drop/Extrude rendering"
provides:
  - "StyleControls: presentational look-property editor (value + onChange, allowCustomFont, disabled)"
  - "FontPicker (allowCustomFont), ScrubInput, loadCustomGoogleFont exported from StyleControls.tsx"
  - "Global Style panel rebuilt on StyleControls with a useShallow look slice"
  - "Extrude UX: Depth X/Y labels, +/-100 range, Blur hidden, 20/40 auto-seed in one change"
affects: [16-04, 16-05, 16-06]

actuals:
  tokens: 11000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Presentational control components take value + onChange and never import the project store; the store-bound panel adapts via useShallow(pickLookProps(s.style))"
    - "One onChange patch maps to one setStyle call, so compound edits (Extrude auto-seed) are a single undo step"

key-files:
  created:
    - packages/frontend/src/components/StylePanel/StyleControls.tsx
  modified:
    - packages/frontend/src/components/StylePanel/StylePanel.tsx
    - packages/frontend/src/components/StylePanel/StylePanel.css

key-decisions:
  - "Layout controls (words per phrase, max chars, vertical position, lane gap, linger) now render after the look controls in the Global panel; no slot prop"
  - "Shadow X/Y/Blur row wraps (style-panel__inline-row--wrap) so it cannot widen the panel; Depth X / Depth Y labels are nowrap"
  - "StyleControls root is a fieldset; --disabled adds opacity and pointer-events:none because react-colorful pickers are divs a disabled fieldset does not block"

patterns-established:
  - "allowCustomFont={false} hides runtime Google Font injection (Studio use, D-08)"

requirements-completed: [D-02, D-06, D-08]

duration: ~20min
completed: 2026-10-13
status: complete
---

# Phase 16 Plan 03: Shared StyleControls and Global panel rebuild Summary

One presentational `StyleControls` component now owns every look control (font, weight, size, colours, stroke, Drop/Extrude shadow, spacing); the Global Style panel is rebuilt on top of it with a single shallow look-slice selector, and layout controls sit below.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Create StyleControls with Drop/Extrude controls, allowCustomFont and disabled modes (FontPicker, ScrubInput, loadCustomGoogleFont moved, not copied) | 0255a03 |
| 2 | Rebuild Global Style panel on StyleControls with `useShallow(pickLookProps(s.style))` | 44b81d3 |

## Verification

- `just build-libs && npx tsc --noEmit -p packages/frontend`: clean after both tasks.
- Frontend suite: 83 pass, 5 fail, all 5 the pre-existing `subtitleStore bulk actions` baseline failures (no new failures).
- Acceptance greps: 4 exports in StyleControls.tsx; 0 `useSubtitleStore` there; 0 moved definitions left in StylePanel.tsx; 0 layout keys in StyleControls.tsx; `shadowTypePatch(` present; StylePanel.tsx has 1 `<StyleControls`, 2 `useShallow`, 1 `pickLookProps(s.style)`, 0 `HexColorPicker`.
- Not exercised: a live browser check of the panel (no UI test harness exists for these components); the markup was moved verbatim from the previous panel.

## Deviations from Plan

None - plan executed as written. The plan's user-requested numbers (Depth range +/-100, auto-seed X 20 / Y 40) come through `shadowTypePatch` from 16-01 rather than being hard-coded in the component.

Additions within the plan's intent (not separate deviations): `loadCustomGoogleFont` is exported (listed under the plan's artifacts), and a small `.style-panel__inline-row--wrap` CSS modifier was added to honour the instruction not to worsen the Global panel's horizontal overflow (the full redesign is Phase 17).

## Process notes

- Source files are CRLF in the repo. MSYS `sed -i` strips carriage returns on write, so the edited files were re-normalised to CRLF with a small script; the final diff contains only intended changes.

## Known Stubs

None.

## Threat Flags

None. T-16-10 mitigation (`allowCustomFont={false}` available for the Studio) is in place; plan 04 must pass it.

## Self-Check: PASSED

StyleControls.tsx, StylePanel.tsx, StylePanel.css exist; commits 0255a03 and 44b81d3 are present in git log.
