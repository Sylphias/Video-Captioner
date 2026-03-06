# Phase 6: Editing Workflow Redesign - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure the subtitle editing experience into a guided 4-stage workflow — Text editing, Timing adjustment, Speaker assignment, Styling — so users focus on one concern at a time. The existing data layer (types, store, render pipeline) from 06-01 is retained as foundation. This phase replaces the old Transcript/Style tab layout with a purpose-built 4-stage editor.

</domain>

<decisions>
## Implementation Decisions

### Stage navigation
- All 4 stages available as tabs that unlock automatically after transcription completes
- The "progression" is suggested via visual cues (highlighted next step), not gated — users can click any tab freely
- The 4-stage tabs replace the current Transcript/Style tabs entirely — they become the primary navigation below the preview
- Preview panel is always visible by default but collapsible — user can minimize it when they need more editing space (e.g., during text editing)

### Text editing UX (Stage 1)
- Script/screenplay style: phrases shown as numbered lines, click to edit a line, keyboard shortcuts to add/remove/split lines
- No timestamps visible in this stage — clean script-like view focused entirely on reading and editing words
- Click-to-seek: clicking a phrase seeks the video preview to that point, so timing is implicit through the preview
- Text edits only change the text — original word timestamps stay unchanged. New words get evenly-distributed timestamps within the phrase's time window. User fine-tunes timing in Stage 2
- Split/merge phrases available in BOTH Stage 1 (text) and Stage 2 (timing) — Enter splits a line, Backspace at line start merges up

### Timing interface (Stage 2)
- Hybrid approach: timeline-style visualization for visual adjustment, with numeric inputs available on click/hover for precision
- Audio waveform shown as background behind the word timeline blocks — helps users visually align words to speech peaks
- Overlapping phrases (from simultaneous speakers) shown on stacked horizontal lanes, like a multi-track timeline
- Linger duration is per-phrase, set in the timing stage — each phrase has its own linger slider/input so users can set different linger times for different phrases
- Split/merge also available here (shared with Stage 1)

### Stage transitions
- Switching from Text to Timing: show a brief confirmation ("Text changes saved. X words modified.") then switch view
- Going back from later stages to Text: timing adjustments on unchanged words are preserved. Only newly added/modified words get default timestamps
- Every edit in any stage instantly reflects in the video preview — fully live
- Global undo/redo system: Cmd+Z / Cmd+Shift+Z across all stages, full action history spanning text, timing, speakers, styling changes

### Claude's Discretion
- Exact keyboard shortcuts for script editing beyond Enter/Backspace
- Waveform extraction and rendering approach
- Timeline zoom level and scrolling behavior
- Undo/redo stack implementation (command pattern vs snapshot vs Zustand middleware)
- Collapse/expand animation for preview panel
- Visual indicator design for "suggested next stage"

</decisions>

<specifics>
## Specific Ideas

- The text editing should feel like editing a screenplay/script — numbered lines, clean, focused on the words
- The timing view should have a waveform background like audio editors (Audacity, Descript) so users can see where speech is
- Overlapping speakers rendered on separate lanes in timing view, similar to multi-track timeline in video editors
- Per-phrase linger in timing stage, not a global setting — different phrases may need different linger times
- Preview is collapsible but defaults to visible — user controls when they need space

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-styling*
*Context gathered: 2026-03-06*
