# Phase 13: Project Persistence and Landing Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 13-project-persistence-and-landing-page
**Areas discussed:** Project list UI, Save/load behavior, Navigation flow, Project lifecycle

---

## Project List UI

| Option | Description | Selected |
|--------|-------------|----------|
| Card grid with thumbnails | Video thumbnail, project name, last edited date, duration. Responsive grid. | ✓ |
| Simple list rows | Compact table-like rows. No thumbnails. | |
| You decide | Let Claude choose. | |

**User's choice:** Card grid with thumbnails (Recommended)
**Notes:** None

### Empty State

| Option | Description | Selected |
|--------|-------------|----------|
| Upload zone as landing | No projects → show upload dropzone directly. | ✓ |
| Empty card grid with create button | Show grid with just the '+ Create New' card. | |
| You decide | Let Claude pick. | |

**User's choice:** Upload zone as landing (Recommended)
**Notes:** None

---

## Save/Load Behavior

### Save Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-save on changes | Debounced auto-save (3-5s after last edit). No manual save button. | ✓ |
| Manual save button | User clicks 'Save' explicitly. | |
| Both | Auto-save + manual save button. | |

**User's choice:** Auto-save on changes (Recommended)
**Notes:** None

### State Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full editing state | Everything: phrases, styles, speaker names, animation presets, lanes. | ✓ |
| Core transcript only | Just phrases, words, timing. | |
| You decide | Let Claude determine scope. | |

**User's choice:** Full editing state (Recommended)
**Notes:** None

### Undo History

| Option | Description | Selected |
|--------|-------------|----------|
| Fresh undo stack | Loading starts clean. Saved state = new baseline. | ✓ |
| Persist undo history | Save/restore full undo/redo stack across sessions. | |

**User's choice:** Fresh undo stack (Recommended)
**Notes:** None

---

## Navigation Flow

### Top-Level Nav

| Option | Description | Selected |
|--------|-------------|----------|
| Projects \| Animation Builder | Two tabs. Subtitles becomes editing view within project. | ✓ |
| Projects \| Subtitles \| Animation Builder | Three tabs. Subtitles enabled when project open. | |
| You decide | Let Claude structure nav. | |

**User's choice:** Projects | Animation Builder (Recommended)
**Notes:** None

### Back Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Click 'Projects' tab | Tab returns to project list. Auto-save ensures no loss. | ✓ |
| Back arrow + Projects tab | Visible back button in editing header + tab. | |
| You decide | Let Claude pick. | |

**User's choice:** Click 'Projects' tab (Recommended)
**Notes:** None

### New Project Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-create, go to editing | Upload → project created with filename → editing view. | ✓ |
| Name first, then upload | Dialog for name before upload. | |
| You decide | Let Claude pick. | |

**User's choice:** Auto-create project, go to editing (Recommended)
**Notes:** User noted that projects with same video filename should be differentiated by underlying UUID.

---

## Project Lifecycle

### Available Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Rename | Change project display name. | ✓ |
| Delete with confirmation | Delete project + video files. Confirmation required. | ✓ |
| Duplicate project | Clone editing state for variant. | ✓ |
| Re-transcribe | Keep video, re-run transcription. | ✓ |

**User's choice:** All four actions selected.
**Notes:** None

### Delete Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Delete everything | Project + video files + normalized + rendered output. | ✓ |
| Keep video files | Only delete project record. | |
| Ask user each time | Checkbox in confirmation dialog. | |

**User's choice:** Delete everything (Recommended)
**Notes:** None

### Action UI

| Option | Description | Selected |
|--------|-------------|----------|
| Right-click context menu | Right-click card shows all actions. Clean. | ✓ |
| Three-dot menu on each card | Kebab icon on card corner. | |
| Both | Three-dot + right-click. | |

**User's choice:** Right-click context menu (Recommended)
**Notes:** None

---

## Claude's Discretion

- Debounce timing for auto-save
- Thumbnail extraction approach
- SQLite schema design
- Serialization format
- Context menu component implementation
- Project card visual treatment

## Deferred Ideas

None — discussion stayed within phase scope
