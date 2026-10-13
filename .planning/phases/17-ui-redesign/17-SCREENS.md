# Phase 17: UI Screen Inventory

Captured 2026-10-14 as input to discuss-phase. Source: codebase sweep of `packages/frontend/src` and `packages/desktop`.

## Direction (from user, 2026-10-14)

- Adopt the shared Eigen neobrutalist / RetroUI style with bright colours, as used in the user's other apps.
  - Tokens: `F:/projects/personal/eigenmoto_landing/Brand landing page design/design_handoff_eigenmoto_landing/README.md` ("Design Tokens") and `reference/parking-style-tile.png`.
  - Type: Archivo Black for headings, Space Grotesk for body.
  - Shape: ink #111 borders and hard offset shadows.
  - Colour: off-white #F4F4F2 background, red #E63946, yellow #FFC93C, green #00A85F, blue #4D7CFF and orange #FF6B2C. A dark-mode variant exists.
- Move Global Styling into a **sub-window** (floating, dockable panel or modal) rather than a permanent side column.
- Keep **context panels at the sides** as today: lanes on the left; phrase/speaker style on the right.
- Known bug to fix: the Global Styling panel overflows horizontally. The 240px column leaves about 190 usable px, but the colour pickers and hex rows are fixed at 200px.

## Decisions (user, 2026-10-14)

- **Theme: dark by default**, because it is better for video editing. Use the Eigen style tile's dark-mode palette (bg #262626, surface #333333, ink/border #F5F5F2, primary #E63946, destructive #FF5A63) with the bright accents.
- **Global Styling: a draggable floating panel with its own live caption preview**, so the font can be seen while it is styled. It has sub-tabs separating **Font/Look** (StyleControls) from **Timing & Layout** (words per phrase, max chars, vertical position, lane gap, linger/delay).
- **Scope: every screen** (S1–S10, plus modals and popovers) in this phase.

## Screens

| # | Screen | File(s) | Regions |
|---|--------|---------|---------|
| S1 | First-run setup gate | `components/FirstRunSetup.tsx` | Centred card: needed / running (progress) / error; cancel confirm |
| S2 | Desktop splash | `packages/desktop/src/splash/*` | 360x200 frameless: title, status, progress |
| S3 | App chrome | `Header.tsx`, `TabNav.tsx` | Title, tabs (Projects / Animation Builder / Style Studio), settings gear |
| S4 | Projects: empty and uploading | `pages/ProjectsPage.tsx`, `UploadZone.tsx` | Heading, drop zone, status |
| S5 | Projects: list | `ProjectsPage.tsx`, `ProjectCard.tsx` | Card grid (thumbnail, name, rename, media-missing badge), "+ New Project" |
| S6 | Editor: pre-load states | `pages/SubtitlesPage.tsx` | Media missing, upload/normalise, error, transcribing, preparing |
| S7 | Editor: main | `SubtitlesPage.tsx` | Left `LaneSidePanel` (220px); centre `PreviewPanel` + resize split + toolbar + `StageTabBar`; right `GlobalStyleSidePanel` (240px) |
| S7a | Stage: Text Edit | `TextEditor/*`, `MiniTimeline.tsx` | Mini timeline, phrase lines, Find & Replace bar, SRT diff, bulk actions |
| S7b | Stage: Word Timing | `TimingEditor/*` | Multi-lane waveform timeline, lane headers, `PhraseDetailPanel` |
| S7c | Stage: Animation | `AnimationEditor/*` | Preset list (280px) + preview + phase timeline + phase/highlight panel |
| S8 | Right context: Global / Phrase / Speaker style | `GlobalStyleSidePanel.tsx`, `StylePanel/*`, `StyleDrawer/PhraseStylePanel.tsx` | Apply style, Save as style, StyleControls, layout controls, per-speaker overrides |
| S9 | Animation Builder | `AnimationBuilder/*` | Preset header, mode/scope toggles, keyframe preview + `KeyframeDrawer`, keyframe timeline, easing/Bezier popovers |
| S10 | Style Studio | `StyleStudio/*` | Library list (260) / preview (1fr) / controls (340) |

## Modals, popovers and overlays

- Settings dialog (480px).
- Transcription options dialog (380px).
- Delete confirm (400px).
- Project context menu.
- StylePicker dropdown.
- FontPicker dropdown.
- Save-as-style inline form.
- Keyframe drawer.
- Easing picker and Bezier editor.
- Speaker dropdown per line.
- Lane merge and delete confirms.
- Custom backdrop colour popover.
- Stage toast.
- Auto-save indicator.
- Animation Builder still uses native `window.prompt` (Save As) and `window.confirm` (Delete). Replace both with styled dialogs.

## Theming facts relevant to the redesign

- Tokens live in `styles/tokens.css`. The UI is dark-only, uses the system font stack, and has a green accent (`--color-accent-green`, 193 uses).
- There are 47 per-component `.css` files using BEM classes, with no Tailwind.
- About 185 hex colours are hard-coded in CSS.
- These variables are used but never defined: `--color-surface-secondary`, `--color-bg-tertiary`, `--color-bg-secondary`, `--font-mono`, `--font-size-xs`, `--color-bg-primary`, `--color-surface`, `--color-primary`, `--color-accent-red`.
- The desktop splash redefines its own copies of the tokens (`splash.css`).
- Speaker colours are defined twice: `--speaker-color-0..7` and `utils/speakerColors.ts`.
- `TranscriptView.tsx` and `TranscriptEditor/*` are unused; they are candidates for deletion.

## Design canvas

First-pass mockups of every screen (13 artboards, Eigen Dark): https://claude.ai/artifact/BktZ9kfnNi9YrpRtqWnS44 (private; created 2026-10-14). Review there with comments, then plan.
