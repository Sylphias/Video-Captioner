---
phase: 06-styling
plan: 02
subsystem: ui
tags: [react, zustand, react-colorful, css, style-panel, per-speaker, tab-ui]

# Dependency graph
requires:
  - phase: 06-01
    provides: StyleProps, SpeakerStyleOverride, AnimationType, setStyle, setSpeakerStyle, clearSpeakerStyle, FONT_NAMES, getFontFamily

provides:
  - StylePanel component with 7 global style controls wired to Zustand store
  - SpeakerStylePanel with collapsible per-speaker override sections and animation type selector
  - Tab bar in SubtitlesPage switching between Transcript and Style views

affects: [SubtitlesPage, styling-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Individual Zustand selectors per style field — each control subscribes only to its own field, minimizing re-renders"
    - "Conditional field rendering for stroke color — shown only when strokeWidth > 0"
    - "Toggle-to-override pattern in SpeakerStylePanel — checkbox enables field; unchecking removes it from override entirely"
    - "Collapsible sections using React state (not <details>) — allows controlled open/close with header button"

key-files:
  created:
    - "packages/frontend/src/components/StylePanel/StylePanel.tsx — 7 global style controls bound to Zustand setStyle"
    - "packages/frontend/src/components/StylePanel/StylePanel.css — dark theme, 200px color pickers, slider thumb styling"
    - "packages/frontend/src/components/StylePanel/SpeakerStylePanel.tsx — collapsible per-speaker override controls with animation selector"
    - "packages/frontend/src/components/StylePanel/SpeakerStylePanel.css — speaker section layout, colored dot, toggle rows"
  modified:
    - "packages/frontend/src/pages/SubtitlesPage.tsx — added tab bar, activeTab state, StylePanel+SpeakerStylePanel rendering"
    - "packages/frontend/src/pages/SubtitlesPage.css — tab bar styles, style-panels container"

key-decisions:
  - "Individual Zustand selectors per field (not whole style object) — minimizes StylePanel re-renders during rapid color picker drag"
  - "Toggle-to-override pattern: checkbox checked → initialize with default; unchecked → delete field from SpeakerStyleOverride — clean partial override semantics"
  - "Collapsible speaker sections via React useState (not HTML <details>) — enables future animated open/close without layout surprises"
  - "SpeakerStylePanel shows animation selector unconditionally per speaker; other fields use opt-in checkboxes — animation is always relevant but style fields are often left at global defaults"

patterns-established:
  - "Pattern: Co-located CSS per component — StylePanel.css and SpeakerStylePanel.css follow project convention"
  - "Pattern: Tab bar at top of scrollable editor area — activeTab state in SubtitlesPage, panels rendered conditionally"

# Metrics
duration: ~2 min
completed: 2026-03-06
---

# Phase 6 Plan 02: Style Controls UI Summary

**StylePanel with 7 global controls and SpeakerStylePanel with collapsible per-speaker overrides, integrated into SubtitlesPage via Transcript/Style tab bar**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-06T12:23:38Z
- **Completed:** 2026-03-06T12:25:58Z
- **Tasks:** 2 of 3 (Task 3 is human verification checkpoint)
- **Files created:** 4
- **Files modified:** 2

## Accomplishments

- StylePanel component: font selector (shows selected font as preview), font size slider (16-96px), highlight color picker, base color picker, stroke width slider (0-4px), conditional stroke color picker (only when width > 0), vertical position slider (5-95%)
- Each control uses individual Zustand selector to minimize re-renders — critical for color picker drag performance
- SpeakerStylePanel: empty state when no speakers, collapsible sections with speaker color dot, animation type select (none/pop/slide-up/bounce), toggle-to-override checkboxes for all 7 style fields, "Clear all overrides" button per speaker
- SubtitlesPage: Transcript/Style tab bar with underline-active indicator; Style tab shows StylePanel + SpeakerStylePanel; Transcript tab preserves existing TranscriptEditor behavior unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Build StylePanel with global style controls** - `18f4e04` (feat)
2. **Task 2: Build SpeakerStylePanel, wire both panels into SubtitlesPage** - `3886db4` (feat)

## Files Created

- `packages/frontend/src/components/StylePanel/StylePanel.tsx` — 7 style controls, individual Zustand selectors, react-colorful HexColorPicker + HexColorInput
- `packages/frontend/src/components/StylePanel/StylePanel.css` — dark theme, 200px color picker width, slider thumb styling with green accent
- `packages/frontend/src/components/StylePanel/SpeakerStylePanel.tsx` — collapsible speaker sections, toggle-to-override pattern, animation type selector
- `packages/frontend/src/components/StylePanel/SpeakerStylePanel.css` — speaker color dot, toggle rows, compact 180px color pickers

## Files Modified

- `packages/frontend/src/pages/SubtitlesPage.tsx` — added `activeTab` state, tab bar JSX, StylePanel/SpeakerStylePanel imports and conditional rendering
- `packages/frontend/src/pages/SubtitlesPage.css` — tab bar styles (underline-active), style-panels container

## Decisions Made

- Individual Zustand selectors per style field rather than subscribing to the whole `style` object — prevents unnecessary re-renders when a different field changes during rapid color picker drag
- Toggle-to-override pattern: checking enables the field with a sensible default; unchecking removes the field from the `SpeakerStyleOverride` object entirely — clean partial override semantics, consistent with how SubtitleOverlay merges overrides
- SpeakerStylePanel uses React `useState` for collapsible sections rather than HTML `<details>` — future-proof for animations, consistent with project component patterns
- Animation type selector is unconditional per speaker (always visible); all other override fields use opt-in checkboxes — animation is the primary per-speaker customization, style fields default to global

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compiles without errors across all packages: `npx tsc --noEmit --project packages/frontend/tsconfig.json` — passes
- Awaiting human verification (Task 3 checkpoint) to confirm live preview updates, render parity, and UX behavior

## Next Phase Readiness

- Human verification (Task 3) is the only remaining step — run `just dev`, upload + transcribe a video, switch to Style tab and test all controls
- After verification approval, Plan 06-03 can proceed (final phase — export/polish if planned)

---
*Phase: 06-styling*
*Completed: 2026-03-06*
