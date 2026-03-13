# Phase 8: Keyframe Position Animation - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the existing animation preset system with keyframe-based position, scale, rotation, and opacity animation. Add a standalone Animation Builder page (top-level tab, separate from Subtitles) for authoring presets with a visual keyframe editor. The Subtitles Animation tab remains a lightweight preset picker with speed/intensity tweaks.

</domain>

<decisions>
## Implementation Decisions

### Keyframe model
- Keyframeable properties: position (x%, y%), scale, rotation, opacity — full motion graphics control
- Keyframes extend the existing enter/hold/exit phase model — phases define transition type (fade, slide), keyframes add per-property animation within each phase
- Reusable motion templates stored as part of AnimationPreset — not per-phrase keyframe sequences
- Keyframe time is relative to phrase lifetime (0%–100% implied by living within enter/hold/exit phases)
- Same SQLite presets table — extend with keyframe columns, one unified preset system

### Animation Builder page
- New top-level page/tab (alongside Subtitles) — not inside the subtitle editor
- Standalone — accessible without a loaded video project
- Preview area with draggable text — set position keyframes by dragging text on the preview (After Effects style)
- Timeline below preview shows all keyframes across properties
- Editable sample text — user can type custom preview text
- Switchable aspect ratio preview: 16:9, 9:16, 1:1 — design motion for different video formats
- Toggleable motion path overlay on preview — dotted line connecting keyframe positions

### Easing controls
- Preset easing curves (linear, ease-in, ease-out, ease-in-out, bounce, elastic) plus custom cubic bezier editor
- Easing set per-property — position, scale, rotation, opacity each have independent easing between keyframe pairs
- Preset curves show visual curve thumbnails in the dropdown

### Subtitle Animation tab
- Remains lightweight — pick a preset, tweak speed/intensity with a simple slider
- Full keyframe editing happens in the Animation Builder page, not in the subtitle context
- Existing built-in presets will be extended with keyframe data (not a separate preset set)

</decisions>

<specifics>
## Specific Ideas

- After Effects-style interaction: drag text on preview to position, timeline below for precision
- Cubic bezier editor like cubic-bezier.com for custom easing curves
- Motion path as a toggleable dotted line overlay connecting keyframe positions on the preview

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-keyframe-position-animation*
*Context gathered: 2026-03-14*
