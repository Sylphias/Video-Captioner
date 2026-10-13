# Phase 16: Font Style Studio - Pattern Map

**Mapped:** 2026-10-13
**Files analyzed:** 27 (new and modified)
**Analogs found:** 25 / 27 (the two new test configs and the new composition test dir reuse `packages/desktop/vitest.config.ts`)

All paths are relative to `F:/projects/personal/Video-Captioner/packages/` unless noted.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `remotion-composition/src/types.ts` (mod: `ShadowType`, `shadowType?`) | model | transform | itself (StyleProps, lines 3-21) | exact |
| `remotion-composition/src/textShadow.ts` (new) | utility | transform | `SubtitleOverlay.tsx` `generateStrokeShadow` lines 45-56 + lines 440-445 | exact (extract) |
| `remotion-composition/src/lookStyle.ts` (new) | utility | transform | none in repo; shape from RESEARCH "Look-style module" | no analog |
| `remotion-composition/src/SubtitleOverlay.tsx` (mod) | component | transform | itself, lines 440-445 | exact |
| `remotion-composition/src/Root.tsx`, `index.ts` (mod) | config | transform | itself | exact |
| `remotion-composition/vitest.config.ts` + `test/*.test.ts` (new) | test | transform | `desktop/vitest.config.ts`; `backend/test/*.test.ts` | role-match |
| `backend/src/services/textStyleDefaults.ts` (new) | config (data) | batch seed | `animationPresets.ts` `BUILTIN_PRESETS` (to line 109) | exact |
| `backend/src/services/textStyleStore.ts` (new) | service | CRUD | `animationPresets.ts` `seedBuiltinPresets` lines 113-148 + `routes/presets.ts` logic | role-match |
| `backend/src/services/textStyles.ts` (new) | provider (fp plugin) | CRUD | `backend/src/services/lanePresets.ts` lines 1-40 (own DB file + own decorator) | exact |
| `backend/src/routes/styles.ts` (new) | route | request-response CRUD | `backend/src/routes/presets.ts` | exact |
| `backend/src/index.ts` (mod: register plugin + routes) | config | - | itself, lines 53-72 | exact |
| `backend/test/textStyleStore.test.ts` (new) | test | CRUD | existing `backend/test/*.test.ts` (jobDirs test) | role-match |
| `frontend/src/hooks/useTextStyles.ts` (new) | hook | CRUD + pub-sub | `hooks/useAnimationPresets.ts` | exact |
| `frontend/src/components/StylePanel/StyleControls.tsx` (new, extracted) | component | request-response (value/onChange) | `StylePanel/StylePanel.tsx` (FontPicker 77-200, ScrubInput 204-275, body 279+) | exact (extract) |
| `frontend/src/components/StylePanel/StylePanel.tsx` (mod) | component | store-bound | itself | exact |
| `frontend/src/components/StylePicker/StylePicker.tsx` (new) | component | request-response | `FontPicker` in `StylePanel.tsx` (custom dropdown) | role-match |
| `frontend/src/components/StyleStudio/StyleStudioPage.tsx` (+css) | component (page) | CRUD + debounced autosave | `components/AnimationBuilder/AnimationBuilderPage.tsx` | exact |
| `frontend/src/components/StyleStudio/StyleLibraryList.tsx` (+css) | component | CRUD | `AnimationBuilderPage.tsx` preset list/delete/duplicate | role-match |
| `frontend/src/components/StyleStudio/StylePreview.tsx` (+css) | component | transform (static Player) | `AnimationEditor/AnimationPreview.tsx` + `AnimationBuilder/KeyframePreview.tsx` | exact |
| `frontend/src/App.tsx` (mod: TABS + render) | config | - | itself, lines 9-12, 60-80 | exact |
| `GlobalStyleSidePanel.tsx`, `StylePanel/SpeakerStylePanel.tsx`, `StyleDrawer/PhraseStylePanel.tsx` (mod) | component | store write | `subtitleStore.setStyle/setSpeakerStyle/setPhraseStyle` | role-match |
| `frontend/src/lib/applyStyle.ts` + test (new) | utility | transform | `store/subtitleStore.ts` setters (lines 724-729, 757-767) | role-match |
| `frontend/src/lib/projectState.ts` (mod: default merge on load) | utility | transform | itself (`loadProjectBlob`) | exact |
| `frontend/src/store/subtitleStore.ts`, `AnimationPreview.tsx`, `KeyframePreview.tsx` (mod: add `shadowType: 'drop'` to default literals) | config | - | themselves | exact |

## Pattern Assignments

### `remotion-composition/src/textShadow.ts` (utility, transform)

**Analog:** `remotion-composition/src/SubtitleOverlay.tsx`

Move `generateStrokeShadow` here as `buildStrokeShadow` (lines 45-56):
```ts
function generateStrokeShadow(width: number, color: string): string {
  if (width <= 0) return ''
  const STEPS = 16
  const shadows: string[] = []
  for (let i = 0; i < STEPS; i++) {
    const angle = (2 * Math.PI * i) / STEPS
    const x = (Math.cos(angle) * width).toFixed(1)
    const y = (Math.sin(angle) * width).toFixed(1)
    shadows.push(`${x}px ${y}px 0 ${color}`)
  }
  return shadows.join(',')
}
```
Legacy composition that `buildTextShadow` must reproduce byte-for-byte in drop mode (lines 440-445):
```ts
const strokeShadow = hasStroke
  ? generateStrokeShadow(effectiveStyle.strokeWidth * 2, effectiveStyle.strokeColor)
  : ''
const dropShadow = `${effectiveStyle.shadowOffsetX ?? 0}px ${effectiveStyle.shadowOffsetY ?? 2}px ${effectiveStyle.shadowBlur ?? 4}px ${effectiveStyle.shadowColor ?? '#000000'}`
const combinedShadow = strokeShadow ? `${strokeShadow},${dropShadow}` : dropShadow
```
Replace in SubtitleOverlay with `const combinedShadow = buildTextShadow(effectiveStyle)`. Use `=== 'extrude'` (never `!== 'drop'`). Pure file: no react/remotion imports. Extrude code shape: RESEARCH Pattern 1 (`MAX_EXTRUDE_STEPS = 64`). `generateStrokeShadow` has no other callers outside this file (verify with grep when editing).

---

### `remotion-composition/src/lookStyle.ts` (utility, transform) - NO ANALOG

Use RESEARCH "Look-style module" (`LOOK_STYLE_KEYS` = 14 keys, `pickLookProps` fills `shadowType ?? 'drop'`). Export through `index.ts`, next to existing line `export { SubtitleOverlay, findActiveWordIndex } from './SubtitleOverlay'` (index.ts:4).

---

### `remotion-composition/vitest.config.ts` and `test/` (test)

**Analog:** `desktop/vitest.config.ts` (copy exactly, but include `test/**/*.test.ts`):
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```
Add `"test": "vitest run"` to the package.json scripts. Tests live in `test/` (outside tsc rootDir `src`). Backend test style: `import { describe, it, expect } from 'vitest'` and relative `../src/x.ts` imports with the `.ts` extension (see `backend/test/*.test.ts` line 1-3).

---

### `backend/src/services/textStyleDefaults.ts` (config data)

**Analog:** `backend/src/services/animationPresets.ts` `BUILTIN_PRESETS` array (ids `builtin-*`, e.g. line 90 `id: 'builtin-blur-reveal'`, `name`, then payload). Use ids `builtin-classic`, `builtin-3d-shadow`, `builtin-bold-pop`, `builtin-minimal`, plus up to 2 extras. No imports (stage-backend copies only `backend/src`). Values: RESEARCH "Suggested built-in styles" table. Classic must equal frontend `DEFAULT_STYLE` look keys (subtitleStore.ts:88-105).

---

### `backend/src/services/textStyleStore.ts` (service, CRUD; pure functions over `Database.Database`)

**Analog:** `animationPresets.ts` lines 113-148 (seed/upsert).

**Seed pattern** (copy, adapt columns to `id,name,is_builtin,props,created_at,updated_at`):
```ts
const checkStmt = db.prepare('SELECT id FROM animation_presets WHERE id = ?')
const insertStmt = db.prepare(`INSERT INTO animation_presets (id, name, is_builtin, scope, params, created_at, updated_at) VALUES (?, ?, 1, ?, ?, ?, ?)`)
const updateStmt = db.prepare(`UPDATE animation_presets SET name = ?, scope = ?, params = ?, updated_at = ? WHERE id = ?`)
const now = Date.now()
// Use incrementing timestamps so built-ins sort before user presets (created_at ASC)
for (let i = 0; i < BUILTIN_PRESETS.length; i++) {
  const existing = checkStmt.get(preset.id)
  if (!existing) {
    insertStmt.run(preset.id, preset.name, preset.scope, params,
      now - (BUILTIN_PRESETS.length - i) * 1000,
      now - (BUILTIN_PRESETS.length - i) * 1000)
  } else {
    updateStmt.run(preset.name, preset.scope, params, now, preset.id)
  }
}
```
**Table DDL** (animationPresets.ts:160-170 shape): `CREATE TABLE IF NOT EXISTS ... (id TEXT PRIMARY KEY, name TEXT NOT NULL, is_builtin INTEGER NOT NULL DEFAULT 0, ..., created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`.

**Validation:** no existing validator; `presets.ts` only does `if (!body.name ...) return reply.code(400).send({ error: '...' })`. Follow that response shape but add the allowlist/hex/range rules from RESEARCH Security table. Duplicate allowlist of the 14 keys (backend cannot import runtime from composition) and drift-guard via the test.

---

### `backend/src/services/textStyles.ts` (fp plugin)

**Analog:** `backend/src/services/lanePresets.ts` lines 1-40 (separate DB file, own decorator, WAL, onClose):
```ts
import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import Database from 'better-sqlite3'
import path from 'node:path'
import { DATA_ROOT } from '../index.ts'

declare module 'fastify' {
  interface FastifyInstance { lanePresetsDb: Database.Database }
}

async function lanePresetsPlugin(fastify: FastifyInstance): Promise<void> {
  const dbPath = path.join(DATA_ROOT, 'lane_presets.db')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(`CREATE TABLE IF NOT EXISTS lane_presets (...)`)
  fastify.decorate('lanePresetsDb', db)
  fastify.addHook('onClose', (_instance, done) => {
    db.close()
```
Use `text_styles.db`, decorator `textStylesDb`, call `seedBuiltinTextStyles(db)` from the store module after `db.exec`, end with `export default fp(textStylesPlugin)`. Only this plugin file imports `DATA_ROOT` from `../index.ts`; the store stays import-free so tests can use `:memory:`.

---

### `backend/src/routes/styles.ts` (route, request-response CRUD)

**Analog:** `backend/src/routes/presets.ts` (whole file; 191 lines).

**Imports and prepared statements** (lines 1-3, 54-70):
```ts
import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
...
async function presetsRoutes(fastify: FastifyInstance): Promise<void> {
  const getAllStmt = fastify.db.prepare<[], PresetRow>('SELECT * FROM animation_presets ORDER BY created_at ASC')
  const getByIdStmt = fastify.db.prepare<[string], PresetRow>('SELECT * FROM animation_presets WHERE id = ?')
```
(Use `fastify.textStylesDb`, not `fastify.db`.)

**Row mapper** (39-50): return `{ id, name, isBuiltin: Boolean(row.is_builtin), props: JSON.parse(row.props), createdAt, updatedAt }`.

**Guard/status codes** (PUT 108-115, DELETE 157-164):
```ts
const existing = getByIdStmt.get(id)
if (!existing) return reply.code(404).send({ error: 'Preset not found' })
if (existing.is_builtin === 1) return reply.code(403).send({ error: 'Cannot modify built-in presets' })
```
POST returns `reply.code(201).send(row)`; DELETE returns `{ ok: true }`; duplicate (171-188): `newName = \`${source.name} (Copy)\``, insert with `is_builtin = 0`, 201. Export `export default fp(presetsRoutes)`.

**Registration** in `backend/src/index.ts`: add `await fastify.register(textStylesPlugin)` after `lanePresetsPlugin` (line ~56) and `await fastify.register(stylesRoutes)` after `lanePresetsRoutes` (line ~68). Update the order comment on line 52.

---

### `frontend/src/hooks/useTextStyles.ts` (hook, CRUD + pub-sub)

**Analog:** `frontend/src/hooks/useAnimationPresets.ts` (clone whole file; rename `presets`->`styles`, `/api/presets`->`/api/styles`, error text accordingly).

Key excerpts (lines 4-8, 21-36, 67-82):
```ts
const presetsChanged = new EventTarget()
function notifyPresetsChanged() { presetsChanged.dispatchEvent(new Event('change')) }
...
const [refreshTick, setRefreshTick] = useState(0)
useEffect(() => {
  const handler = () => refresh()
  presetsChanged.addEventListener('change', handler)
  return () => presetsChanged.removeEventListener('change', handler)
}, [refresh])
...
const res = await fetch('/api/presets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preset) })
if (!res.ok) { const text = await res.text(); throw new Error(`Create preset failed (HTTP ${res.status}): ${text}`) }
const created = (await res.json()) as AnimationPreset
notifyPresetsChanged()
return created
```
Type the entity locally (`TextStyle { id, name, isBuiltin, props: LookStyleProps, createdAt, updatedAt }`) or in shared-types as `AnimationPreset` is. Pitfall 9: the Studio must not reset its draft on list refresh.

---

### `frontend/src/components/StylePanel/StyleControls.tsx` (component, value/onChange)

**Analog:** `StylePanel/StylePanel.tsx` (extract; keep class names `style-panel__*`).

**Imports** (lines 1-5):
```ts
import { useState, useRef, useEffect, useCallback } from 'react'
import { HexColorPicker, HexColorInput } from 'react-colorful'
import { FONT_NAMES, getFontFamily, FONT_WEIGHT_OPTIONS } from '@eigen/remotion-composition'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import './StylePanel.css'
```
Move `loadCustomGoogleFont` (7-25), `FontPicker` (77-200) and `ScrubInput` (204-275) out and export them; drop the store import from the new file; import `./StylePanel.css` there too. Add `allowCustomFont?: boolean` (default true) to hide "Other Google Font...". Studio passes `false` (D-08).

**Current store-coupled read pattern to replace** (lines 279-298) with `StyleControls({ value, onChange })`:
```ts
const fontFamily = useSubtitleStore((s) => s.style.fontFamily)
...
const setStyle = useSubtitleStore((s) => s.setStyle)
```
In `StylePanel`, feed `value` from `useSubtitleStore(useShallow((s) => pickLookProps(s.style)))` (`zustand/react/shallow`) and `onChange = setStyle`. Layout controls (words per phrase, max chars, vertical position, lane gap, linger) remain in StylePanel after the controls. Shadow section: add Drop/Extrude toggle; hide Blur and relabel X/Y "Depth X/Y" in extrude; widen X/Y to +/-40 in extrude (existing -20..20 at lines ~442-456); on switch to extrude with both offsets < 3, patch X=8, Y=8.

---

### `frontend/src/components/StylePicker/StylePicker.tsx` (component, request-response)

**Analog:** `FontPicker` in `StylePanel.tsx` lines 77-200 (button + outside-click-closing custom dropdown whose entries are drawn in their own font). Each entry renders the style name with inline `fontFamily`, `fontWeight`, `color`, and `textShadow: buildTextShadow(props)` at a scaled-down size (same code path as renderer). Stateless "Apply style..." menu (no selected value; D-10). Props: `onApply(props: LookStyleProps)`. Data from `useTextStyles()`.

---

### `frontend/src/components/StyleStudio/StyleStudioPage.tsx` (page, CRUD + autosave)

**Analog:** `components/AnimationBuilder/AnimationBuilderPage.tsx`.

**Imports pattern** (lines 1-9): React hooks, `useAnimationPresets` from `../../hooks/...`, co-located `./AnimationBuilderPage.css`. Create `StyleStudioPage.css` likewise (dark tokens from `tokens.css`; co-located CSS, no modules).

**Delete pattern to adapt** (lines 407-420): uses `window.confirm` plus `fetch DELETE`; RESEARCH Pitfall 7 says use an inline two-step "Delete? Confirm / Cancel" instead.
```ts
if (!preset || preset.isBuiltin || saving) return
if (!window.confirm(`Delete "${preset.name}"?`)) return
```
Autosave: debounce ~700 ms of `updateStyle(id, { props })`, status via `AutoSaveIndicator` (`components/AutoSaveIndicator.tsx:4`, `type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'`, prop `{ status }`). Flush on selection change and unmount; only PUT non-built-in ids. Built-ins render controls read-only/disabled with a Duplicate button.

---

### `frontend/src/components/StyleStudio/StylePreview.tsx` (component, static Player)

**Analogs:** `AnimationEditor/AnimationPreview.tsx` (composition wrapper) and `AnimationBuilder/KeyframePreview.tsx` (Player + repaint effect).

**Composition wrapper** (AnimationPreview.tsx:63-80, 8-9 imports):
```tsx
import { Player } from '@remotion/player'
import { AbsoluteFill } from 'remotion'
import { SubtitleOverlay } from '@eigen/remotion-composition'
import type { StyleProps, SpeakerStyleOverride, CompositionPhrase } from '@eigen/remotion-composition'

function PreviewComposition({ preset, style, speakerStyles, phrases }: PreviewCompositionProps) {
  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1a1a' }}>
      <SubtitleOverlay phrases={phrases} style={style} speakerStyles={speakerStyles} animationPreset={preset} />
    </AbsoluteFill>
  )
}
```
Differences: no backgroundColor (backdrop is a wrapper div with CSS dark/light/checkerboard/custom); no animationPreset; define the composition at module level (comment at line 61 notes this); `speakerStyles` must be a stable module-level constant (`const EMPTY_SPEAKER_STYLES = {}`, line 33); layout injected `verticalPosition: 50, laneGap: 8, lingerDuration: 1`; 1920x1080, fps 30, fixed `initialFrame` (~16) so word index 1 is highlighted; sample words built from editable text at 0.5 s each (word shape `{ word, start, end, confidence: 1.0 }`, phrase shape lines 40-52).

**Player props** (KeyframePreview.tsx:470-483): `ref`, `component={X as unknown as React.ComponentType<Record<string, unknown>>}`, `durationInFrames`, `compositionWidth/Height`, `fps`, `style`, `inputProps={... as unknown as Record<string, unknown>}`, `acknowledgeRemotionLicense`. Use `controls={false}`, no `autoPlay`/`loop`.

**Repaint nudge for paused Player** (KeyframePreview.tsx:283-290):
```ts
useEffect(() => {
  if (isPlaying) return
  const player = playerRef.current
  if (!player) return
  const frame = player.getCurrentFrame()
  player.seekTo(frame)
}, [/* deps */])
```
Key it on the draft style props.

---

### `frontend/src/App.tsx` (mod)

**Analog:** itself.
```ts
const TABS = [
  { id: 'projects', label: 'Projects' },
  { id: 'animation-builder', label: 'Animation Builder' },
]
...
{activeTab === 'animation-builder' && <AnimationBuilderPage />}
```
Add `{ id: 'style-studio', label: 'Style Studio' }`, import `StyleStudioPage`, add `{activeTab === 'style-studio' && <StyleStudioPage />}`. Tabs unmount on switch, so flush autosave on unmount.

---

### Apply-style wiring in `GlobalStyleSidePanel.tsx`, `SpeakerStylePanel.tsx`, `PhraseStylePanel.tsx` (mod)

**Analog:** store actions in `store/subtitleStore.ts`.
```ts
setStyle: (partial) => { set((state) => { pushUndo(state); return { style: { ...state.style, ...partial } } }) },   // 724-729
setSpeakerStyle: (speakerId, override) => { set((state) => { pushUndo(state)
  return { speakerStyles: { ...state.speakerStyles, [speakerId]: { ...state.speakerStyles[speakerId], ...override } } } }) },  // 757-767
```
Phrase: `setPhraseStyle(phraseIndex, partial)` (~1211-1226) merges into `styleOverride`. Apply = single call with the 14 look keys; never clear+set. Put the three-call helper and "Save as style" payload (`pickLookProps(getState().style)` POST to `/api/styles`) in `lib/applyStyle.ts` so it is unit-testable in the node env. "Save as style" uses an inline name input (no `window.prompt`). Widen override slider maxima (stroke 4->30, font size 96->200) per Pitfall 6.

---

### Default style literals (mod, add `shadowType: 'drop'`)

Four places: `store/subtitleStore.ts:88-105` (`DEFAULT_STYLE`, export it for the load merge), `remotion-composition/src/Root.tsx` (`DEFAULT_PROPS.style`), `AnimationEditor/AnimationPreview.tsx:14-31` (`PREVIEW_STYLE`), `AnimationBuilder/KeyframePreview.tsx` (`PREVIEW_STYLE`). In `lib/projectState.ts` `loadProjectBlob`, change `style: structuredClone(blob.style)` to `{ ...DEFAULT_STYLE, ...structuredClone(blob.style) }` (Pitfall 3 option c).

---

## Shared Patterns

### Built-in read-only / user CRUD
**Source:** `backend/src/routes/presets.ts` lines 108-115, 157-164 (404 unknown, 403 built-in, `{ ok: true }` on delete, 201 on create/duplicate, `" (Copy)"` suffix).
**Apply to:** `routes/styles.ts`, and UI gating of edit/delete on `isBuiltin` in the Studio.

### Cross-instance refresh
**Source:** `hooks/useAnimationPresets.ts` module-level `EventTarget`.
**Apply to:** `useTextStyles` and every consumer (Studio list, three pickers).

### One renderer for every visual
**Source:** `buildTextShadow` (new `textShadow.ts`) and `LOOK_STYLE_KEYS`.
**Apply to:** `SubtitleOverlay`, `StylePicker` entries, backend allowlist (via drift test). Always test `shadowType === 'extrude'`.

### Backend isolation
**Source:** RESEARCH anti-patterns; `lanePresets.ts` imports only `DATA_ROOT` from `../index.ts`.
**Apply to:** all new backend files: `import type` only from composition/shared-types; no runtime imports.

### Studio isolation from project store
Studio draft is page-local state; never call `useSubtitleStore` setters from the Studio (project auto-save subscribes to every store change, `SubtitlesPage.tsx:601-612`).

### Build order gotcha
After editing `remotion-composition` run `just build-libs` before frontend checks (frontend resolves `dist`). Frontend test command from repo root: `npx vitest run --config packages/frontend/vitest.config.ts` (baseline 5 pre-existing failures in `subtitleStore.test.ts`).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `remotion-composition/src/lookStyle.ts` | utility | transform | No existing pick-by-key-list helper; use RESEARCH shape |
| Style name/props validator in `textStyleStore.ts` | utility | validation | `presets.ts` only has presence checks; implement per RESEARCH Security table (hex regex, ranges, allowlist) |
| Backdrop picker (dark/light/checkerboard/custom) | component | presentation | No existing backdrop control; plain CSS wrapper plus `react-colorful` `HexColorPicker` (already used in StylePanel) |
| Inline name input / two-step delete confirm | component | event-driven | Repo uses `window.confirm` (AnimationBuilderPage.tsx:410); RESEARCH Pitfall 7 recommends inline UI |

## Metadata

**Analog search scope:** `packages/backend/src`, `packages/backend/test`, `packages/frontend/src/{hooks,components,store,lib}`, `packages/remotion-composition/src`, `packages/desktop/vitest.config.ts`
**Files read:** animationPresets.ts (113-170 plus header refs), presets.ts, lanePresets.ts (1-40), index.ts (40-80), useAnimationPresets.ts, App.tsx, SubtitleOverlay.tsx (45-56, 230-241, 425-450), KeyframePreview.tsx (92-115, 270-345, 468-490), AnimationPreview.tsx (1-80), AnimationBuilderPage.tsx (1-20, 400-420), StylePanel.tsx (1-30, 276-300), subtitleStore.ts setters, AutoSaveIndicator.tsx
**Pattern extraction date:** 2026-10-13
