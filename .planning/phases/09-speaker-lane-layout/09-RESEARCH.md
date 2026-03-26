# Phase 9: Speaker Lane Layout - Research

**Researched:** 2026-03-25
**Domain:** Per-speaker vertical positioning, drag-handle UI, SQLite preset CRUD, SubtitleOverlay rendering
**Confidence:** HIGH — all findings are drawn from direct codebase inspection

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Position editing UX
- Dual editing: drag handles on video preview + numeric inputs in a side panel, synced bidirectionally
- Drag handles are horizontal dashed lines spanning video width, colored per speaker, with speaker name label
- Lane controls panel lives on the left side of the preview panel
- Controls are stage-aware: automatically shown in Timeline stage, hidden in Text/Animation stages

#### Lane stacking rules
- Fixed lanes: each speaker always appears at their assigned vertical position, regardless of whether they're the only active speaker
- Same-speaker overlap keeps current logic: same-speaker replacement + multi-speaker offset with configurable gap
- Configurable max visible rows cap — oldest subtitle hidden when cap exceeded
- Visual warning when speaker positions are too close (potential visual collision) — no auto-adjustment, user decides

#### Default behavior
- Auto-distribute speakers evenly in the lower portion of the video based on speaker count (e.g. 2 speakers -> 85% and 75%)
- Fixed default gap regardless of speaker count (e.g. 8%) — user adjusts if needed
- New speaker auto-assigned to next available slot without redistributing existing custom positions
- Only redistributes when user has not yet customized any positions

#### Scope of control
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 9 introduces per-speaker vertical lane positioning as a first-class feature. Currently, `verticalPosition` is a single global value in `StyleProps`, and per-speaker overrides are stored in `speakerStyles` as a `Partial<StyleProps>`. The SubtitleOverlay's `assignSlots()` function performs greedy slot assignment that stacks speakers upward from the global position. This entire positioning model must be replaced with a deterministic fixed-lane model where each speaker has an explicit, user-controlled `verticalPosition`.

The architectural change is primarily additive: the store gains `speakerLanes` data, the Remotion overlay gains a new positioning path, and a new SQLite table (`lane_presets`) mirrors the existing `animation_presets` pattern. The drag-handle UI on the preview follows the established pattern from `KeyframePreview` / `MotionPathOverlay` where a transparent absolute-positioned overlay div sits on top of the Remotion Player.

The most nuanced implementation challenge is how the existing `speakerStyles.verticalPosition` (per-speaker override already exists!) interacts with the new `speakerLanes` data. The cleanest path is to promote `speakerLanes` as the authoritative source for vertical positions and have `SpeakerStyleOverride.verticalPosition` continue to work for the per-phrase override path (which already reads from `styleOverride.verticalPosition`).

**Primary recommendation:** Store per-speaker lane positions in a new `speakerLanes: Record<string, SpeakerLane>` field in `subtitleStore`. The `SubtitleOverlay` consumes it via `SubtitleCompositionProps`. The `assignSlots()` function is replaced by a `getLanePosition()` lookup. The drag-handle UI is a new component rendered as an absolute overlay on the preview panel.

---

## Standard Stack

### Core (no new dependencies needed)
| Component | Current Location | Purpose |
|-----------|-----------------|---------|
| Zustand store | `subtitleStore.ts` | Add `speakerLanes` + `overlapGap` + `maxVisibleRows` fields |
| `SubtitleOverlay.tsx` | `remotion-composition/src/` | Replace `assignSlots()` with lane-lookup positioning |
| `SubtitleCompositionProps` | `remotion-composition/src/types.ts` | Add `speakerLanes` to composition props |
| better-sqlite3 | `animationPresets.ts` (already used) | New `lane_presets` table in same DB |
| Fastify plugin | `presets.ts` pattern | New `lanePresets.ts` plugin + routes |

### No new npm packages needed
All required capabilities (drag interactions, positioning calculations, SQLite CRUD) are already available via existing stack. The drag-handle pattern is already demonstrated in `MotionPathOverlay` and `KeyframePreview`.

---

## Architecture Patterns

### Recommended File Structure (new files)
```
packages/
├── shared-types/src/index.ts              — add SpeakerLane, LanePreset types
├── remotion-composition/src/types.ts      — add speakerLanes to SubtitleCompositionProps
├── remotion-composition/src/SubtitleOverlay.tsx  — replace assignSlots()
├── frontend/src/store/subtitleStore.ts    — add speakerLanes, overlapGap, maxVisibleRows
├── frontend/src/components/
│   ├── LaneControls/
│   │   ├── LaneControlsPanel.tsx          — left-side panel with numeric inputs + presets
│   │   └── LaneControlsPanel.css
│   └── LaneDragOverlay.tsx               — drag handles on top of Remotion Player
├── backend/src/services/lanePresets.ts   — SQLite plugin (mirrors animationPresets.ts)
└── backend/src/routes/lanePresets.ts     — CRUD routes (mirrors presets.ts)
```

### Pattern 1: Fixed Lane Positioning in SubtitleOverlay

Current `assignSlots()` is a greedy runtime algorithm. Replace with a direct lookup:

```typescript
// Current (to be replaced):
const slot = slotMap.get(activePhrase) ?? 0
const top = effectiveStyle.verticalPosition - slot * OVERLAP_OFFSET_PCT

// New (fixed lanes):
function getLaneTop(
  phrase: CompositionPhrase,
  speakerLanes: Record<string, SpeakerLane>,
  defaultVerticalPosition: number,
  overlapGap: number,  // configurable, replaces hardcoded OVERLAP_OFFSET_PCT = 8
  sameSlotOffset: number,  // for same-speaker overlap stacking
): number {
  const speaker = phrase.dominantSpeaker
  const lane = speaker ? speakerLanes[speaker] : undefined
  const basePosition = lane?.verticalPosition ?? defaultVerticalPosition
  // sameSlotOffset: 0 for "latest" phrase, 1+ for lingering older phrases from same speaker
  return basePosition - sameSlotOffset * overlapGap
}
```

The same-speaker replacement logic (`latestBySpeaker` map) stays unchanged. The multi-speaker stacking (slot 1, 2...) is replaced by each speaker's fixed lane position.

**Key insight:** `maxVisibleRows` cap: when more than N speaker rows are simultaneously visible, hide the oldest phrase(s). Implementation: after building `visiblePhrases`, sort by `phrase.words[0].start` descending (newest first), take first N. This is safe because each speaker already shows only its latest phrase.

### Pattern 2: SpeakerLane Type in shared-types

```typescript
// In shared-types/src/index.ts
export interface SpeakerLane {
  verticalPosition: number  // 0-100%, same unit as StyleProps.verticalPosition
  // Future: horizontalAlignment? Not in scope.
}

export interface LaneLayout {
  speakerLanes: Record<string, SpeakerLane>  // keyed by speaker ID
  overlapGap: number         // percentage points between same-speaker stacked rows (default 8)
  maxVisibleRows: number     // max simultaneous speaker rows visible (default e.g. 4)
}

export interface LanePreset {
  id: string
  name: string
  layout: LaneLayout
  createdAt: number
  updatedAt: number
}
```

### Pattern 3: Store Extension

The existing `subtitleStore` pattern to follow for adding `speakerLanes`:

```typescript
// In SubtitleStore interface — add:
speakerLanes: Record<string, SpeakerLane>
overlapGap: number
maxVisibleRows: number

// Actions:
setSpeakerLane: (speakerId: string, position: number) => void
setOverlapGap: (gap: number) => void
setMaxVisibleRows: (n: number) => void
initSpeakerLanes: (speakerIds: string[]) => void  // called when diarization completes
```

`captureSnapshot` and `restoreSnapshot` must be updated to include `speakerLanes`, `overlapGap`, and `maxVisibleRows` for full undo support.

### Pattern 4: Auto-Distribution Algorithm (Claude's Discretion)

When diarization completes and no positions have been customized yet:

```typescript
// Recommended formula:
// Place speakers in lower portion, starting from 85%, stepping up by gap
// e.g., 1 speaker: [85%]
// e.g., 2 speakers: [85%, 75%]  (speaker 0 at bottom, speaker 1 above)
// e.g., 3 speakers: [85%, 75%, 65%]

function autoDistribute(speakerIds: string[], gap: number): Record<string, SpeakerLane> {
  const base = 85
  return Object.fromEntries(
    speakerIds.map((id, i) => [id, { verticalPosition: base - i * gap }])
  )
}
```

This formula uses the fixed default gap (not re-calculated from speaker count) per the decision. Only triggers when `Object.keys(speakerLanes).length === 0` (no customization yet).

"New speaker auto-assigned to next slot without redistributing" means:

```typescript
function assignNewSpeaker(
  speakerLanes: Record<string, SpeakerLane>,
  newSpeakerId: string,
  gap: number,
): SpeakerLane {
  const positions = Object.values(speakerLanes).map(l => l.verticalPosition)
  const minPosition = positions.length > 0 ? Math.min(...positions) : 85
  return { verticalPosition: Math.max(5, minPosition - gap) }
}
```

### Pattern 5: Drag Handle Overlay

The established pattern from `KeyframePreview.tsx` is an absolute-positioned div overlay on top of the Remotion Player, using `pointer-events: none` on the player wrapper and `pointer-events: auto` on interactive overlay elements.

```tsx
// LaneDragOverlay.tsx — renders inside .preview-panel__player-wrapper
// Sits at position: absolute, inset: 0, over the Remotion Player
// Each speaker gets a horizontal dashed line at their verticalPosition%

function LaneDragHandle({ speakerId, position, color, label, onDrag }) {
  // position: 0-100% from top
  // Drag: mousedown on handle → mousemove updates position → mouseup commits
  // The handle line spans full width (left: 0, right: 0)
  // position: absolute, top: `${position}%`
}
```

**Drag implementation detail:** The `timingEditor` and `subtitleStore` use a `mousedown → document.mousemove → document.mouseup` pattern extensively. LaneDragOverlay should follow the same:
1. On `mousedown` on handle: push undo snapshot, capture drag baseline
2. On `document.mousemove`: compute new position from delta Y as percentage of container height
3. On `document.mouseup`: clean up listeners

The container height for percentage calculation needs a `ref` on the player wrapper div. The player wrapper `div.preview-panel__player-wrapper` has `flex: 1; min-height: 0` — the overlay needs `position: absolute; inset: 0` relative to it. This requires `position: relative` on `preview-panel__player-wrapper` (currently not set).

### Pattern 6: Visual Proximity Warning (Claude's Discretion)

**Recommended threshold:** Warn when two speaker lanes are within 10 percentage points of each other (less than the typical subtitle text height).

**Recommended implementation:** In `LaneControlsPanel`, after rendering each speaker's position input, check all pairwise distances. If any pair is < 10%, show a small amber warning icon (⚠) next to both affected speakers' controls. No auto-adjustment, just the indicator. Use `--color-warning: #d4a047` from tokens.css.

```typescript
function hasProximityWarning(lanes: Record<string, SpeakerLane>, threshold = 10): Set<string> {
  const ids = Object.keys(lanes)
  const warned = new Set<string>()
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const dist = Math.abs(lanes[ids[i]].verticalPosition - lanes[ids[j]].verticalPosition)
      if (dist < threshold) {
        warned.add(ids[i])
        warned.add(ids[j])
      }
    }
  }
  return warned
}
```

### Pattern 7: LanePresets SQLite Table (mirrors animation_presets exactly)

```sql
CREATE TABLE IF NOT EXISTS lane_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  layout TEXT NOT NULL,  -- JSON: { speakerLanes, overlapGap, maxVisibleRows }
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

Plugin registered in `backend/src/index.ts` the same way as `animationPresetsPlugin`. Routes follow `presetsRoutes.ts` pattern exactly (GET all, POST create, PUT update, DELETE delete). No built-in presets for lane layouts — user-created only.

**IMPORTANT:** The lane_presets table does NOT reference speaker IDs from the current job. It stores positions as abstract percentages. When a user loads a lane preset into a job with different speakers, the UI maps positions to speakers by display order (not by ID). This is simpler and more useful than ID-matching.

**Preset loading behavior:** When loading a preset into a job with N speakers, apply the first N positions from the preset (sorted by position descending). If the preset has fewer positions than the current speaker count, remaining speakers keep their current/default positions.

### Pattern 8: SubtitleCompositionProps Extension

```typescript
// In remotion-composition/src/types.ts — add to SubtitleCompositionProps:
speakerLanes?: Record<string, { verticalPosition: number }>  // optional for backward compat
overlapGap?: number         // default: 8
maxVisibleRows?: number     // default: 4 (Claude's discretion)
```

Making these optional ensures the composition remains backward compatible with the AnimationBuilder's `KeyframePreview` (which uses a simpler composition without speaker lanes).

### Pattern 9: Stage-Aware Visibility

The `activeStage` state is managed in `SubtitlesPage`. The lane controls panel is shown only when `activeStage === 'timing'`. The `PreviewPanel` currently takes no `activeStage` prop. Two options:

**Option A (recommended):** Pass `showLaneControls={activeStage === 'timing'}` prop to `PreviewPanel`. PreviewPanel conditionally renders `LaneControlsPanel` and `LaneDragOverlay`.

**Option B:** Keep lane controls entirely outside `PreviewPanel` — render `LaneControlsPanel` inline in the `timing` section of `SubtitlesPage`. This avoids PreviewPanel prop changes but requires a separate layout column.

The decision spec says "lane controls panel on the left side of the preview panel" — this implies option A: the panel is physically adjacent to the preview. The simplest CSS is a flex row wrapping `LaneControlsPanel` + `PreviewPanel` in the `subtitles-page__top` container.

### Anti-Patterns to Avoid

- **Putting lane positions inside `SpeakerStyleOverride`:** The existing `speakerStyles[id].verticalPosition` path already exists and is confusing. Keep `speakerLanes` as a separate, first-class field. The speaker style override `verticalPosition` can remain for legacy but is superseded by `speakerLanes` when present.
- **Re-running `assignSlots()` for fixed-lane mode:** The greedy algorithm is no longer needed. The fixed-lane model is purely a lookup — no runtime slot assignment needed.
- **Storing per-phrase position overrides in `speakerLanes`:** Per-phrase overrides already exist via `phrase.styleOverride.verticalPosition`. This path stays unchanged.
- **Passing lane preset data through `inputProps` as resolved objects:** Unlike animation presets (which need full resolution because they contain functions/closures), lane presets are just JSON position numbers — they can be passed as plain `speakerLanes` record in inputProps.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag interaction on preview | Custom pointer event math | Existing pattern from `KeyframePreview` + `TimingEditor` | Established `mousedown→document.mousemove→mouseup` with undo push already works |
| Proximity collision detection | Complex layout algorithm | Simple pairwise distance check | Threshold-based warning is sufficient; no auto-adjustment needed |
| SQLite lane presets | Custom file storage | better-sqlite3 via `animationPresetsPlugin` pattern | DB already in use; WAL mode, onClose hook, decorate pattern all in place |

---

## Common Pitfalls

### Pitfall 1: Remotion Serialization Boundary
**What goes wrong:** `speakerLanes` passed as `inputProps` to Remotion Player must be plain JSON-serializable. If any non-serializable values (Set, function, class instance) are included, the Player silently uses stale props or throws.
**Why it happens:** Remotion serializes `inputProps` across its internal worker boundary.
**How to avoid:** `speakerLanes: Record<string, { verticalPosition: number }>` is already a plain object — no serialization issues. Do not put class instances here.
**Warning signs:** Player not updating when lanes change.

### Pitfall 2: Preview Panel Layout — Overlay Positioning
**What goes wrong:** The drag handle overlay doesn't align with the actual video frame because the Remotion Player scales the video to fit its container, leaving letterbox margins.
**Why it happens:** The Remotion Player renders at `compositionWidth x compositionHeight` and scales to fit CSS width/height. The video frame's pixel bounds within the Player wrapper are not the full wrapper dimensions.
**How to avoid:** The Remotion Player renders with `style={{ width: '100%' }}` and the wrapper has `flex: 1; overflow: hidden`. The Player respects the aspect ratio and will letterbox in the player-wrapper div. For vertical handles at correct % positions, use the player wrapper's full height (not the video frame's pixel height within it). Because `verticalPosition` is a % of video height (used as CSS `top: ${top}%` in SubtitleOverlay), the drag handles can use the same `top: ${position}%` relative to the player wrapper — the mapping will be slightly off due to letterboxing, but the visual alignment will match close enough because the player wrapper is sized to `maxWidth` to maintain aspect ratio (see `PreviewPanel.tsx` `containerRef` + `ResizeObserver`). For exact alignment, the overlay div should be positioned within the video frame bounds, not the full player wrapper. This requires measuring the actual rendered player dimensions.
**Warning signs:** Handles appear at wrong vertical positions relative to subtitles in the preview.
**Recommendation:** Start with `position: absolute; inset: 0` overlay matching player wrapper — acceptable for MVP. Exact video-frame alignment can be refined post-MVP.

### Pitfall 3: `captureSnapshot` / `restoreSnapshot` Missing New Fields
**What goes wrong:** Undo restores session/style but lane positions snap back unexpectedly or don't restore at all.
**Why it happens:** `captureSnapshot` in `subtitleStore.ts` has an explicit shape — new fields must be added manually.
**How to avoid:** Add `speakerLanes`, `overlapGap`, `maxVisibleRows` to both `captureSnapshot()` return value, `pushUndo()` call shape, `StateSnapshot` type in `undoMiddleware.ts`, and `restoreSnapshot()`. The `StateSnapshot` type is defined in `undoMiddleware.ts` and used throughout.
**Warning signs:** Lane changes are not undoable; undo restores wrong lane state.

### Pitfall 4: `initSpeakerLanes` Called Before Speakers are Known
**What goes wrong:** Auto-distribute runs on an empty speaker list during initial transcript load (before diarization), producing no lanes. Then diarization completes and adds speakers without triggering auto-distribute again.
**Why it happens:** `setJob()` initializes `speakerNames` from transcript words. But `speakerLanes` auto-distribution should run after diarization, not after transcription.
**How to avoid:** The `initSpeakerLanes` action checks `Object.keys(speakerLanes).length === 0` (no customization) before auto-distributing. Call it from the diarization-complete effect in `SubtitlesPage` (where `diarizeState.status === 'done'` is already handled). New speakers added by reassignment trigger `setSpeakerLane` for the new ID using the "assign next slot" logic.
**Warning signs:** Lanes don't initialize after diarization; lanes reset on new speaker assignment.

### Pitfall 5: `remotion-composition` Rebuild Required
**What goes wrong:** Frontend doesn't see new `speakerLanes` prop or updated `SubtitleOverlay` behavior.
**Why it happens:** TypeScript project references — frontend imports from `@eigen/remotion-composition` which reads from the `dist/` folder.
**How to avoid:** After any changes to `remotion-composition/src/`, run `tsc --build` in remotion-composition before starting/testing the frontend. This is documented in the project memory as a known feedback item.
**Warning signs:** TypeScript errors on `speakerLanes` prop; runtime behavior uses old overlay code.

### Pitfall 6: Per-Phrase Override Precedence
**What goes wrong:** Per-phrase `styleOverride.verticalPosition` is ignored when speaker lane positions are introduced, because the lane lookup overrides it.
**Why it happens:** The lane position lookup must fall back to per-phrase override if set.
**How to avoid:** Establish clear precedence chain in `SubtitleOverlay`:
  1. `phrase.styleOverride.verticalPosition` (highest — per-phrase override)
  2. `speakerLanes[dominantSpeaker].verticalPosition` (per-speaker lane)
  3. `style.verticalPosition` (global default)

---

## Code Examples

### Verified: Current positioning in SubtitleOverlay (lines 257-259)
```typescript
// Source: packages/remotion-composition/src/SubtitleOverlay.tsx:257-259
const slot = slotMap.get(activePhrase) ?? 0
const top = effectiveStyle.verticalPosition - slot * OVERLAP_OFFSET_PCT
```
Replace this block. The `OVERLAP_OFFSET_PCT = 8` constant (line 35) becomes the default `overlapGap`.

### Verified: Current SubtitleCompositionProps (types.ts)
```typescript
// Source: packages/remotion-composition/src/types.ts
export interface SubtitleCompositionProps {
  videoSrc: string
  phrases: CompositionPhrase[]
  style: StyleProps
  speakerStyles: Record<string, SpeakerStyleOverride>
  animationPreset?: AnimationPreset
}
// ADD: speakerLanes?: Record<string, { verticalPosition: number }>
// ADD: overlapGap?: number
// ADD: maxVisibleRows?: number
```

### Verified: SubtitleOverlay receives speakerStyles (line 188-192)
```typescript
// Source: packages/remotion-composition/src/SubtitleOverlay.tsx:187-193
interface SubtitleOverlayProps {
  phrases: CompositionPhrase[]
  style: StyleProps
  speakerStyles: Record<string, SpeakerStyleOverride>
  animationPreset?: AnimationPreset
}
// ADD: speakerLanes?: Record<string, { verticalPosition: number }>
// ADD: overlapGap?: number
// ADD: maxVisibleRows?: number
```

### Verified: PreviewPanel inputProps construction (lines 123-158)
```typescript
// Source: packages/frontend/src/components/PreviewPanel.tsx:123-158
const inputProps = useMemo(() => {
  // ... existing ...
  return {
    videoSrc,
    phrases,
    style,
    speakerStyles,
    animationPreset,
    // ADD: speakerLanes, overlapGap, maxVisibleRows from store
  }
}, [...deps, speakerLanes, overlapGap, maxVisibleRows])
```

### Verified: Drag pattern from TimingEditor/SubtitlesPage
```typescript
// Pattern from SubtitlesPage.tsx handleResizeMouseDown (lines 115-138)
const handleDragMouseDown = (e: React.MouseEvent, speakerId: string) => {
  const container = containerRef.current
  if (!container) return
  const startY = e.clientY
  const startPosition = speakerLanes[speakerId]?.verticalPosition ?? 80

  // Push undo ONCE at drag start
  pushUndo(store.getState())

  const onMove = (moveE: MouseEvent) => {
    const rect = container.getBoundingClientRect()
    const deltaPercent = ((moveE.clientY - startY) / rect.height) * 100
    const newPosition = Math.min(95, Math.max(5, startPosition + deltaPercent))
    store.setSpeakerLane(speakerId, newPosition)
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
```

### Verified: SQLite plugin pattern from animationPresets.ts
```typescript
// Source: packages/backend/src/services/animationPresets.ts:212-243
async function animationPresetsPlugin(fastify: FastifyInstance): Promise<void> {
  const dbPath = path.join(DATA_ROOT, 'presets.db')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`CREATE TABLE IF NOT EXISTS animation_presets (...)`)
  fastify.decorate('db', db)
  fastify.addHook('onClose', (_instance, done) => { db.close(); done() })
}
// Lane presets: use SAME presets.db file but add lane_presets table
// OR separate lane_presets.db — either works, same pattern
```

**Recommendation:** Add `lane_presets` table to the existing `presets.db` file. The `animationPresetsPlugin` already decorates `fastify.db`. The lane presets plugin can reuse `fastify.db` instead of opening a new connection — but since `animationPresetsPlugin` owns the db lifecycle, lane presets should register as a separate plugin that reads `fastify.db` (already decorated). Alternatively, a separate `lane_presets.db` avoids coupling. Given the pattern used for animation presets (separate db file via DATA_ROOT), a separate `lane_presets.db` is cleaner.

### Verified: Speaker color lookup (reuse for drag handles)
```typescript
// Source: packages/frontend/src/components/StylePanel/SpeakerStylePanel.tsx:8-21
const SPEAKER_COLORS = ['#4A90D9', '#E67E22', '#27AE60', '#9B59B6', '#E74C3C', '#1ABC9C', '#F39C12', '#95A5A6']

function getSpeakerColor(speakerId: string): string {
  const idx = parseInt(speakerId.replace('SPEAKER_', ''), 10) % 8
  return SPEAKER_COLORS[isNaN(idx) ? 0 : idx]
}
// Reuse this exact function for coloring drag handles
```

This function should be moved to a shared utility or duplicated in LaneDragOverlay.

---

## State of the Art

| Old Approach | New Approach | Change | Impact |
|--------------|-------------|--------|--------|
| `assignSlots()` greedy runtime algo | Fixed lookup `speakerLanes[id].verticalPosition` | This phase | Deterministic, user-controlled positions |
| `OVERLAP_OFFSET_PCT = 8` hardcoded | `overlapGap` configurable field (default 8) | This phase | User can tune same-speaker row separation |
| Global `style.verticalPosition` only | Per-speaker lanes + global fallback | This phase | Multi-speaker shows are no longer jumbled |
| `speakerStyles[id].verticalPosition` as sole per-speaker position | `speakerLanes[id]` as primary, `speakerStyles[id].verticalPosition` as legacy | This phase | `speakerLanes` is the canonical per-speaker position store |

---

## Open Questions

1. **Should `speakerLanes` undo be per-drag or per-handle-release?**
   - What we know: The drag pattern pushes undo once at mousedown (not on every mousemove). This is the existing `handleResizeMouseDown` pattern.
   - What's unclear: Users might want more granular undo for position changes.
   - Recommendation: Push undo once at mousedown (consistent with all other drag interactions in this app).

2. **Should lane presets load by speaker-ID match or by position-order?**
   - What we know: Preset speaker IDs won't match across different videos (SPEAKER_00 in one job may be a different person than SPEAKER_00 in another).
   - Recommendation: Load by position order (descending), map to current speakers by display order. This is more useful and avoids false ID matching.

3. **Default `maxVisibleRows` value?**
   - What we know: Typical use cases have 2-3 speakers. The current greedy algorithm has no cap.
   - Recommendation: Default to 4. This covers all realistic multi-speaker scenarios while providing a safety cap.

4. **Where does `LaneDragOverlay` live in the component tree?**
   - What we know: It must overlay the Remotion Player. `PreviewPanel.tsx` wraps the Player in `.preview-panel__player-wrapper`.
   - Recommendation: Render `LaneDragOverlay` as an absolute-positioned sibling inside `.preview-panel__player-wrapper` (which needs `position: relative` added to its CSS). `LaneDragOverlay` takes `speakerLanes`, `speakerNames`, `onDragStart`, `onDrag`, `onDragEnd` props.

5. **How does the per-phrase vertical position drag work on the preview?**
   - What we know: Per-phrase override uses `phrase.styleOverride.verticalPosition`. The phrase is active only during playback.
   - Recommendation: Per-phrase drag on preview is complex (requires knowing which phrase is currently visible). For MVP, implement per-phrase position only via the numeric input in StyleDrawer (already present). Visual drag for per-phrase can be deferred.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `packages/remotion-composition/src/SubtitleOverlay.tsx` — current `assignSlots()` implementation, `OVERLAP_OFFSET_PCT`, positioning logic
- `packages/remotion-composition/src/types.ts` — `StyleProps`, `SubtitleCompositionProps`, `SpeakerStyleOverride`
- `packages/frontend/src/store/subtitleStore.ts` — store shape, `captureSnapshot`, `restoreSnapshot`, `speakerStyles` pattern
- `packages/frontend/src/store/undoMiddleware.ts` — `StateSnapshot` type, undo stack
- `packages/frontend/src/components/PreviewPanel.tsx` — `inputProps` construction, player wrapper layout, drag pattern
- `packages/frontend/src/pages/SubtitlesPage.tsx` — stage management, `activeStage`, drag pattern (`handleResizeMouseDown`)
- `packages/frontend/src/components/StylePanel/SpeakerStylePanel.tsx` — `SPEAKER_COLORS`, `getSpeakerColor`, per-speaker section pattern
- `packages/frontend/src/components/StyleDrawer/PhraseStylePanel.tsx` — per-phrase override pattern including `verticalPosition`
- `packages/backend/src/services/animationPresets.ts` — SQLite plugin pattern, WAL, `fastify.decorate`, seed
- `packages/backend/src/routes/presets.ts` — CRUD route pattern for presets
- `packages/backend/src/index.ts` — plugin registration order
- `packages/shared-types/src/index.ts` — existing type definitions
- `packages/frontend/src/components/AnimationBuilder/KeyframePreview.tsx` — overlay-on-player pattern
- `packages/frontend/src/styles/tokens.css` — design tokens (`--color-warning`, `--speaker-color-*`)
- `packages/frontend/src/components/StageTabBar.tsx` — stage IDs (`'timing' | 'text' | 'animation'`)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified in codebase
- Architecture: HIGH — current code is well-understood; patterns are directly reusable
- Pitfalls: HIGH — all pitfalls are grounded in specific code behavior observed during research
- Claude's discretion areas: MEDIUM — algorithm recommendations are reasonable but not battle-tested

**Research date:** 2026-03-25
**Valid until:** Stable (this is an internal codebase; no external dependencies changing)
