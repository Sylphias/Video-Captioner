# Phase 7: Text Animation Creator - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Create, store, and reuse text animation presets for subtitle phrases. Animations have three phases (enter → active → exit) and auto-adapt to any video resolution. Presets are stored in SQLite and managed through a new Animation stage tab. This phase covers animation parameters, preset CRUD, and the editor UI. It does NOT cover new style features (fonts, colors) — those already exist in the Styling stage.

</domain>

<decisions>
## Implementation Decisions

### Animation types & parameters
- Both per-word and per-phrase animations supported — user picks scope per preset
- Full library of transition types: position-based (slide, bounce, fly), opacity + scale (fade, pop, shrink), text-reveal effects (typewriter, letter-by-letter, word cascade, blur reveal)
- Three-phase animation model: **enter → active (hold) → exit**
  - Enter: how the text appears (slide in, fade in, typewriter, etc.)
  - Active: looping animation while phrase is on screen (jiggle, wave, pulse, bounce, etc.)
  - Exit: how the text disappears — mirrored from enter by default, user can override to set a different exit
- Timing: duration + easing picker per phase (ease-in, ease-out, bounce, spring, etc.) — not full keyframe editing

### Preset management
- Storage: SQLite database (local)
- Ship with 5-10 curated built-in starter presets (e.g., 'Classic Fade', 'Typewriter', 'Slide Up', 'Word Cascade', 'Pop In')
- Organization: flat list with search — no categories/tags needed
- Presets store animation parameters ONLY — visual style (font, colors, stroke, position) stays in the existing StyleDrawer
- Per-phrase override: global default animation preset, but user can override individual phrases with different presets

### Resolution handling
- Auto-adapt: one preset works for any resolution — animation parameters scale proportionally to frame dimensions
- Font sizing stored as percentage of frame height (not absolute pixels) for cross-resolution consistency
- Same default subtitle positioning for all resolutions — user adjusts manually if needed
- Preview: generic sample (placeholder text on solid background) for fast preset browsing — not rendered on actual video

### Editor experience
- New "Animation" stage tab added alongside Timing/Text/Styling — part of the editing workflow
- Hybrid editor: visual timeline showing enter/active/exit phases + parameter panel for detailed settings
  - Timeline shows three phase blocks, drag to adjust durations
  - Click a phase to configure its type, easing, and parameters in the side panel
- Live preview updates with ~300ms debounce as user tweaks parameters
- Real-time Remotion Player reflects animation changes after debounce

### Claude's Discretion
- Exact set of built-in starter presets (names, specific parameters)
- SQLite schema design
- Debounce implementation approach
- Active-phase animation loop behavior (seamless loop vs restart)
- Animation timeline visual design

</decisions>

<specifics>
## Specific Ideas

- Active (hold) phase should support looping animations like jiggling or waving text — this differentiates presets beyond just enter/exit
- Enter/exit mirroring: exit auto-mirrors enter by default (slide in → slide out), but user can break the mirror and set an independent exit animation
- Per-phrase override follows the same pattern as existing per-speaker style overrides in the StyleDrawer — familiar UX

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-text-animation-creator*
*Context gathered: 2026-03-10*
