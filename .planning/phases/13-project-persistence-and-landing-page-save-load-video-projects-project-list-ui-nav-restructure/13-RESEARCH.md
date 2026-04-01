# Phase 13: Project Persistence and Landing Page - Research

**Researched:** 2026-04-01
**Domain:** SQLite persistence, Zustand serialization, Fastify CRUD routes, React project-list UI
**Confidence:** HIGH

## Summary

Phase 13 adds a project persistence layer so users can save and return to video editing sessions. The backend needs a new `projects.db` SQLite database (following the exact pattern of `presets.db` and `lane_presets.db`) to store project records that map a UUID project ID to a job ID and a serialized blob of the full `subtitleStore` state. The frontend needs a landing page (card grid of projects) and a restructured top nav (Projects | Animation Builder), with `SubtitlesPage` becoming the editing view opened from within a project context.

All patterns needed are already established in the codebase: the `animationPresets.ts` / `lanePresets.ts` plugin pattern gives the exact SQLite setup; `captureSnapshot` / `restoreSnapshot` in `subtitleStore.ts` already defines the serialization boundary for session state; `presets.ts` shows the CRUD route structure to follow. The main new surface is the frontend `ProjectsPage` component and the auto-save subscription in `SubtitlesPage`.

The thumbnail already exists. When a user uploads a video, `upload.ts` calls `extractThumbnail` and stores the result at `{DATA_ROOT}/{jobId}/thumbnail.jpg`. The project card can serve this file directly via a static route or a new `/api/jobs/:jobId/thumbnail` endpoint.

**Primary recommendation:** Create a single `projects.db` with one `projects` table. Store the full editing state as a JSON blob column. Serve thumbnail via the existing job directory path. Implement auto-save as a Zustand `subscribe` call in `SubtitlesPage` with a 4-second debounce.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Card grid layout with video thumbnails, project name, last edited date, and video duration. Responsive grid similar to YouTube Studio or DaVinci Resolve project manager.
- **D-02:** "+ Create New" card at the end of the grid opens an upload zone.
- **D-03:** Empty state (no projects) shows the upload dropzone directly as the main content — same as current app behavior. Once a project exists, switch to card grid.
- **D-04:** Auto-save on changes with debounce (3-5 seconds after last edit). No manual save button.
- **D-05:** Full editing state persisted: phrases/words/timing, styles, speaker names/styles, active animation preset ID, active highlight preset ID, phrase animation overrides, lane config, lane overrides, maxWordsPerPhrase.
- **D-06:** Undo/redo history is NOT persisted — loading a project starts with a fresh undo stack. Saved state becomes the new baseline.
- **D-07:** Two top-level tabs: Projects | Animation Builder. The current "Subtitles" tab is removed from top nav — it becomes the editing view within a project.
- **D-08:** Clicking a project card transitions to the editing view (current SubtitlesPage with upload/transcribe/edit stages).
- **D-09:** Clicking the "Projects" tab returns to the project list. Auto-save ensures no work is lost.
- **D-10:** Uploading a new video auto-creates a project using the video filename as the display name. Transitions immediately to editing view with upload/transcription progress.
- **D-11:** Projects have a unique UUID as primary identifier — duplicate video filenames are fine, each project is unique.
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

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | Already installed | SQLite persistence | Already used for presets.db + lane_presets.db — same pattern |
| fastify-plugin (fp) | Already installed | Route/plugin encapsulation | Established pattern — all backend plugins use this |
| zustand | Already installed | Frontend state management | All stores use `create<T>()((set, get) => ({...}))` pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:crypto randomUUID | Built-in | Project UUID generation | Same as jobId generation in upload.ts |
| node:fs/promises rm (recursive) | Built-in | Full cleanup on delete | Delete project + video files |

### No New Dependencies Required

All libraries needed are already installed. This phase adds no new npm packages.

**Version verification:** Not needed — all packages are already in the monorepo.

---

## Architecture Patterns

### Recommended Project Structure

```
packages/backend/src/
├── services/
│   └── projectStore.ts      # NEW: SQLite plugin (fastify.projectsDb decorator)
├── routes/
│   └── projects.ts          # NEW: CRUD + thumbnail route
packages/frontend/src/
├── pages/
│   ├── ProjectsPage.tsx      # NEW: landing page with card grid
│   └── ProjectsPage.css      # NEW: co-located styles
├── components/
│   └── ProjectCard.tsx       # NEW: individual card component
└── App.tsx                   # MODIFY: new TABS array, project routing state
```

### Pattern 1: SQLite Plugin (follow lanePresets.ts exactly)

**What:** Fastify plugin that opens a separate SQLite DB, decorates the fastify instance, seeds/creates tables on startup, and closes cleanly.
**When to use:** Every new persistent data domain.

```typescript
// Source: packages/backend/src/services/lanePresets.ts (verified in codebase)
// packages/backend/src/services/projectStore.ts

import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import Database from 'better-sqlite3'
import path from 'node:path'
import { DATA_ROOT } from '../index.ts'

declare module 'fastify' {
  interface FastifyInstance {
    projectsDb: Database.Database
  }
}

async function projectStorePlugin(fastify: FastifyInstance): Promise<void> {
  const dbPath = path.join(DATA_ROOT, 'projects.db')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,           -- UUID (project identity)
      job_id TEXT NOT NULL,          -- references the data/{jobId}/ directory
      name TEXT NOT NULL,            -- display name (from original filename, user-editable)
      state_json TEXT,               -- serialized SubtitleStore editing state (nullable: pre-transcription)
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)

  fastify.decorate('projectsDb', db)
  fastify.addHook('onClose', (_instance, done) => { db.close(); done() })
}

export default fp(projectStorePlugin)
```

### Pattern 2: CRUD Routes (follow presets.ts exactly)

**What:** Fastify route plugin using `fp()` that accesses `fastify.projectsDb`.
**When to use:** All project CRUD operations.

Key routes to implement:
- `GET /api/projects` — list all projects with thumbnail URL, name, duration, updated_at
- `POST /api/projects` — create project record (called by frontend on upload completion)
- `GET /api/projects/:id` — fetch single project including `state_json`
- `PUT /api/projects/:id` — update name or state_json (auto-save calls this)
- `DELETE /api/projects/:id` — delete record + all files under `{DATA_ROOT}/{jobId}/`
- `POST /api/projects/:id/duplicate` — clone state_json into new project record
- `GET /api/jobs/:jobId/thumbnail` — serve `{DATA_ROOT}/{jobId}/thumbnail.jpg` as image (or use static serving)

**Important:** Register `projectStorePlugin` BEFORE `projectsRoutes` in `index.ts` (same dependency order as `animationPresetsPlugin` before `presetsRoutes`).

### Pattern 3: State Serialization

**What:** The `captureSnapshot` function in `subtitleStore.ts` already defines the serializable shape of the store. The persisted JSON for a project is the same shape as `StateSnapshot`, extended with a few top-level fields needed to reconstruct the full store on load.

```typescript
// Derived from captureSnapshot() in subtitleStore.ts (verified)
// The persisted state blob for projects.state_json

interface ProjectStateBlob {
  // From captureSnapshot:
  session: StateSnapshot['session']          // words, phrases, manualSplitWordIndices[]
  style: Record<string, unknown>             // StyleProps
  maxWordsPerPhrase: number
  speakerNames: Record<string, string>
  speakerStyles: Record<string, Record<string, unknown>>
  activeAnimationPresetId: string | null
  activeHighlightPresetId: string | null
  phraseAnimationPresetIds: Record<number, string>
  laneCount: number
  phraseLaneOverrides: Record<number, number>
  // Additional fields not in StateSnapshot (needed for full reload):
  jobId: string                              // to reconnect to video/SSE
  original: Transcript | null               // the raw Whisper output
  videoMetadata: VideoMetadata | null        // duration/fps/resolution
}
```

**Key insight:** `manualSplitWordIndices` is already serialized as `number[]` (not `Set`) in `captureSnapshot`, so the blob is JSON-safe without any custom serializer. `restoreSnapshot` already re-hydrates it back to `Set<number>`.

**Note on `laneLocks`:** The `laneLocks` field exists in `SubtitleStore` but is NOT included in `captureSnapshot`. Decision: include it in the persisted blob as `Record<number, boolean>` (default `{}`). It is part of the lane config mentioned in D-05.

**Note on `phraseStyles` (styleOverride):** Per-phrase `styleOverride` lives inside `session.phrases[n].styleOverride` — it IS captured in `captureSnapshot`'s session.phrases serialization, so no special handling needed.

### Pattern 4: Auto-Save in SubtitlesPage

**What:** Subscribe to Zustand store changes and debounce-save to backend.
**When to use:** Whenever the active project has a `projectId`.

```typescript
// In SubtitlesPage.tsx — after project context is plumbed in
useEffect(() => {
  if (!projectId) return
  let timer: ReturnType<typeof setTimeout>
  const unsub = useSubtitleStore.subscribe(() => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const state = useSubtitleStore.getState()
      const blob: ProjectStateBlob = buildStateBlob(state)
      void fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state_json: JSON.stringify(blob) }),
      })
      // Show subtle "Saved" indicator (local component state)
    }, 4000)  // 4-second debounce (within D-04's 3-5 second range)
  })
  return () => { unsub(); clearTimeout(timer) }
}, [projectId])
```

### Pattern 5: App Navigation Flow

**What:** Replace the `TABS` array and add `activeProjectId` state to `App.tsx`. No router needed — existing `useState`-based tab system is sufficient.

```typescript
// packages/frontend/src/App.tsx (current pattern preserved, extended)
const TABS = [
  { id: 'projects', label: 'Projects' },
  { id: 'animation-builder', label: 'Animation Builder' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('projects')
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  const handleOpenProject = (projectId: string) => {
    setActiveProjectId(projectId)
    setActiveTab('projects')  // stays on projects tab, shows editing view
  }

  const handleBackToList = () => {
    setActiveProjectId(null)
  }

  return (
    <div className="app">
      <Header tabs={TABS} activeTab={activeTab} onTabChange={(tab) => {
        if (tab === 'projects') setActiveProjectId(null)  // D-09: back to list
        setActiveTab(tab)
      }} />
      <main className="app__main">
        {activeTab === 'projects' && !activeProjectId && (
          <ProjectsPage onOpenProject={handleOpenProject} />
        )}
        {activeTab === 'projects' && activeProjectId && (
          <SubtitlesPage projectId={activeProjectId} onBack={handleBackToList} />
        )}
        {activeTab === 'animation-builder' && <AnimationBuilderPage />}
      </main>
    </div>
  )
}
```

### Pattern 6: Thumbnail Serving

**What:** The thumbnail JPEG is already extracted at `{DATA_ROOT}/{jobId}/thumbnail.jpg` by the upload pipeline (confirmed in `upload.ts` + `thumbnail.ts`). Serve it via a new route.

```typescript
// GET /api/jobs/:jobId/thumbnail
fastify.get('/api/jobs/:jobId/thumbnail', async (req, reply) => {
  const { jobId } = req.params as { jobId: string }
  const thumbPath = path.join(DATA_ROOT, jobId, 'thumbnail.jpg')
  return reply.sendFile('thumbnail.jpg', path.join(DATA_ROOT, jobId))
  // OR: reply.type('image/jpeg').send(fs.createReadStream(thumbPath))
})
```

Use `reply.type('image/jpeg').send(createReadStream(thumbPath))` — same pattern as other file-serving in the codebase (avoiding `@fastify/static` if not already registered).

**Check first:** If `@fastify/static` is registered, use `sendFile`. If not, use `createReadStream`.

### Anti-Patterns to Avoid

- **Single global `fastify.db` for all tables:** `lanePresets.ts` was given its own `fastify.lanePresetsDb` to avoid collision with `fastify.db`. Use `fastify.projectsDb` — never add projects table to `presets.db`.
- **Storing absolute paths in DB:** `thumbnailPath` is NOT stored in projects table — derive it from `jobId` at runtime. Job directory layout is `{DATA_ROOT}/{jobId}/thumbnail.jpg`.
- **Rebuilding phrases from words on load:** Call `restoreSnapshot` / `useSubtitleStore.setState` directly. Do NOT call `setJob` (which re-runs `buildSessionPhrases` and destroys manual phrase structure). The serialized `phrases` array from `session.phrases` is the authoritative state.
- **Storing `original: Transcript` in `StateSnapshot`:** `captureSnapshot` intentionally omits `original` (raw Whisper output). The project blob should include it separately so re-transcribe can reset cleanly.
- **Persisting Set directly to JSON:** `manualSplitWordIndices` is already serialized as `number[]` in `captureSnapshot` — this is intentional. `restoreSnapshot` re-hydrates it to `Set<number>`.
- **Hooking into Zustand `subscribe` before projectId is set:** The auto-save subscription must be conditional on `projectId` being non-null to avoid spurious saves on the pre-project upload flow.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID scheme | `crypto.randomUUID()` | Already used in `upload.ts`, `presets.ts` |
| JSON serialization of Set | Custom serializer | `Array.from(set)` + `new Set(arr)` | Already handled in `captureSnapshot`/`restoreSnapshot` |
| SQLite connection management | Custom DB class | better-sqlite3 + WAL mode | Already the project standard — see animationPresets.ts |
| Thumbnail extraction | Re-implement FFmpeg frame grab | `extractThumbnail` from `services/thumbnail.ts` | Already called in upload pipeline; thumbnail already exists |
| Debounce | Manual setTimeout management | Use a `useRef` for the timer handle | Simple pattern, no library needed for a single timer |
| Context menu | Full custom dropdown | Simple `position:fixed` `<ul>` at pointer coordinates | Pattern already used for EasingPicker and KeyframeTimeline context menus |
| File deletion | Custom cleanup | `node:fs/promises rm({ recursive: true })` | Removes entire job directory — no dependencies |

**Key insight:** This phase is almost entirely integration glue. Every primitive already exists. The work is wiring it together correctly.

---

## Runtime State Inventory

> This section is required because the phase touches job directories, the in-memory `fastify.jobs` Map, and the filesystem.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `data/*.db` files: `presets.db`, `lane_presets.db` — no `projects.db` yet | Code creates `projects.db` on first startup — no migration |
| Live service config | `fastify.jobs` in-memory Map — holds active job state (upload/transcribe progress) | No change — projects table references `jobId`, jobs Map is ephemeral and unaffected |
| OS-registered state | None — no task scheduler or pm2 entries for job IDs | None |
| Secrets/env vars | None — no env var names reference project IDs | None |
| Build artifacts | `data/{jobId}/` directories already on disk (4 confirmed) — thumbnails already extracted | No migration. New project records created going forward. Existing job directories are orphans until Phase 13 runs (no project record). If desired, a one-time migration could create project records for existing job dirs, but this is NOT required by the decisions. |

**Existing job directory data:** There are 4 job directories already in `data/` with `thumbnail.jpg` files. These are pre-Phase-13 sessions. On first use of the new UI, they will not appear in the project list (no project record). This is expected — they are development test jobs.

---

## Common Pitfalls

### Pitfall 1: Loading Project Calls `setJob` Instead of Restoring Snapshot
**What goes wrong:** `setJob` calls `buildSessionPhrases` which re-derives phrases from words using auto-grouping rules. This destroys any manual phrase structure the user created.
**Why it happens:** `setJob` is the natural "here is a transcript, load it" entry point — but it was designed for the first-load case after transcription, not for restoring saved state.
**How to avoid:** Create a `loadProject(blob: ProjectStateBlob)` action on the store (or call `useSubtitleStore.setState` directly) that sets all fields from the saved blob, re-hydrating `manualSplitWordIndices` as `new Set(blob.session.manualSplitWordIndices)`. The `phrases` array from the blob is used directly — no re-derivation.
**Warning signs:** If phrases are different after load than before save, `setJob` is being called.

### Pitfall 2: Auto-Save Fires During Transcription / Upload Progress
**What goes wrong:** The Zustand `subscribe` fires whenever any store field changes. During transcription, the store may be partially populated (e.g., `jobId` is set but `session` is null). Auto-saving an incomplete state can corrupt the project record.
**Why it happens:** `subscribe` is unconditional — it fires on every `set` call.
**How to avoid:** The `buildStateBlob` helper should only serialize when `state.session !== null`. Add a guard: `if (!state.session) return` (skip the save). Additionally, only attach the subscription after the project is in an editing state (post-transcription).
**Warning signs:** `state_json` in the DB has `session: null`.

### Pitfall 3: Fastify Decorator Conflict
**What goes wrong:** Registering `projectStorePlugin` with `fastify.decorate('db', ...)` instead of `fastify.decorate('projectsDb', ...)` would crash because `fastify.db` is already taken by `animationPresetsPlugin`.
**Why it happens:** Copy-paste from `animationPresets.ts` without renaming the decorator.
**How to avoid:** Use `fastify.projectsDb` — follow the naming pattern established by `lanePresets.ts` (`lanePresetsDb`).
**Warning signs:** Fastify startup error: `FST_ERR_DEC_ALREADY_PRESENT: The decorator 'db' has already been added!`

### Pitfall 4: Duplicate Action on `SubtitlesPage` Creates Two Projects
**What goes wrong:** D-16 (Duplicate) creates a new project record with cloned state. If `SubtitlesPage` is opened for the new project and triggers its mount-time "create project" logic, a second empty project record is created.
**Why it happens:** If project creation is triggered by `SubtitlesPage` mounting rather than by a discrete user action.
**How to avoid:** Project creation happens in two specific places only: (a) when a new video is uploaded via `useUpload` (D-10), (b) via the Duplicate API call. `SubtitlesPage` receives a `projectId` prop — it never creates a project, it only reads and updates.

### Pitfall 5: Delete Races With Auto-Save
**What goes wrong:** User right-clicks → Delete → confirms → backend deletes project record. Meanwhile, the debounced auto-save fires and tries to PUT the now-deleted project, getting a 404.
**Why it happens:** The auto-save timer is set when the user opens the context menu (causing a store state read), and fires 4 seconds later.
**How to avoid:** On delete confirmation, immediately cancel the pending auto-save timer and navigate back to the project list before the backend call completes. The frontend unsubscribes when `projectId` becomes null (D-09 navigation flow handles this naturally).

### Pitfall 6: `state_json` Grows Large for Long Videos
**What goes wrong:** A video with many words/phrases produces a large `session.words` array. Serialized to JSON it may be 50-500KB for a typical video.
**Why it happens:** Every word has `word`, `start`, `end`, `confidence`, `speaker` fields.
**How to avoid:** This is expected and acceptable. SQLite handles blobs up to 1GB by default. No special handling needed. WAL mode ensures writes don't block reads.
**Warning signs:** Slow auto-save (>100ms) would indicate a problem; typical 5-minute video transcript is ~5,000 words = ~300KB JSON.

---

## Code Examples

### Serializing Store State for Persistence
```typescript
// Source: derived from captureSnapshot() in packages/frontend/src/store/subtitleStore.ts
// Helper to build the full project state blob

function buildStateBlob(state: ReturnType<typeof useSubtitleStore.getState>): ProjectStateBlob {
  if (!state.session) throw new Error('Cannot save: no session loaded')
  return {
    // Undo-snapshot fields (match captureSnapshot shape)
    session: {
      words: structuredClone(state.session.words),
      phrases: structuredClone(state.session.phrases),
      manualSplitWordIndices: Array.from(state.session.manualSplitWordIndices),
    },
    style: structuredClone(state.style) as Record<string, unknown>,
    maxWordsPerPhrase: state.maxWordsPerPhrase,
    speakerNames: { ...state.speakerNames },
    speakerStyles: structuredClone(state.speakerStyles) as Record<string, Record<string, unknown>>,
    activeAnimationPresetId: state.activeAnimationPresetId,
    activeHighlightPresetId: state.activeHighlightPresetId,
    phraseAnimationPresetIds: { ...state.phraseAnimationPresetIds },
    laneCount: state.laneCount,
    laneLocks: { ...state.laneLocks },
    phraseLaneOverrides: { ...state.phraseLaneOverrides },
    // Extra fields not in StateSnapshot
    jobId: state.jobId!,
    original: state.original,
    videoMetadata: state.videoMetadata,
  }
}
```

### Restoring Store State on Project Load
```typescript
// Source: derived from restoreSnapshot() in packages/frontend/src/store/subtitleStore.ts
// Called after GET /api/projects/:id returns state_json

function loadProjectBlob(blob: ProjectStateBlob): void {
  useSubtitleStore.setState({
    jobId: blob.jobId,
    original: blob.original,
    videoMetadata: blob.videoMetadata,
    session: {
      words: structuredClone(blob.session!.words) as SessionWord[],
      phrases: structuredClone(blob.session!.phrases) as SessionPhrase[],
      manualSplitWordIndices: new Set<number>(blob.session!.manualSplitWordIndices),
    },
    style: structuredClone(blob.style) as unknown as StyleProps,
    maxWordsPerPhrase: blob.maxWordsPerPhrase ?? 5,
    speakerNames: { ...blob.speakerNames },
    speakerStyles: structuredClone(blob.speakerStyles) as unknown as Record<string, SpeakerStyleOverride>,
    activeAnimationPresetId: blob.activeAnimationPresetId ?? null,
    activeHighlightPresetId: blob.activeHighlightPresetId ?? null,
    phraseAnimationPresetIds: blob.phraseAnimationPresetIds ?? {},
    laneCount: blob.laneCount ?? 2,
    laneLocks: blob.laneLocks ?? {},
    phraseLaneOverrides: blob.phraseLaneOverrides ?? {},
  })
  // D-06: fresh undo stack on load
  useUndoStore.getState().past.length = 0  // or call a reset action
}
```

### Project Creation on Upload (integration point)
```typescript
// In useUpload hook or SubtitlesPage, when job reaches 'ready' status:
// The project record is created with no state_json yet (editing not started)
const createProject = async (jobId: string, displayName: string) => {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, name: displayName }),
  })
  const { id } = await res.json() as { id: string }
  return id  // UUID — used as projectId prop for SubtitlesPage
}
```

### Delete with Full Cleanup (backend)
```typescript
// packages/backend/src/routes/projects.ts — DELETE /api/projects/:id
import { rm } from 'node:fs/promises'

fastify.delete('/api/projects/:id', async (req, reply) => {
  const { id } = req.params as { id: string }
  const row = getByIdStmt.get(id)
  if (!row) return reply.code(404).send({ error: 'Project not found' })

  const jobDir = path.join(DATA_ROOT, row.job_id)
  deleteStmt.run(id)

  // Delete job directory (non-blocking, ignore if already gone)
  rm(jobDir, { recursive: true, force: true }).catch(() => {})

  return reply.code(204).send()
})
```

### Context Menu (right-click on project card)
```typescript
// CSS pattern: position:fixed at pointer coordinates (established in codebase for EasingPicker)
// No external library — simple absolute-positioned overlay

interface ContextMenuState {
  x: number
  y: number
  projectId: string
}

// In ProjectCard.tsx:
const handleContextMenu = (e: React.MouseEvent) => {
  e.preventDefault()
  setContextMenu({ x: e.clientX, y: e.clientY, projectId: project.id })
}

// Rendered at document body level (or in ProjectsPage) with position:fixed
// <ul style={{ position: 'fixed', left: menu.x, top: menu.y }}>
//   <li onClick={handleRename}>Rename</li>
//   ...
// </ul>
// Closed on outside click via useEffect + document.addEventListener('pointerdown', ...)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `Subtitles` tab | Projects + Animation Builder tabs | Phase 13 | `TABS` array in App.tsx gets replaced |
| Stateless sessions (reload = fresh) | Project persistence with auto-save | Phase 13 | New `projects.db` + `projectsDb` decorator |
| Upload zone as primary view | Upload zone as empty state only | Phase 13 | `SubtitlesPage` becomes project-scoped |

**Deprecated/outdated after Phase 13:**
- `TABS` array in `App.tsx` with `{ id: 'subtitles', label: 'Subtitles' }` — replaced with Projects/Animation Builder
- `SubtitlesPage` as a top-level routed component — becomes a child component receiving `projectId` prop

---

## Open Questions

1. **Should existing job directories be migrated to project records?**
   - What we know: There are 4 existing job directories in `data/` with full data. They were created during development testing.
   - What's unclear: Whether the user wants them to appear in the project list.
   - Recommendation: Do not auto-migrate. Development test sessions are not production projects. If needed, a one-time migration script can be added later.

2. **Duplicate: does it copy video files or share the jobId?**
   - What we know: D-16 says "create a variant on the same video" and the context says "clone project editing state."
   - What's unclear: Whether `DELETE` on the original should also delete the duplicate's video (if they share `jobId`).
   - Recommendation: Share the `jobId` — duplicate points to the same video files. Delete should only delete files if no other project references the same `jobId`. Add a reference-count check to the delete route.

3. **How should projects with `state_json = NULL` be displayed in the card grid?**
   - What we know: A project record is created immediately on upload (before transcription). At that point `state_json` is null.
   - What's unclear: Should the card show a "transcribing..." state or just display with no subtitle preview?
   - Recommendation: Show card with thumbnail + name + spinner/status badge derived from job status. The card is still clickable — clicking it opens `SubtitlesPage` which shows the transcription-in-progress UI.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — all tools already installed and working)

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from config.json — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework detected in package.json scripts |
| Config file | None found |
| Quick run command | N/A — manual verification via browser |
| Full suite command | N/A |

No automated test infrastructure exists in this project. All verification is done manually via the browser (hands-on testing approach per user profile).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| — | Project list shows card grid | manual | open browser, check Projects tab | — |
| — | Create new project via upload | manual | drag video file, verify card appears | — |
| — | Auto-save fires after edit | manual | edit subtitle text, wait 4s, reload app, verify change persists | — |
| — | Delete removes files | manual | delete project, verify `data/{jobId}/` is gone | — |
| — | Duplicate creates variant | manual | duplicate, edit new copy, verify original unchanged | — |
| — | Nav restructure (Projects | Animation Builder) | manual | verify top nav shows correct tabs | — |

### Wave 0 Gaps
None — no test framework to set up. All phase verification is manual.

---

## Sources

### Primary (HIGH confidence)
- `packages/backend/src/services/animationPresets.ts` — SQLite plugin pattern, WAL mode, table creation, Fastify decorator
- `packages/backend/src/services/lanePresets.ts` — Separate DB decorator naming convention (`lanePresetsDb`)
- `packages/backend/src/routes/presets.ts` — CRUD route structure, prepared statements, rowToPreset mapper
- `packages/backend/src/routes/upload.ts` — Upload pipeline, thumbnail extraction already called
- `packages/backend/src/services/thumbnail.ts` — FFmpeg thumbnail extraction at 1-second mark, already working
- `packages/frontend/src/store/subtitleStore.ts` — Full store state shape, captureSnapshot, restoreSnapshot, all fields to persist
- `packages/frontend/src/store/undoMiddleware.ts` — StateSnapshot type definition
- `packages/shared-types/src/index.ts` — Job, Transcript, VideoMetadata types
- `packages/frontend/src/App.tsx` — Current navigation pattern to modify
- `packages/frontend/src/hooks/useUpload.ts` — Upload hook integration point
- `data/` directory listing — Confirmed thumbnail.jpg already extracted for existing jobs

### Secondary (MEDIUM confidence)
- STATE.md decisions log — Confirmed better-sqlite3 patterns, fp() requirement for decorator sharing

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and used; verified in codebase
- Architecture: HIGH — patterns directly observed in existing backend services/routes
- Serialization: HIGH — `captureSnapshot`/`restoreSnapshot` already implement the exact serialization needed
- Pitfalls: HIGH — derived from direct code analysis of integration points
- Auto-save pattern: MEDIUM — `useSubtitleStore.subscribe` is a Zustand standard feature; debounce timer approach is idiomatic

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable stack; no fast-moving dependencies)
