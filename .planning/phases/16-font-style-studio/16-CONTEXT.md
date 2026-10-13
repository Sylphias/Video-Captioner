# Phase 16: Font Style Studio - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Phase Boundary

A dedicated **Style Studio** page for designing reusable, named text styles: font, weight, size, colours, outline, and shadow or 3D extrude. Styles are saved in a global library, separate from projects. In the project editor they can be applied at global, speaker or phrase level, and a project's current look can be saved back as a new style. The phase also adds a new **Extrude** shadow mode to the subtitle renderer, which is needed to reproduce the user's reference image: a 3D block letter with a solid shadow running down-right.

</domain>

<decisions>
## Implementation Decisions

### Studio Page Layout
- **D-01:** The studio is a third top-level tab: Projects | Animation Builder | Style Studio. Styles are global, not tied to a project, the same way the Animation Builder works.
- **D-02:** Three-column layout. Left: the style library list. Centre: a large live preview. Right: property controls, reusing the existing StylePanel controls where possible.
- **D-03:** The preview shows editable sample text over a backdrop the user can choose: dark, light, checkerboard or a custom colour. No project or video is needed.
- **D-04:** The preview is static, with one word drawn in the highlight colour so the base and highlight colours are visible at the same time. No looping karaoke playback.

### What a Style Contains
- **D-05:** A style holds look properties only: fontFamily, fontWeight, fontSize, baseColor, highlightColor, strokeColor, strokeWidth, shadowColor, shadowOffsetX, shadowOffsetY, shadowBlur, the new shadow mode, letterSpacing and wordSpacing. Layout settings are NOT part of a style and stay per-project: verticalPosition, laneGap, lingerDuration and words per phrase. — **Reversibility:** costly — the stored style schema and the apply/save-as code both depend on this field list.
- **D-06:** There is one shadow, with a mode toggle:
  - **Drop** is the current blurred offset shadow.
  - **Extrude** is a solid 3D block with no blur, built from stacked 1px steps from the letter out to (shadowOffsetX, shadowOffsetY). X/Y set the direction and the depth, and blur does not apply.
  - No stackable effect layers.
  - Extrude must render identically in the editor preview and in the final Remotion render. Both use the same `SubtitleOverlay` component.
  - **Reversibility:** costly — this adds a new field to StyleProps, which flows into saved project blobs, speaker/phrase overrides and render props. Older saved projects must default to Drop.
- **D-07:** Extrude uses the existing shadow colour. The outline keeps its own stroke colour. The reference look is reached by setting both to black.
- **D-08:** No new fonts. The existing 26 Google fonts list stays as it is; Archivo Black and Anton approximate the reference closely enough.

### Applying Styles to Video
- **D-09:** A saved style can be applied at all three existing levels:
  - global style
  - per-speaker override
  - per-phrase override

  A style picker appears in the Global Style panel and in the speaker and phrase override panels.
- **D-10:** Applying a style copies its values into the project's style or override. There is no link back: later edits to the style in the studio do NOT change projects that already used it. This matches how project state is persisted today (Phase 13).
- **D-11:** The Global Style panel gets a **"Save as style"** button. It saves the project's current look properties (per D-05) as a new named style in the library.
- **D-12:** The editor's picker is a compact dropdown. Each entry shows the style's name drawn in that style.

### Built-in Presets & Library
- **D-13:** Ship a small curated set of about 4–6 built-in styles. Must include:
  - **3D Shadow**, matching the reference image: heavy block font, thin black outline, black extrude down-right
  - **Classic**, the current default: white text, black outline
  - **Bold Pop**: yellow highlight, thick outline
  - **Minimal**: no outline, soft drop shadow

  Claude may add 1–2 more.
- **D-14:** Built-ins are read-only, like built-in animation presets: they can't be edited or deleted. "Duplicate" creates an editable copy.
- **D-15:** User styles support New, Rename, Duplicate and Delete. Delete asks for confirmation. No import/export and no favourites or reordering.
- **D-16:** Studio edits auto-save after a short pause, like projects (Phase 13 D-04). There is no Save button.

### Claude's Discretion
- Exact field name and shape for the shadow mode (e.g. `shadowType: 'drop' | 'extrude'`) and how many extrude steps to cap at for performance
- SQLite schema and API routes for style storage, following the animation preset service pattern
- Exact parameters for the built-in styles and names for any extra 1–2 built-ins
- Backdrop picker UI and default sample text
- How the Shadow controls change in Extrude mode (e.g. hide or disable Blur, relabel X/Y as direction/depth)
- Placement of "Save as style" and the naming prompt UX

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Visual target
- `.planning/phases/16-font-style-studio/ref-3d-extrude-shadow.png` — the user's reference image for the 3D extrude look (D-06, D-13 "3D Shadow")

### Roadmap / prior decisions
- `.planning/ROADMAP.md` § Phase 16 — phase goal and seed notes (3D extrude feasibility analysis)
- `.planning/phases/13-project-persistence-and-landing-page-save-load-video-projects-project-list-ui-nav-restructure/13-CONTEXT.md` — top-level nav tabs (D-07), auto-save (D-04), persisted editing state (D-05)
- `.planning/phases/12-ui-ux-layout-improvements/12-CONTEXT.md` — right side panel single-slot Global/override behaviour (D-06–D-12)

No external specs. Requirements are fully captured in the decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/frontend/src/components/StylePanel/StylePanel.tsx`: font picker, weight buttons, ScrubInput, colour pickers, stroke and shadow controls. These are reused for the studio's controls column, but they currently read and write `useSubtitleStore` directly, so they need decoupling to edit a library style.
- `packages/remotion-composition/src/SubtitleOverlay.tsx`: `generateStrokeShadow()` builds the outline from text-shadows. The drop shadow is built as `dropShadow`, combined with the outline and set as the word span's `textShadow`. This is where the Extrude mode plugs in.
- `packages/remotion-composition/src/fonts.ts`: `FONTS`, `FONT_NAMES`, `getFontFamily`, `FONT_WEIGHT_OPTIONS`.
- `packages/frontend/src/components/AnimationEditor/AnimationPreview.tsx` and `AnimationBuilder/KeyframePreview.tsx`: existing standalone preview patterns with local default StyleProps. These are candidates for the studio preview.
- `packages/backend/src/services/animationPresets.ts` and `routes/presets.ts`, plus `hooks/useAnimationPresets.ts`: SQLite-backed presets with read-only built-ins. This is the pattern to mirror for style storage.

### Established Patterns
- `StyleProps` (`packages/remotion-composition/src/types.ts`) is the single style shape. Speaker and phrase overrides are `Partial<StyleProps>` (`SpeakerStyleOverride`, `PhraseStyleOverride`, and the phrase `styleOverride` in shared-types).
- Default StyleProps are copied in several places: `subtitleStore.ts`, `Root.tsx`, `AnimationPreview.tsx` and `KeyframePreview.tsx`. A new field must be added to all of them.
- Project state is saved as a blob and loaded with spread syntax, so missing new fields must fall back to defaults (Phase 13 decision).

### Integration Points
- `packages/frontend/src/App.tsx`: the `TABS` array and `activeTab` rendering, where the Style Studio tab is added.
- `packages/frontend/src/components/GlobalStyleSidePanel.tsx`, `StylePanel/SpeakerStylePanel.tsx` and `StyleDrawer/PhraseStylePanel.tsx`: where the style picker dropdown and "Save as style" go.
- `subtitleStore.setStyle`, `setSpeakerStyle` and the phrase override setter: the targets when a style is applied.

</code_context>

<specifics>
## Specific Ideas

- The reference look: heavy, slightly rounded block capitals; a thin black outline (about 1.5–2px stroke); a fill matching the backdrop or white; and a solid black extrusion running diagonally down-right, merging with the outline.
- The idea came from a "SHADOW" alphabet sample image (saved as the reference PNG).

</specifics>

<deferred>
## Deferred Ideas

- Stackable effect layers (multiple outlines, shadows and extrudes): considered and rejected for this phase
- Separate extrude colour, independent of the shadow colour
- Additional fonts (Bowlby One, Rubik Mono One, Titan One) or custom font file uploads
- Linked styles that propagate studio edits to projects, or a "re-sync from style" button
- Import/export of styles as JSON; favourites and reordering
- Previewing styles on a frame from a real project video, and looping karaoke playback in the studio preview

</deferred>

---

*Phase: 16-font-style-studio*
*Context gathered: 2026-10-13*
