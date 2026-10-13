# Phase 16: Font Style Studio - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-13
**Phase:** 16-font-style-studio
**Areas discussed:** Studio page layout, What a style contains, Applying styles to video, Built-in presets & library

**Pre-discussion:** The user shared a 3D extruded "SHADOW" alphabet reference image. They were offered a quick add to the existing Style panel and chose to fold the request into Phase 16 instead.

---

## Studio page layout

| Option | Description | Selected |
|--------|-------------|----------|
| 3rd top-level tab | Projects / Animation Builder / Style Studio | ✓ |
| Modal from the editor | Opens over the editor from the Style panel | |
| Merged into Animation Builder | One Builder page with sub-tabs | |

| Option | Description | Selected |
|--------|-------------|----------|
| Sample text on backdrop | Editable sample over a selectable background | ✓ |
| Frame from a project video | Real video frame | |
| Both | Backdrop by default, optional video frame | |

| Option | Description | Selected |
|--------|-------------|----------|
| Library / Preview / Controls | Three-column layout | ✓ |
| Gallery grid + editor | Thumbnail grid, then editor view | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Static, one word highlighted | Shows base and highlight colours at once | ✓ |
| Looping karaoke playback | | |
| Toggle between both | | |

---

## What a style contains

| Option | Description | Selected |
|--------|-------------|----------|
| Look only | Font, weight, size, colours, outline, shadow, spacing; layout stays per-project | ✓ |
| Look without size | Size also per-project | |
| Everything in StyleProps | Full snapshot including position, lane gap and linger | |

| Option | Description | Selected |
|--------|-------------|----------|
| Drop or Extrude mode | One shadow with a mode toggle | ✓ |
| Extrude + drop together | Extrude plus an optional soft drop shadow | |
| Stackable effect layers | Arbitrary list of effects | |

| Option | Description | Selected |
|--------|-------------|----------|
| Uses shadow color | Extrude reuses the shadow colour picker | ✓ |
| Separate extrude color | | |
| Locked to outline color | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current list | The 26 existing Google fonts | ✓ |
| Add a few block/3D fonts | Bowlby One, Rubik Mono One, Titan One | |
| Upload custom font files | | |

---

## Applying styles to video

| Option | Description | Selected |
|--------|-------------|----------|
| Global + speaker + phrase | Picker in all three panels | ✓ |
| Global only | | |
| Global + speaker | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Copy on apply | Values copied; later studio edits don't propagate | ✓ |
| Linked | References by ID; edits propagate | |
| Copy + re-sync button | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, "Save as style" button | Saves the current project look into the library | ✓ |
| No, studio-only creation | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown with text previews | Each item drawn in its own style | ✓ |
| Thumbnail swatch grid | | |
| You decide | | |

---

## Built-in presets & library

| Option | Description | Selected |
|--------|-------------|----------|
| Small curated set | About 4–6: 3D Shadow, Classic, Bold Pop, Minimal, plus 1–2 more | ✓ |
| Just 3D Shadow + Classic | | |
| No built-ins | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only, duplicate to edit | Same as built-in animation presets | ✓ |
| Fully editable | With a restore-defaults option | |

| Option | Description | Selected |
|--------|-------------|----------|
| New, rename, duplicate, delete | Delete asks for confirmation | ✓ |
| Above + import/export JSON | | |
| Above + favorites/ordering | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-save | Saves after a short pause, like projects | ✓ |
| Explicit Save button | | |

---

## Claude's Discretion

- Shadow mode field name and shape, and the extrude step cap
- Style storage schema and routes
- Built-in style parameters and any extra built-ins
- Backdrop picker UI and sample text
- How the Shadow controls behave in Extrude mode
- "Save as style" placement and naming UX

## Deferred Ideas

- Stackable effect layers
- Separate extrude colour
- More fonts or custom font uploads
- Linked styles or re-sync
- Import/export, favourites and ordering
- Real video frame preview and looping karaoke preview
