# Phase 13: Project Persistence and Landing Page - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Save and load video editing sessions as named projects. Landing page shows a card grid of existing projects with thumbnails, plus a create-new option. Top nav restructured to Projects | Animation Builder. The current Subtitles editing view becomes the editing interface within a project. Auto-save ensures no work is lost.

</domain>

<decisions>
## Implementation Decisions

### Project List UI
- **D-01:** Card grid layout with video thumbnails, project name, last edited date, and video duration. Responsive grid similar to YouTube Studio or DaVinci Resolve project manager.
- **D-02:** "+ Create New" card at the end of the grid opens an upload zone.
- **D-03:** Empty state (no projects) shows the upload dropzone directly as the main content — same as current app behavior. Once a project exists, switch to card grid.

### Save/Load Behavior
- **D-04:** Auto-save on changes with debounce (3-5 seconds after last edit). No manual save button.
- **D-05:** Full editing state persisted: phrases/words/timing, styles, speaker names/styles, active animation preset ID, active highlight preset ID, phrase animation overrides, lane config, lane overrides, maxWordsPerPhrase.
- **D-06:** Undo/redo history is NOT persisted — loading a project starts with a fresh undo stack. Saved state becomes the new baseline.

### Navigation Flow
- **D-07:** Two top-level tabs: Projects | Animation Builder. The current "Subtitles" tab is removed from top nav — it becomes the editing view within a project.
- **D-08:** Clicking a project card transitions to the editing view (current SubtitlesPage with upload/transcribe/edit stages).
- **D-09:** Clicking the "Projects" tab returns to the project list. Auto-save ensures no work is lost.
- **D-10:** Uploading a new video auto-creates a project using the video filename as the display name. Transitions immediately to editing view with upload/transcription progress.
- **D-11:** Projects have a unique UUID as primary identifier — duplicate video filenames are fine, each project is unique.

### Project Lifecycle
- **D-12:** Available actions: Rename, Delete, Duplicate, Re-transcribe.
- **D-13:** Actions accessed via right-click context menu on project cards. Clean UI with no visible clutter on cards.
- **D-14:** Rename: inline editing of project display name.
- **D-15:** Delete: confirmation dialog, then delete everything — project record + video files + normalized video + rendered output. Full cleanup.
- **D-16:** Duplicate: clone project editing state to create a variant on the same video.
- **D-17:** Re-transcribe: keep video but re-run transcription from scratch (fresh editing state).

### Claude's Discretion
- Debounce timing for auto-save (3-5 second range)
- Thumbnail extraction approach (FFmpeg frame grab at upload time vs lazy)
- SQLite schema design (single table vs normalized)
- Serialization format for editing state blob
- Context menu component implementation
- Project card hover/selection visual treatment

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Core State & Types
- `packages/frontend/src/store/subtitleStore.ts` — Primary Zustand store with all editing state that must be serialized
- `packages/frontend/src/store/undoMiddleware.ts` — Undo store (NOT persisted, but interface needed to understand snapshot shape)
- `packages/shared-types/src/index.ts` — Shared types including Job, Transcript, VideoMetadata

### Existing Persistence
- `packages/backend/src/services/animationPresets.ts` — SQLite pattern with better-sqlite3 (model for new projects DB)
- `packages/backend/src/routes/presets.ts` — CRUD route pattern to follow

### Upload & Jobs
- `packages/backend/src/routes/upload.ts` — Upload flow that creates jobId and directories
- `packages/backend/src/services/jobStore.ts` — In-memory job Map (projects need to reference jobId)
- `packages/frontend/src/hooks/useUpload.ts` — Upload hook that will need to create project on upload

### Navigation
- `packages/frontend/src/App.tsx` — Tab-based navigation (useState, no router)
- `packages/frontend/src/components/Header.tsx` — Header with TabNav
- `packages/frontend/src/components/TabNav.tsx` — Tab navigation component

### Editing Views
- `packages/frontend/src/pages/SubtitlesPage.tsx` — Current editing view that becomes project-scoped

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TabNav.tsx`: Tab navigation component — needs tab array update (Projects | Animation Builder)
- `UploadZone.tsx`: Video upload dropzone — reusable for empty state and create-new flows
- `useUpload.ts` / `useTranscribe.ts` / `useDiarize.ts`: Existing hooks for video processing pipeline
- SQLite plugin pattern in `animationPresets.ts`: Fastify plugin with better-sqlite3, WAL mode, table creation

### Established Patterns
- Zustand stores with `create<T>()((set, get) => ({...}))` pattern
- Custom hooks for API interactions (fetch + state machine)
- Co-located CSS files per component
- Fastify route plugins wrapped in `fp()` for decorator sharing
- SSE for long-running operations (upload, transcribe, render)

### Integration Points
- `App.tsx`: Replace TABS array, add project-scoped state
- `SubtitlesPage.tsx`: Needs to receive projectId, trigger auto-save on store changes
- `subtitleStore.ts`: Needs serialization helpers (state → JSON, JSON → state)
- `jobStore.ts`: Projects reference jobId — video files live at `{DATA_ROOT}/{jobId}/`
- Backend `index.ts`: Register new projects plugin + routes

</code_context>

<specifics>
## Specific Ideas

- Thumbnail on project cards should come from the video (FFmpeg frame grab)
- Card grid should be responsive — fewer columns on narrow screens
- Auto-save should show a subtle "Saved" indicator (not intrusive)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-project-persistence-and-landing-page*
*Context gathered: 2026-04-01*
