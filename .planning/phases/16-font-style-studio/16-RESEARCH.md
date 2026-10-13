# Phase 16: Font Style Studio - Research

**Researched:** 2026-10-13
**Domain:** React/Zustand frontend + Fastify/better-sqlite3 backend + Remotion subtitle renderer (CSS `text-shadow` extrude)
**Confidence:** HIGH (all findings come from reading this repo; the only external facts are CSS `text-shadow` layering and Remotion Player props, both cited)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Studio Page Layout**
- **D-01:** The studio is a third top-level tab: Projects | Animation Builder | Style Studio. Styles are global, not tied to a project, the same way the Animation Builder works.
- **D-02:** Three-column layout. Left: the style library list. Centre: a large live preview. Right: property controls, reusing the existing StylePanel controls where possible.
- **D-03:** The preview shows editable sample text over a backdrop the user can choose: dark, light, checkerboard or a custom colour. No project or video is needed.
- **D-04:** The preview is static, with one word drawn in the highlight colour so the base and highlight colours are visible at the same time. No looping karaoke playback.

**What a Style Contains**
- **D-05:** A style holds look properties only: fontFamily, fontWeight, fontSize, baseColor, highlightColor, strokeColor, strokeWidth, shadowColor, shadowOffsetX, shadowOffsetY, shadowBlur, the new shadow mode, letterSpacing and wordSpacing. Layout settings are NOT part of a style and stay per-project: verticalPosition, laneGap, lingerDuration and words per phrase. — **Reversibility:** costly — the stored style schema and the apply/save-as code both depend on this field list.
- **D-06:** There is one shadow, with a mode toggle:
  - **Drop** is the current blurred offset shadow.
  - **Extrude** is a solid 3D block with no blur, built from stacked 1px steps from the letter out to (shadowOffsetX, shadowOffsetY). X/Y set the direction and the depth, and blur does not apply.
  - No stackable effect layers.
  - Extrude must render identically in the editor preview and in the final Remotion render. Both use the same `SubtitleOverlay` component.
  - **Reversibility:** costly — this adds a new field to StyleProps, which flows into saved project blobs, speaker/phrase overrides and render props. Older saved projects must default to Drop.
- **D-07:** Extrude uses the existing shadow colour. The outline keeps its own stroke colour. The reference look is reached by setting both to black.
- **D-08:** No new fonts. The existing 26 Google fonts list stays as it is; Archivo Black and Anton approximate the reference closely enough.

**Applying Styles to Video**
- **D-09:** A saved style can be applied at all three existing levels: global style, per-speaker override, per-phrase override. A style picker appears in the Global Style panel and in the speaker and phrase override panels.
- **D-10:** Applying a style copies its values into the project's style or override. There is no link back: later edits to the style in the studio do NOT change projects that already used it. This matches how project state is persisted today (Phase 13).
- **D-11:** The Global Style panel gets a **"Save as style"** button. It saves the project's current look properties (per D-05) as a new named style in the library.
- **D-12:** The editor's picker is a compact dropdown. Each entry shows the style's name drawn in that style.

**Built-in Presets & Library**
- **D-13:** Ship a small curated set of about 4-6 built-in styles. Must include: **3D Shadow** (heavy block font, thin black outline, black extrude down-right), **Classic** (current default: white text, black outline), **Bold Pop** (yellow highlight, thick outline), **Minimal** (no outline, soft drop shadow). Claude may add 1-2 more.
- **D-14:** Built-ins are read-only, like built-in animation presets: they can't be edited or deleted. "Duplicate" creates an editable copy.
- **D-15:** User styles support New, Rename, Duplicate and Delete. Delete asks for confirmation. No import/export and no favourites or reordering.
- **D-16:** Studio edits auto-save after a short pause, like projects (Phase 13 D-04). There is no Save button.

### Claude's Discretion
- Exact field name and shape for the shadow mode (e.g. `shadowType: 'drop' | 'extrude'`) and how many extrude steps to cap at for performance
- SQLite schema and API routes for style storage, following the animation preset service pattern
- Exact parameters for the built-in styles and names for any extra 1-2 built-ins
- Backdrop picker UI and default sample text
- How the Shadow controls change in Extrude mode (e.g. hide or disable Blur, relabel X/Y as direction/depth)
- Placement of "Save as style" and the naming prompt UX

### Deferred Ideas (OUT OF SCOPE)
- Stackable effect layers (multiple outlines, shadows and extrudes): considered and rejected for this phase
- Separate extrude colour, independent of the shadow colour
- Additional fonts (Bowlby One, Rubik Mono One, Titan One) or custom font file uploads
- Linked styles that propagate studio edits to projects, or a "re-sync from style" button
- Import/export of styles as JSON; favourites and reordering
- Previewing styles on a frame from a real project video, and looping karaoke playback in the studio preview
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs are mapped to this phase (ROADMAP: "Requirements: TBD"). Coverage is derived from the CONTEXT.md decisions D-01..D-16; see the per-decision map in `## Validation Architecture`.
</phase_requirements>

## Project Constraints (from CLAUDE.md)

No `CLAUDE.md` or `.claude/CLAUDE.md` exists in the repo (`.claude/` holds only `settings.local.json` and `worktrees`), and there is no `.claude/skills/` or `.agents/skills/`. [VERIFIED: directory listing this session]

Carried-over directives that do apply:
- **User memory:** use `uv` (not pip/venv) for any Python dependency management. This phase has no Python work, so the rule is moot but must not be violated.
- **Project conventions to follow (from STATE.md decisions):** co-located `.css` per component, not CSS modules (01-03); dark mode only, using tokens from `tokens.css` (08-02); the Remotion composition must stay a pure props-driven function with no `Date.now()` or API calls (Pre-build); `remotion` packages pinned exactly at 4.0.379 (03-01); a stale `dist` of `remotion-composition` hides source changes from the frontend (06-01, see Pitfall 1).

## Summary

The phase has two independent halves. **(1) Renderer:** add a `shadowType: 'drop' | 'extrude'` mode to `StyleProps`. `SubtitleOverlay` builds one `textShadow` string per phrase from a stroke ring plus a drop shadow. Extrude replaces the blurred drop shadow with stacked 1px-step, zero-blur shadows from `(0,0)` out to `(shadowOffsetX, shadowOffsetY)`. The preview and the final render use the same component, so they cannot diverge, but they consume it from different build outputs (see Pitfall 1). **(2) Library and UI:** a global SQLite-backed "text style" library, built exactly like the animation-preset service (read-only built-ins seeded and upserted on boot, CRUD routes, a hook with an `EventTarget` pub-sub). A new Style Studio tab hosts it, and style pickers and "Save as style" are added to the editor panels.

Three facts shape the plan. First, `StylePanel.tsx` couples look controls (font, colours, stroke, shadow, spacing) and layout controls (words per phrase, max chars, vertical position, lane gap, linger) to `useSubtitleStore`, and `FontPicker`/`ScrubInput` are file-private. A presentational `StyleControls` (value plus onChange) has to be extracted so the Studio and the editor share one implementation. Second, the speaker and phrase override panels are opt-in per-field checkbox UIs with no shadow controls at all, and with narrower slider ranges than the global panel. Applying a style there means merging all 14 look keys into the override (the store's `setSpeakerStyle`/`setPhraseStyle` already merge) while leaving layout overrides such as `verticalPosition` untouched. Third, `loadProjectBlob` does `structuredClone(blob.style)` with no default merge, so a project saved before this phase has no `shadowType`. Every reader must therefore treat `undefined` as `'drop'`.

No new npm packages are needed. All work uses libraries already in the repo (React 18, Zustand 5.0.12, react-colorful, Remotion Player 4.0.379, better-sqlite3, Fastify 4, vitest 4.1.2).

**Primary recommendation:** Build the pure shadow-string function (`textShadow.ts`) and a pure look-style module (`lookStyle.ts`) in `remotion-composition` first, with vitest tests. Everything else (backend store, hook, Studio page, editor pickers) depends on those two modules and on the `shadowType` field, so land them in Wave 1.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Extrude/drop text-shadow generation | Remotion composition (`SubtitleOverlay`, shared) | — | The same component drives the editor Player and the server render, so there is no second implementation. |
| `shadowType` field and default | Remotion composition types (`StyleProps`) | Frontend store defaults, persisted blob | The field flows into project blobs, overrides and render props. |
| Style library persistence (CRUD, built-in seed, validation) | API / Backend (Fastify + SQLite) | — | Global across projects, survives reinstall in `DATA_ROOT`, same as animation presets. |
| Style library client cache and mutation | Browser (hook with `EventTarget` pub-sub) | — | Mirrors `useAnimationPresets`; every picker instance refreshes after any mutation. |
| Studio draft editing and debounced auto-save | Browser (page-local state) | Backend PUT | The draft must not touch `useSubtitleStore`, or it would pollute project undo and auto-save. |
| Apply style to project (copy semantics, D-10) | Browser (`setStyle` / `setSpeakerStyle` / `setPhraseStyle`) | — | Copying into existing store actions needs no new persistence. The Phase 13 blob already carries it. |
| Static preview | Browser (Remotion `Player` at fixed `initialFrame`) | Remotion composition | Reuses `SubtitleOverlay`, which is required for D-06 parity. |
| Backdrop (dark, light, checkerboard, custom) | Browser (CSS on a wrapper div) | — | Pure presentation. Keep the Player background transparent. |
| Final render with extrude | Backend render worker (Remotion bundle) | Desktop prebuilt bundle | `style` is passed straight through to `inputProps`. The packaged app uses a prebuilt bundle (Pitfall 2). |

## Standard Stack

### Core (all already installed; no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| remotion / @remotion/player | 4.0.379 (exact pin) | `SubtitleOverlay` + static preview Player | Already the renderer for preview and render [VERIFIED: packages/frontend/package.json, node_modules/@remotion/player/package.json:6] |
| react / react-dom | ^18.3.1 | UI | Existing |
| zustand | 5.0.12 | Project store; `useShallow` from `zustand/react/shallow` for look-field selection | `node_modules/zustand/react/shallow.js` present [VERIFIED: `ls node_modules/zustand/react/`] |
| react-colorful | ^5.6.1 | Colour pickers (already in StylePanel) | Existing |
| fastify | ^4.28.0 + fastify-plugin | Style routes/plugin | Same pattern as presets/lanePresets [VERIFIED: packages/backend/package.json] |
| better-sqlite3 | ^12.11.1 | Style table | Loads in plain Node, so in-memory DB tests are possible [VERIFIED: `node -e` opened `:memory:` DB this session] |
| vitest | 4.1.2 | Unit tests | Used by frontend, backend and desktop [VERIFIED: ran all three this session] |

### Supporting
None. Do not add a UI library; the app uses hand-written components with co-located CSS.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `styles` SQLite file + `fastify.textStylesDb` decorator | New table inside `presets.db` via the existing `fastify.db` | A table in the existing DB is less code, but `lanePresets` set the precedent of one DB file and one decorator per feature. Recommend the separate file (`text_styles.db`) for consistency and to avoid coupling to the animation plugin's lifecycle. Either works. |
| Native `<select>` for the editor picker | Custom button-list dropdown (FontPicker pattern) | D-12 needs the name drawn in its style; `<option>` can't render stroke or extrude. Use the custom dropdown. |
| `window.prompt()` for style naming | Inline name input | Electron does not support `window.prompt()` [ASSUMED, from Electron docs; confirm in the Phase 15 desktop build]. Use an inline input. |

**Installation:** none (`# no new dependencies`).

**Version verification:** Not applicable: no package is added. Versions above were read from the repo's installed `package.json` files this session.

## Package Legitimacy Audit

No external packages are installed in this phase, so the legitimacy gate does not apply.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                       +-------------------------- Backend (Fastify, :3001) --------------------------+
                       |  textStyles plugin  --> text_styles.db (SQLite, DATA_ROOT)                      |
                       |    boot: CREATE TABLE IF NOT EXISTS; upsert built-ins (id builtin-*)             |
                       |  routes: GET/POST /api/styles, PUT/DELETE /api/styles/:id, POST .../duplicate    |
                       |    validate props (D-05 keys, hex colours, ranges); 403 on built-in mutate       |
                       +--------------------------^-------------------------------------+----------------+
                                                  | JSON                                  | /api/jobs/:id/render
                                                  |                                       |  (style passed through
                       +--------------------------+--------------+                         |   unvalidated)
                       |  useTextStyles hook (list + CRUD +      |                         v
                       |  EventTarget refresh across instances)  |            Remotion render worker
                       +---+---------------------------+---------+            (bundle of remotion-composition/src
                           |                           |                       or prebuilt REMOTION_BUNDLE_DIR)
        STUDIO TAB         |                           |   EDITOR (Projects tab)             ^
  +------------------------v--------+      +-----------v---------------------------+         |
  | StyleStudioPage                 |      | StylePicker (custom dropdown, name drawn|        |
  |  left : StyleLibraryList        |      |  in its style) in:                      |        |
  |  centre: StylePreview (Player,  |      |   StylePanel (global)  --> setStyle()   |        |
  |          fixed initialFrame,    |      |   SpeakerSection       --> setSpeakerStyle(id)    |
  |          backdrop wrapper div)  |      |   PhraseStylePanel     --> setPhraseStyle(idx)    |
  |  right : StyleControls (value,  |      | "Save as style" (global) --> POST /api/styles     |
  |          onChange)  <-- shared -+------+--> same StyleControls also used by StylePanel      |
  |  draft state --debounce--> PUT  |      +-----------+---------------------------+         |
  +----------------+----------------+                  | copy of 14 look keys (D-10)         |
                   |                                   v                                     |
                   |                     useSubtitleStore (style / speakerStyles / phrase    |
                   |                     styleOverride) --> Phase 13 blob --> projects.db    |
                   |                                   |                                     |
                   +-----------------------------------+-------> SubtitleOverlay (shared) ---+
                                                                 buildTextShadow(effectiveStyle)
                                                                  stroke ring (16 steps, radius = strokeWidth*2)
                                                                  + drop: "x y blur color"        (default / undefined)
                                                                  | extrude: 1px steps (0,0)->(X,Y), blur 0
```

### Recommended Project Structure

```
packages/remotion-composition/
├── src/
│   ├── types.ts            # + ShadowType, StyleProps.shadowType?
│   ├── textShadow.ts       # NEW pure: buildStrokeShadow, buildExtrudeShadow, buildTextShadow
│   ├── lookStyle.ts        # NEW pure: LOOK_STYLE_KEYS, LookStyleProps, pickLookProps, DEFAULT_LOOK_STYLE
│   ├── SubtitleOverlay.tsx # uses buildTextShadow
│   ├── Root.tsx            # DEFAULT_PROPS.style gets shadowType
│   └── index.ts            # export the new pure functions/types
├── test/                   # NEW (outside tsc rootDir "src", so tests are not emitted to dist)
│   └── textShadow.test.ts, lookStyle.test.ts
└── vitest.config.ts        # NEW (copy packages/desktop/vitest.config.ts shape) + "test" script
packages/backend/
├── src/services/textStyleStore.ts      # NEW pure: seed/list/create/update/delete/duplicate/validate (takes a Database)
├── src/services/textStyleDefaults.ts   # NEW pure data: BUILTIN_TEXT_STYLES (no imports)
├── src/services/textStyles.ts          # NEW fp plugin: opens DB, decorates fastify.textStylesDb, seeds
├── src/routes/styles.ts                # NEW thin routes over textStyleStore
└── test/textStyleStore.test.ts         # NEW (:memory: DB; also imports fonts.ts + lookStyle.ts by relative path)
packages/frontend/src/
├── hooks/useTextStyles.ts              # NEW (mirror useAnimationPresets)
├── components/StylePanel/StyleControls.tsx  # NEW extracted: StyleControls, FontPicker, ScrubInput
├── components/StylePanel/StylePanel.tsx     # now = StyleControls + layout section + picker/Save-as
├── components/StylePicker/StylePicker.tsx   # NEW custom dropdown
└── components/StyleStudio/                  # NEW StyleStudioPage, StyleLibraryList, StylePreview (+ .css each)
```

### Pattern 1: Pure shadow builder (the extrude)

**What:** Move the `textShadow` composition out of the JSX into a pure function so it is unit-testable and reusable by the editor picker's tiny previews.
**When to use:** `SubtitleOverlay` (per phrase, replacing lines 440-445) and the StylePicker entries.

The current code, quoted verbatim [VERIFIED: packages/remotion-composition/src/SubtitleOverlay.tsx:440-445]:

```ts
// Pre-compute stroke shadow (shared across all words in phrase)
const strokeShadow = hasStroke
  ? generateStrokeShadow(effectiveStyle.strokeWidth * 2, effectiveStyle.strokeColor)
  : ''
const dropShadow = `${effectiveStyle.shadowOffsetX ?? 0}px ${effectiveStyle.shadowOffsetY ?? 2}px ${effectiveStyle.shadowBlur ?? 4}px ${effectiveStyle.shadowColor ?? '#000000'}`
const combinedShadow = strokeShadow ? `${strokeShadow},${dropShadow}` : dropShadow
```

Proposed shape (illustrative; field names in code examples are limited to those quoted above plus the new `shadowType`):

```ts
// textShadow.ts — pure, no react/remotion imports
export const MAX_EXTRUDE_STEPS = 64

export function buildExtrudeShadow(x: number, y: number, color: string): string {
  const n = Math.min(MAX_EXTRUDE_STEPS, Math.ceil(Math.max(Math.abs(x), Math.abs(y))))
  if (n <= 0) return ''
  const parts: string[] = []
  for (let i = 1; i <= n; i++) {
    parts.push(`${((x * i) / n).toFixed(2)}px ${((y * i) / n).toFixed(2)}px 0 ${color}`)
  }
  return parts.join(',')
}

export function buildTextShadow(s: {
  strokeWidth: number; strokeColor: string
  shadowType?: 'drop' | 'extrude'
  shadowOffsetX?: number; shadowOffsetY?: number; shadowBlur?: number; shadowColor?: string
}): string {
  const stroke = s.strokeWidth > 0 ? buildStrokeShadow(s.strokeWidth * 2, s.strokeColor) : ''
  const second = s.shadowType === 'extrude'
    ? buildExtrudeShadow(s.shadowOffsetX ?? 0, s.shadowOffsetY ?? 0, s.shadowColor ?? '#000000')
    : `${s.shadowOffsetX ?? 0}px ${s.shadowOffsetY ?? 2}px ${s.shadowBlur ?? 4}px ${s.shadowColor ?? '#000000'}`
  return stroke && second ? `${stroke},${second}` : stroke || second
}
```

Why this ordering: CSS paints the first shadow on top ("shadows are applied front-to-back, with the first-specified shadow on top") [CITED: developer.mozilla.org/en-US/docs/Web/CSS/text-shadow]. Stroke first keeps the outline over the extrusion; zero blur is valid and is the default when omitted [CITED: same page]. Fractional px offsets are valid `<length>` values.

`=== 'extrude'` (not `!== 'drop'`) is deliberate: `undefined` from an old blob or a `Partial` override falls to the drop path with no extra code.

### Pattern 2: Backend store as pure functions over a `Database`

**What:** Put seed/list/create/update/delete/duplicate/validate in `textStyleStore.ts` taking a `Database.Database`. The plugin and routes become thin wrappers. This lets vitest use `new Database(':memory:')` and avoids importing `../index.ts`, which starts the server and exports `DATA_ROOT` (the existing plugins import it from there).
**Source:** mirrors `animationPresets.ts` seed-upsert logic (`SELECT id` / `INSERT` / `UPDATE`, staggered `created_at` so built-ins sort first). [VERIFIED: packages/backend/src/services/animationPresets.ts:111-148]

Suggested table (discretion):

```sql
CREATE TABLE IF NOT EXISTS text_styles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  props TEXT NOT NULL,          -- JSON of exactly the D-05 look keys
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
```

Routes (all JSON; response row mapper returns `{ id, name, isBuiltin, props, createdAt, updatedAt }`):
`GET /api/styles`, `POST /api/styles {name, props}` (201), `PUT /api/styles/:id {name?, props?}` (404 unknown, 403 built-in), `DELETE /api/styles/:id` (404 / 403 built-in), `POST /api/styles/:id/duplicate` (copy named `"<name> (Copy)"`, `is_builtin = 0`). Same status codes as `presets.ts`. [VERIFIED: packages/backend/src/routes/presets.ts:73-188]

Register `textStylesPlugin` before the routes in `index.ts` next to the other plugins (`registerplugins` block at lines 53-59; routes at 62-72). [VERIFIED: grep of packages/backend/src/index.ts]

### Pattern 3: Presentational `StyleControls` extraction

**What:** `StyleControls({ value: LookStyleProps, onChange: (patch: Partial<LookStyleProps>) => void, allowCustomFont?: boolean })` containing: font picker, weight buttons, font size, highlight colour, base colour, stroke width + colour (when width > 0), shadow mode toggle, shadow X/Y (+ blur in drop mode), shadow colour, letter spacing, word spacing. `StylePanel` becomes: picker + Save-as, `StyleControls` fed from the store, then the layout section (words per phrase, max chars, vertical position, lane gap, linger).
**Why:** StylePanel currently reads each field with its own selector [VERIFIED: StylePanel.tsx:279-298] and writes via `setStyle`; `FontPicker` (lines 77-200) and `ScrubInput` (lines 204-275) are not exported.
**Re-render guard:** the 06-02 decision used per-field selectors to limit re-renders during colour drags. In `StylePanel`, select the look slice with `useShallow((s) => pickLookProps(s.style))` from `zustand/react/shallow` to keep that property.
**Section order caveat:** today "Words per phrase" and "Max chars per line" sit between font size and highlight colour. After extraction either accept the reordering (layout after look) or give `StyleControls` an `afterSize?: ReactNode` slot. The planner should choose one; reordering is the simpler option.
**CSS:** the `style-panel__*` classes live in `StylePanel.css` and are imported only by `StylePanel.tsx`; the extracted component must import that CSS itself so the Studio gets it.

### Pattern 4: Static preview with the real overlay

**What:** `Player` with `compositionWidth=1920`, `compositionHeight=1080`, `fps=30`, `controls={false}`, not auto-playing, a fixed `initialFrame` that lands inside a chosen word, `acknowledgeRemotionLicense`, container responsive via `style={{ width: '100%' }}`. `initialFrame` "Start the playback from a specific frame. Default 0", and cannot change after mount [CITED: remotion.dev/docs/player/api]. So derive sample words with fixed timing (e.g. word *i* at `i*0.5s`) and pick one fixed frame (about frame 16, about 0.53 s) so word index 1 is active. Render words from the editable sample text. Single-word text then highlights its only word, which is acceptable.
**Why 1920x1080, not the 640x200 of `AnimationPreview`:** `fontSize`, `strokeWidth` and extrude depth are absolute px in composition space. A 90 px font inside a 200 px-tall composition would not show how it looks in a real 1080p render. The existing `PREVIEW_STYLE` copies use 24-36 px fonts for that reason.
**Layout fields for the preview:** inject a fixed layout (`verticalPosition: 50`, `laneGap: 8`, `lingerDuration: 1`) around the library style. Layout is not part of a style (D-05).
**Backdrop:** wrap the Player in a div; set `AbsoluteFill` with no `backgroundColor` so the wrapper's CSS shows through. Checkerboard via CSS `background-image` gradients. Dark/light/custom via `background-color`.
**Live update while paused:** `KeyframePreview.tsx` already needed `player.seekTo(player.getCurrentFrame())` in an effect to force a re-render of a paused Player after prop changes [VERIFIED: packages/frontend/src/components/AnimationBuilder/KeyframePreview.tsx:283-290]. Verify early whether the studio preview updates on edit; if not, apply the same effect keyed on the draft style.

### Pattern 5: Applying a style (copy semantics, D-10)

| Level | Call | Notes |
|-------|------|-------|
| Global | `setStyle(lookProps)` | One undo snapshot (`pushUndo`). [VERIFIED: subtitleStore.ts:724-729] |
| Speaker | `setSpeakerStyle(speakerId, lookProps)` | Store action merges: `{ ...state.speakerStyles[speakerId], ...override }`. Layout overrides (e.g. a speaker `verticalPosition`) survive. [VERIFIED: subtitleStore.ts:757-767] |
| Phrase | `setPhraseStyle(phraseIndex, lookProps)` | Merges into `styleOverride`. [VERIFIED: subtitleStore.ts:1211-1226] |

Never `clearX` then `setX` for apply: that takes two undo snapshots and drops layout overrides.

### Pattern 6: Studio auto-save (D-16)

Hold the draft in page-local state, not in the library list returned by the hook. Debounce a `PUT /api/styles/:id` (about 600-800 ms; Phase 13 uses 4 s for projects, a shorter pause suits a small JSON). Reuse `AutoSaveIndicator` (`'idle' | 'saving' | 'saved' | 'error'`). [VERIFIED: packages/frontend/src/components/AutoSaveIndicator.tsx:4-9] Flush any pending save when the selection changes and on unmount (tab switch unmounts the page, because `App.tsx` renders tabs conditionally). Do not overwrite the draft with the PUT response while the user is still editing.

### Anti-Patterns to Avoid
- **Reading `shadowType` anywhere as `!== 'drop'`:** an undefined legacy value would flip to extrude. Always test `=== 'extrude'`.
- **Studio writing to `useSubtitleStore`:** pollutes project undo history and triggers project auto-save (the auto-save subscribes to every store change, SubtitlesPage.tsx:601-612).
- **Backend importing runtime code from `remotion-composition`/`shared-types`:** `stage-backend.mjs` copies only `packages/backend/src` into the packaged app (`fs.cpSync(path.join(backendSrcRoot, 'src'), ...)`), so such an import would break the installer. Backend files may only import `import type` from those packages (current practice). Keep built-in data self-contained in backend `src`, and use tests (outside `src`) to cross-check against the composition sources.
- **Linking applied styles back to a library entry:** D-10 forbids it. The picker is a stateless "Apply style..." action menu with no selected-value state.
- **A `Save` button in the Studio:** D-16.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Built-in read-only styles with idempotent seeding | New seeding scheme | The `animationPresets.ts` seed/upsert pattern (check-id, insert, else update, staggered timestamps) | Already handles redefinition of built-ins across releases |
| Style CRUD client state | New fetch/cache layer | Clone `useAnimationPresets` (refreshTick + module-level `EventTarget`) | All pickers refresh after any mutation |
| Colour picking, font picking, scrub numbers | New widgets | Extracted `HexColorPicker`/`HexColorInput`, `FontPicker`, `ScrubInput` | Already tuned (drag to scrub, Shift fine control) |
| Auto-save status UI | New toast | `AutoSaveIndicator` | Existing states |
| Text-shadow rendering of the preview | A second CSS renderer for the Studio | `SubtitleOverlay` inside a Player | D-06 parity requirement |
| Picker entry thumbnails | Canvas/SVG rasteriser | `buildTextShadow(style)` applied as inline `textShadow` at a scaled-down size | Same code path as the real render |

**Key insight:** The risk here is not building the UI; it is a second implementation of "what a style looks like" drifting from the renderer. Every visual representation (preview, picker entry) must call the same `buildTextShadow` and the same field list (`LOOK_STYLE_KEYS`).

## Runtime State Inventory

Not a rename/refactor/migration phase. Summary of persisted state this phase touches, since it adds a field to saved data:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `projects.db` `state_json` blobs contain `style` and `speakerStyles`, and phrase `styleOverride`; none has `shadowType`. | **No migration.** Treat `undefined` as `'drop'` at every reader. Optionally merge defaults on load (see Pitfall 3). |
| Live service config | None. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None. | None. |
| Build artifacts | `packages/remotion-composition/dist` (frontend consumes it) and the desktop prebuilt Remotion bundle `build/remotion-bundle` (used for packaged renders). | Rebuild libs for dev (`just build-libs`); re-run desktop `prebuild` for packaged builds (Pitfalls 1-2). |

## Common Pitfalls

### Pitfall 1: Stale `dist` of `remotion-composition` makes the editor preview differ from the render
**What goes wrong:** The frontend resolves `@eigen/remotion-composition` via `main: dist/index.js` (no Vite alias; `vite.config.ts` only sets host/port/proxy), while the server render bundles `remotion-composition/src/remotion-entry.ts` from source. Edit `SubtitleOverlay.tsx` without rebuilding and the editor and Studio show no extrude while the render does (or the reverse).
**How to avoid:** Run `just build-libs` (`tsc --build` for `shared-types` and `remotion-composition`) after every composition change; `just dev` does this automatically. Put it in plan verification steps.
**Warning signs:** Extrude visible in a rendered MP4 but not in the Player, or a TS error that `shadowType` does not exist on `StyleProps` in the frontend only. [VERIFIED: remotion-composition package.json `main`/`exports`, justfile `build-libs`, STATE.md 06-01]

### Pitfall 2: Packaged desktop render uses a prebuilt Remotion bundle
**What goes wrong:** In the packaged app `render.ts` uses `REMOTION_BUNDLE_DIR` (`prebuilt`), built by `scripts/build-remotion-bundle.mjs` during `npm run prebuild`. A packaged build made before this change renders drop-only.
**How to avoid:** Note in the plan that the final UAT of a *packaged* render requires a fresh `npm run prebuild`; dev-mode UAT does not. [VERIFIED: packages/backend/src/services/render.ts:30-34, packages/desktop/package.json `prebuild`]

### Pitfall 3: Old blobs have no `shadowType`, and load does not merge defaults
**What goes wrong:** `loadProjectBlob` sets `style: structuredClone(blob.style) as unknown as StyleProps` [VERIFIED: packages/frontend/src/lib/projectState.ts, `loadProjectBlob`], so a pre-phase project loads a style with no `shadowType`. CONTEXT's note that blobs load "with spread syntax" is true for the optional top-level fields but not for `style`.
**How to avoid:** (a) renderer and UI always treat undefined as `'drop'` (`=== 'extrude'`); (b) in `pickLookProps`, fill a missing mode with `'drop'` so "Save as style" and apply never write `undefined`; (c) optionally change load to `{ ...DEFAULT_STYLE, ...blob.style }` (export `DEFAULT_STYLE`, currently module-private at subtitleStore.ts:88). Option (c) also hardens other future fields; recommended, with a regression test.
**Warning signs:** Toggle shows neither state selected on an old project.

### Pitfall 4: Extrude geometry vs the existing outline
**What goes wrong:** The outline ring radius is `strokeWidth * 2` (line 442 above), not `strokeWidth`. A "thin 1.5-2 px outline" per CONTEXT therefore means `strokeWidth` 1 to 1.5 (radius 2-3 px). The extrusion starts at the glyph edge, so the first `radius` px of extrude sit under the outline. With stroke and shadow colours both black (D-07) this merges seamlessly, which is the reference look. With different colours, the far end of the extrusion has no outline.
**How to avoid:** Accept the glyph-anchored extrusion (it is what the seed and D-06 specify). Order the shadow list stroke first, then extrude. Choose the built-in 3D Shadow depth well above the stroke radius (about 10 px at 90 px font size). Tune against `ref-3d-extrude-shadow.png` in UAT.

### Pitfall 5: Shadow count and ranges
**What goes wrong:** Each word span gets one `textShadow` of 16 stroke entries plus N extrude entries. Current X/Y inputs allow only -20..20 (StylePanel.tsx:442-456), so a 20 px extrude is about 36 entries per word; unbounded hand-edited values would explode it.
**How to avoid:** Clamp `n` to `MAX_EXTRUDE_STEPS` (64) in the pure function regardless of stored value. In extrude mode widen the X/Y control range to about +/-40 (about 40 px depth is already very deep at 90 px font size). Step is at most 1 px along the dominant axis, so there are no gaps on glyph strokes of 3 px or more. [ASSUMED: gap-free claim is geometric reasoning, to be confirmed visually in UAT at small stroke thickness (Archivo Black stems are far thicker).]

### Pitfall 6: Speaker and phrase override panels hide most of what apply writes
**What goes wrong:** Those panels show opt-in checkboxes for font, size, colours, stroke width/colour, letter/word spacing and vertical position. There are no shadow controls. After "apply style" the override holds 14 keys, including shadow fields the user cannot see or clear individually (only "Clear all overrides"). Slider ranges are narrower than global: stroke max 4 vs 30 (SpeakerStylePanel.tsx:235 vs StylePanel.tsx:407), font size max 96 vs 200. A "Bold Pop" thick outline (over 4 px) shows a slider pinned at max though the value is correct.
**How to avoid:** Widen the override slider maxima to match the global ranges (cheap, avoids a misleading UI) and note that shadow fields are intentionally apply-only at these levels. Do not expand the override panels into full StyleControls; that is out of scope.

### Pitfall 7: `window.prompt` / `window.confirm` in Electron
**What goes wrong:** Electron does not implement `window.prompt()` [ASSUMED]. `window.confirm` works, and `AnimationBuilderPage.tsx:410` already uses `window.confirm(`Delete "${preset.name}"?`)`, but a known Electron issue on Windows can leave inputs unfocusable after a native dialog [ASSUMED, from Electron issue tracker memory].
**How to avoid:** Use inline UI: an inline name input for New / Rename / Save-as, and a two-step inline "Delete? Confirm / Cancel" for D-15. `DeleteConfirmDialog` is project-specific (hard-coded "Delete Project?" text), so it cannot be reused as is.

### Pitfall 8: Custom Google fonts break saved styles
**What goes wrong:** `FontPicker` includes "Other Google Font..." which loads a `<link>` at runtime in the current browser session only. A saved style referencing such a font falls back after reload and never exists in the server render bundle.
**How to avoid:** D-08 says no new fonts. Add an `allowCustomFont` prop (default true to keep the Global panel unchanged) and pass `false` in the Studio. `saveAsStyle` from a project that uses a custom font should still work (it just copies the string), but the plan should surface a one-line note or accept the limitation.

### Pitfall 9: Autosave races
**What goes wrong:** Debounced PUT in flight when the user selects another style, renames, or leaves the tab; list refetch after a mutation resets a controlled draft; out-of-order PUT responses.
**How to avoid:** Single draft state per selected id; flush on id change/unmount; ignore PUT responses for ids that are no longer selected; never reset the draft from a list refresh while its id is still selected; only ever PUT non-built-in ids.

### Pitfall 10: Pre-existing failing tests and a quirky test command
**What goes wrong:** `cd packages/frontend && npx vitest run` reports "No test files found" because `vitest.config.ts` sets `root: './packages/frontend'` relative to cwd. Run from the repo root with `--config packages/frontend/vitest.config.ts`. Also, 5 tests in `subtitleStore.test.ts` (bulk actions: `mergePhrases` x2, `deletePhrases` x2, `duplicatePhrase`) fail on a clean tree before this phase. [VERIFIED: ran both this session; 78 pass / 5 fail]
**How to avoid:** Record that baseline in the plan so executors do not chase or "fix" unrelated failures, and gate on "no new failures".

## Code Examples

### StyleProps field list (the D-05 source of truth)

[VERIFIED: packages/remotion-composition/src/types.ts:3-21]

```ts
export interface StyleProps {
  highlightColor: string   // e.g. '#FFFF00'
  baseColor: string        // e.g. '#FFFFFF'
  fontSize: number         // px
  fontFamily: string
  fontWeight: number       // CSS font-weight: 300-900
  strokeColor: string      // e.g. '#000000' — outline color for text stroke
  strokeWidth: number      // px — 0 means no stroke
  shadowColor: string      // e.g. '#000000' — text shadow color
  shadowOffsetX: number    // px — horizontal shadow offset
  shadowOffsetY: number    // px — vertical shadow offset
  shadowBlur: number       // px — shadow blur radius (0 = sharp)
  letterSpacing: number    // px — kerning between letters (CSS letter-spacing)
  wordSpacing: number      // px — extra spacing between words (CSS word-spacing)
  verticalPosition: number // 0-100 percentage from top of frame
  lingerDuration: number   // seconds a phrase stays visible after last word ends
  laneGap: number          // percentage points between simultaneous speaker lanes
}
```

Phase change: add `export type ShadowType = 'drop' | 'extrude'` and `shadowType?: ShadowType` to `StyleProps` (optional so legacy blobs and `Partial` overrides stay type-correct; the field name is Claude's discretion). Set `shadowType: 'drop'` explicitly in every default literal. Those literals are: `DEFAULT_STYLE` (subtitleStore.ts:88-105), `Root.tsx` `DEFAULT_PROPS.style`, `AnimationPreview.tsx` `PREVIEW_STYLE`, `KeyframePreview.tsx` `PREVIEW_STYLE`. [VERIFIED: grep for `shadowBlur` returns exactly these four files plus StylePanel/types/SubtitleOverlay]

### Look-style module

```ts
// lookStyle.ts — pure
export const LOOK_STYLE_KEYS = [
  'fontFamily','fontWeight','fontSize','baseColor','highlightColor',
  'strokeColor','strokeWidth','shadowColor','shadowOffsetX','shadowOffsetY',
  'shadowBlur','shadowType','letterSpacing','wordSpacing',
] as const   // exactly the 14 keys in D-05
export type LookStyleProps = Required<Pick<StyleProps, typeof LOOK_STYLE_KEYS[number]>>
export function pickLookProps(s: Partial<StyleProps>): LookStyleProps { /* copy keys; shadowType ?? 'drop' */ }
```

### Font family strings

`getFontFamily(name)` returns `FONTS[name].fontFamily` [VERIFIED: packages/remotion-composition/src/fonts.ts, `getFontFamily`]. The family strings in the installed Google-font modules are `'Archivo Black'`, `'Lilita One'`, `'Anton'` [CITED: grep of node_modules/@remotion/google-fonts/dist/cjs/ArchivoBlack.js:6,25, LilitaOne.js:6,25, Anton.js:6,27]. `DEFAULT_STYLE.fontFamily` is `getFontFamily('LilitaOne')` (subtitleStore.ts:91). Backend built-ins must use the literal family strings. A backend test must assert every built-in `fontFamily` equals `getFontFamily(n)` for some `n` in `FONT_NAMES`. I confirmed that vitest can import `../../remotion-composition/src/fonts.ts` from `packages/backend/test` under plain Node (probe test passed with `FONT_NAMES.length === 26`).

### Suggested built-in styles (starting values; tune visually)

All use `shadowBlur`/`shadowType` as shown; spacing 0 unless noted. Treat numbers as proposals for UAT, not verified designs.

| Name | Font / weight / size | base / highlight | Stroke | Shadow |
|------|----------------------|------------------|--------|--------|
| **Classic** (= current `DEFAULT_STYLE`) | Lilita One / 400 / 90 | #FFFFFF / #FFFF00 | #000000, 7.5 | drop, #000000, 0/2, blur 4 |
| **3D Shadow** | Archivo Black / 400 / 90 | #FFFFFF / #FFD60A | #000000, 1.5 (radius 3 px) | **extrude**, #000000, X 10, Y 10, blur 0 |
| **Bold Pop** | Montserrat / 900 / 90 | #FFFFFF / #FFE600 | #000000, 10 | drop, #000000, 0/4, blur 6 |
| **Minimal** | Inter / 500 / 72 | #FFFFFF / #FFE08A | #000000, 0 | drop, #000000, 0/2, blur 8 |
| *extra:* **Neon Glow** | Outfit / 700 / 80 | #FFFFFF / #00E5FF | #000000, 0 | drop, #00E5FF, 0/0, blur 20 |
| *extra:* **Retro Extrude** | Anton / 400 / 96 | #FFF3B0 / #FF4D4D | #000000, 1.5 | extrude, #B3261E, X 6, Y 6, blur 0 |

Classic values are quoted from subtitleStore.ts:88-105 (`strokeWidth: 7.5`, `shadowOffsetY: 2`, `shadowBlur: 4`, `fontSize: 90`). Other rows are [ASSUMED] design proposals.

### Apply and Save-as wiring

```ts
// apply (editor): copies, no link back (D-10)
const look = style.props                              // 14 keys
useSubtitleStore.getState().setStyle(look)            // global
useSubtitleStore.getState().setSpeakerStyle(id, look) // speaker
useSubtitleStore.getState().setPhraseStyle(idx, look) // phrase

// Save as style (D-11): from the Global panel
const props = pickLookProps(useSubtitleStore.getState().style)
await fetch('/api/styles', { method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({ name, props }) })
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single blurred `text-shadow` for shadow | Mode toggle: blurred drop or stacked zero-blur extrude | This phase | Enables hard 3D block lettering using plain CSS, no canvas/SVG |
| Style edited only per project in `StylePanel` | Global library + copy-on-apply | This phase | Reuse across projects without linking |

**Deprecated/outdated:** none in scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Electron does not support `window.prompt()` | Standard Stack, Pitfall 7 | Low: the inline-input UX is fine regardless; only the justification would change |
| A2 | Native `confirm()` can leave inputs unfocusable on Windows Electron | Pitfall 7 | Low: inline two-step delete is simple either way. If wrong, `window.confirm` (existing precedent) would also have been fine |
| A3 | 1 px steps along the dominant axis leave no visible gaps on Archivo Black / Anton | Pitfall 5 | Low-medium: if gaps appear on thin glyphs, reduce step to 0.5 px (change one constant) |
| A4 | Built-in style parameter values (all rows of the table other than Classic) | Code Examples | Low: purely visual; adjusted in UAT. Discretion area per CONTEXT |
| A5 | A paused Player may need a `seekTo(getCurrentFrame())` nudge to repaint on prop change | Pattern 4 | Low: verified precedent exists in `KeyframePreview.tsx`; check on first run |
| A6 | Auto-save debounce of about 600-800 ms is acceptable ("short pause") | Pattern 6 | Low: one constant |
| A7 | Widening extrude X/Y to +/-40 in extrude mode is enough | Pitfall 5 | Low: one constant |

## Open Questions

1. **Extrude control labelling and mode-switch defaults**
   - What we know: CONTEXT leaves labelling to discretion; X/Y values are shared between modes; Drop defaults are X 0, Y 2.
   - What's unclear: whether switching Drop to Extrude should auto-seed (e.g. 8, 8) when `|X|` and `|Y|` are both below 3 (otherwise the user sees almost nothing and may think it is broken).
   - Recommendation: on switching to Extrude with both offsets near zero, set X and Y to 8 (one `onChange` patch, one undo snapshot); show `Blur` only in Drop mode, label X/Y "Depth X / Depth Y" in Extrude mode, and keep `shadowBlur` stored but ignored.

2. **Should project load merge `DEFAULT_STYLE`?**
   - What we know: no merge today; renderer-side `=== 'extrude'` already makes it safe.
   - Recommendation: yes, low-risk hardening (Pitfall 3 option c). Planner decision.

3. **Where does `LookStyleProps` validation live on the backend?**
   - The backend cannot import runtime from `remotion-composition`. Duplicate the 14-key allowlist and ranges in `textStyleStore.ts`, and guard drift with a backend test that imports `../../remotion-composition/src/lookStyle.ts` by relative path and asserts the allowlists are equal.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | 22.23.3 (matches `.nvmrc`) | — |
| vitest | tests | yes | 4.1.2 (root `node_modules/.bin`) | — |
| better-sqlite3 (plain Node ABI) | backend store tests, dev server | yes | opens `:memory:` DB | — |
| TypeScript (`tsc`) | `just build-libs`, type-check | yes | root `node_modules/.bin/tsc` | — |
| Network / external services | none | n/a | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. (Desktop packaged-build tooling is only needed for the optional packaged-render check; see Pitfall 2.)

## Validation Architecture

`workflow.nyquist_validation` is not set to `false` in `.planning/config.json` (the file has no such key), so this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 (node environment; no jsdom, so no React component tests) |
| Config files | `packages/frontend/vitest.config.ts` (root `./packages/frontend`, include `src/**/*.test.ts`); backend has none (defaults, tests in `packages/backend/test/`); `packages/desktop/vitest.config.ts` (pattern to copy); remotion-composition has none (Wave 0) |
| Quick run (shadow/look) | `cd packages/remotion-composition && npx vitest run` (after Wave 0 adds config + script) |
| Quick run (backend) | `cd packages/backend && npx vitest run` (baseline: 1 file, 13 tests pass) |
| Quick run (frontend) | from repo root: `npx vitest run --config packages/frontend/vitest.config.ts` (baseline: 78 pass, 5 pre-existing failures in `subtitleStore.test.ts` bulk actions) |
| Type check | `npx tsc --noEmit -p packages/frontend`, `-p packages/backend`; `just build-libs` for the libs |
| Full suite | the three commands above plus `just build-libs` and a type-check |

Because the test environment is `node`, UI behaviours (Studio layout, picker, auto-save timing, preview parity) are manual or UAT items, as in earlier phases. Keep logic in pure modules so it is unit-testable.

### Phase Requirements to Test Map (per decision)

| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| D-06 | Drop output is byte-identical to the legacy expression (stroke + `x y blur color`) for defined and undefined `shadowType` | unit | `cd packages/remotion-composition && npx vitest run test/textShadow.test.ts` | Wave 0 |
| D-06 | Extrude: (3,3) gives 3 zero-blur steps `1.00px 1.00px 0 #000` to `3.00px 3.00px 0 #000`; (4,2) gives 4 steps ending `4.00px 2.00px`; (0,0) gives none; negative offsets work; stroke entries precede extrude entries; step count clamped at 64; blur ignored | unit | same | Wave 0 |
| D-06 | Old blob / override with no `shadowType` renders as drop | unit | same | Wave 0 |
| D-06 | Preview vs render parity (same component) | manual-only (UAT) | Render a short clip with 3D Shadow style; compare editor Player frame and MP4 frame to `ref-3d-extrude-shadow.png`. Justification: no browser/pixel test infra | n/a |
| D-05 | `LOOK_STYLE_KEYS` is exactly the 14 listed keys and excludes `verticalPosition`, `laneGap`, `lingerDuration`; `pickLookProps` fills `shadowType: 'drop'` | unit | `cd packages/remotion-composition && npx vitest run test/lookStyle.test.ts` | Wave 0 |
| D-05 | Backend validation allowlist equals `LOOK_STYLE_KEYS` (drift guard) | unit | `cd packages/backend && npx vitest run test/textStyleStore.test.ts` | Wave 0 |
| D-13 | Built-ins include names 3D Shadow, Classic, Bold Pop, Minimal; count is 4-6; each has all 14 keys; each `fontFamily` is a real family from `fonts.ts`; 3D Shadow is `extrude` with black stroke and shadow | unit | backend test above | Wave 0 |
| D-14 | PUT/DELETE on a built-in is rejected (403); duplicate yields `is_builtin = 0` named "(Copy)"; built-ins re-seeded idempotently (second seed does not duplicate, updates definitions) | unit (store functions on `:memory:`) | backend test above | Wave 0 |
| D-15 | Create/rename/duplicate/delete of user styles; invalid body (missing name, bad hex, out-of-range, unknown key) rejected | unit | backend test above | Wave 0 |
| D-10 | Applying a style at global/speaker/phrase copies the 14 keys, preserves existing layout override (e.g. speaker `verticalPosition`), and is one undo step; later library edits do not alter the project | unit (store, node env) | `npx vitest run --config packages/frontend/vitest.config.ts src/lib/applyStyle` | Wave 0 (extract an `applyLookStyle` helper or test via store actions) |
| D-11 | Save-as-style payload equals `pickLookProps(style)` and excludes layout keys | unit | same as above | Wave 0 |
| Pitfall 3 | Loading an old blob with no `shadowType` gives a style that renders as drop (and merged defaults if option c is taken) | unit | `npx vitest run --config packages/frontend/vitest.config.ts src/lib/projectState` | Wave 0 |
| D-01, D-02, D-03, D-04, D-12 | Third tab; three-column layout; backdrops; static highlighted-word preview; picker entries drawn in their style | manual UAT | Run `just dev`, open Style Studio, walk the checklist | n/a |
| D-16 | Edit then pause: indicator shows Saving then Saved; reload shows the edit; no Save button; switching selection or tab mid-edit does not lose the change | manual UAT | same | n/a |
| D-07, D-08 | Extrude uses shadow colour; outline keeps stroke colour; font list unchanged (26 fonts; Studio hides "Other Google Font...") | manual UAT plus unit (`FONT_NAMES.length === 26`) | same / backend test | partly Wave 0 |
| D-09 | Pickers present in Global, speaker (global-mode list and single-speaker mode) and phrase panels | manual UAT | same | n/a |

### Sampling Rate
- **Per task commit:** the quick command for the package touched (see above), plus type check of the touched package.
- **Per wave merge:** all three vitest suites, `just build-libs`, `tsc --noEmit` for frontend and backend. Gate on "no new failures vs the baseline of 5 known `subtitleStore` failures".
- **Phase gate:** full suite green (modulo baseline), then manual UAT checklist against the reference image before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/remotion-composition/vitest.config.ts` and a `"test": "vitest run"` script; tests live in `packages/remotion-composition/test/` (outside `src`, so `tsc --build` neither type-checks nor emits them into `dist`).
- [ ] `packages/remotion-composition/test/textShadow.test.ts` (D-06)
- [ ] `packages/remotion-composition/test/lookStyle.test.ts` (D-05)
- [ ] `packages/backend/test/textStyleStore.test.ts` (D-05 drift guard, D-13, D-14, D-15; imports `fonts.ts` and `lookStyle.ts` by relative path)
- [ ] `packages/frontend/src/lib/applyStyle.test.ts` (D-10, D-11) and a projectState load test (Pitfall 3)
- [ ] Optional (discretion): a `renderStill` script for the 3D Shadow built-in to produce a PNG for human comparison; not required.

## Security Domain

`security_enforcement` is not set in `.planning/config.json`, so it is treated as enabled. The app is a local single-user desktop/LAN app with no authentication layer (none exists elsewhere in the repo), so most ASVS categories do not apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | App has no auth; unchanged |
| V3 Session Management | no | n/a |
| V4 Access Control | no (built-in immutability is a data-integrity rule, enforced by 403 in the store) | Server-side `is_builtin` checks; never trust the client flag |
| V5 Input Validation | yes | Server-side validation of POST/PUT bodies: name trimmed, 1-80 chars; props only allowlisted keys; colours match `^#[0-9a-fA-F]{6}$`; numbers finite and range-clamped; `fontFamily` string of at most 100 chars; `fontWeight` in 100..900; `shadowType` in `drop`/`extrude`. Plain hand validation (as `presets.ts` does) is sufficient, no new library |
| V6 Cryptography | no | n/a |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via style name/props | Tampering | Prepared statements with bound params (the established pattern in `presets.ts`); JSON stored as a string column |
| Malformed/hostile style values interpolated into CSS (`${shadowColor}` in the text-shadow string) | Tampering | Hex-only colour validation server-side; React inline `style` assignment drops invalid values rather than allowing property injection; clamp extrude steps |
| Resource exhaustion via huge extrude offsets in a hand-edited blob or API call | Denial of service | `MAX_EXTRUDE_STEPS` clamp in the pure function; numeric range validation on write |
| Modifying or deleting built-ins through the API | Tampering | 403 when `is_builtin = 1` on PUT/DELETE; duplicate always produces `is_builtin = 0` |
| Oversized request bodies | Denial of service | Fastify's default body limit applies to JSON routes (the 10 GB `bodyLimit` set for uploads is global in `index.ts` per STATE 01-04, so add explicit length checks on `name` and `props` rather than relying on it) |

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `16-CONTEXT.md`, `STATE.md`, `ref-3d-extrude-shadow.png`, `remotion-composition/src/{types,SubtitleOverlay,Root,fonts,index}.ts(x)`, `frontend/src/{App.tsx, store/subtitleStore.ts (ranges 80-112, 715-780, 1200-1245), lib/projectState.ts, hooks/useAnimationPresets.ts, hooks/useRender.ts, components/{StylePanel/StylePanel.tsx, StylePanel/SpeakerStylePanel.tsx, StyleDrawer/PhraseStylePanel.tsx, GlobalStyleSidePanel.tsx, AutoSaveIndicator.tsx, DeleteConfirmDialog.tsx, AnimationEditor/AnimationPreview.tsx, AnimationBuilder/KeyframePreview.tsx}}`, `backend/src/{index.ts, services/{animationPresets,lanePresets,projectStore}.ts, routes/{presets,lanePresets}.ts}`, `desktop/{electron-builder.yml, package.json, scripts/stage-backend.mjs}`, `justfile`, package manifests.
- Test runs this session: frontend (78 pass / 5 pre-existing fail), backend (13 pass), a probe test confirming vitest can import `fonts.ts` under Node.

### Secondary (MEDIUM confidence)
- developer.mozilla.org/en-US/docs/Web/CSS/text-shadow: first shadow on top, zero blur allowed (fractional px not stated explicitly, inferred from `<length>` syntax).
- remotion.dev/docs/player/api: `initialFrame`, `controls`, `autoPlay`, `clickToPlay`, `acknowledgeRemotionLicense` semantics. (A first attempt at `/docs/player/props` returned 404; the API page is the correct source.)

### Tertiary (LOW confidence)
- Electron `window.prompt` / `confirm` behaviour (A1, A2): from training memory, not re-verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no additions; every library version read from the installed tree.
- Architecture: HIGH, mirrors three existing in-repo patterns; each integration point was read.
- Pitfalls: HIGH for 1-3, 6, 10 (read from code or run); MEDIUM for 4, 5, 8, 9 (derived reasoning); LOW for 7 (Electron claims assumed).
- Built-in style numbers: LOW by design; visual tuning in UAT.

**Research date:** 2026-10-13
**Valid until:** 2026-11-12 (stable stack, pinned Remotion; revalidate if Remotion or Zustand are upgraded)
