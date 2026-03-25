# Phase 9: Speaker Lane Layout - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Configurable per-speaker vertical positioning of subtitles in the video. Users can define where each speaker's subtitles appear, control the gap between overlapping rows, set a max visible row cap, override position per-phrase, and save lane layouts as reusable presets. Visual lane position editor with drag handles on the video preview and numeric controls.

</domain>

<decisions>
## Implementation Decisions

### Position editing UX
- Dual editing: drag handles on video preview + numeric inputs in a side panel, synced bidirectionally
- Drag handles are horizontal dashed lines spanning video width, colored per speaker, with speaker name label
- Lane controls panel lives on the left side of the preview panel
- Controls are stage-aware: automatically shown in Timeline stage, hidden in Text/Animation stages

### Lane stacking rules
- Fixed lanes: each speaker always appears at their assigned vertical position, regardless of whether they're the only active speaker
- Same-speaker overlap keeps current logic: same-speaker replacement + multi-speaker offset with configurable gap
- Configurable max visible rows cap — oldest subtitle hidden when cap exceeded
- Visual warning when speaker positions are too close (potential visual collision) — no auto-adjustment, user decides

### Default behavior
- Auto-distribute speakers evenly in the lower portion of the video based on speaker count (e.g. 2 speakers -> 85% and 75%)
- Fixed default gap regardless of speaker count (e.g. 8%) — user adjusts if needed
- New speaker auto-assigned to next available slot without redistributing existing custom positions
- Only redistributes when user has not yet customized any positions

### Scope of control
- Per-speaker vertical position (primary control)
- Per-phrase vertical position override available (drag on preview + numeric in StyleDrawer)
- Vertical position only — horizontal alignment stays in global style or keyframe animations
- Lane position is the baseline; Phase 8 keyframe animations offset relative to it (additive composition)
- Lane layout presets: save/load speaker positions + gap + max rows (no per-phrase overrides in presets)
- Presets stored in own SQLite table (lane_presets) — separate from animation presets, no relationship between them, own CRUD routes

### Claude's Discretion
- Exact auto-distribute algorithm (spacing formula)
- Visual warning implementation (color, icon, threshold)
- Lane controls panel layout and styling details
- Preset naming and management UI details
- Default max rows cap value

</decisions>

<specifics>
## Specific Ideas

- Drag handles should be dashed horizontal lines with the speaker's color, similar to a guide line in design tools
- Lane controls panel on the left side of the preview — makes use of currently unused space
- Stage-aware visibility keeps the UI clean when not relevant (Text/Animation stages)
- Per-phrase override uses same dual pattern: drag on preview for quick, numeric in StyleDrawer for precision

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-speaker-lane-layout*
*Context gathered: 2026-03-25*
