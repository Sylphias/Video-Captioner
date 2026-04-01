---
phase: 13-project-persistence-and-landing-page
plan: 03
subsystem: ui
tags: [react, typescript, navigation, project-list, landing-page]

# Dependency graph
requires:
  - phase: 13-project-persistence-and-landing-page
    plan: 01
    provides: GET /api/projects, GET /api/projects/:id, POST /api/projects, GET /api/jobs/:jobId/thumbnail
  - phase: 13-project-persistence-and-landing-page
    plan: 02
    provides: buildStateBlob, loadProjectBlob, ProjectStateBlob interface
provides:
  - App.tsx with two-tab nav (Projects + Animation Builder) and activeProjectId routing
  - ProjectsPage — landing page with card grid or empty state with upload zone
  - ProjectCard — individual project card with thumbnail, name, date, duration
  - SubtitlesPage project-scoping — loads saved state from backend on mount
affects: [13-04-auto-save-indicator]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "activeProjectId in App.tsx — project routing state (no router library)"
    - "ProjectsPage creates project via POST /api/projects after upload completes"
    - "SubtitlesPage project loading guard — useState(false) + useEffect + if (!projectLoaded) return null"
    - "ProjectRecord type added to shared-types (forward-compat from Plan 01)"
    - "projectState.ts added to worktree (forward-compat from Plan 02)"

key-files:
  created:
    - packages/frontend/src/pages/ProjectsPage.tsx
    - packages/frontend/src/pages/ProjectsPage.css
    - packages/frontend/src/components/ProjectCard.tsx
    - packages/frontend/src/components/ProjectCard.css
    - packages/frontend/src/lib/projectState.ts
  modified:
    - packages/frontend/src/App.tsx
    - packages/frontend/src/pages/SubtitlesPage.tsx
    - packages/shared-types/src/index.ts

key-decisions:
  - "projectLoaded guard placed after ALL hooks in SubtitlesPage — React hooks-rule compliance (early return must come after all hook calls)"
  - "ProjectRecord type added to shared-types in this worktree — Plan 01 ran in a parallel worktree and the type was not available in this branch"
  - "projectState.ts created from scratch — Plan 02 ran in a parallel worktree; code is identical to the Plan 02 output"
  - "StyleProps cast uses double-cast (as unknown as Record<string,unknown>) — StyleProps lacks index signature"

patterns-established:
  - "Two-tab nav (Projects + Animation Builder) replaces single Subtitles tab"
  - "SubtitlesPage accepts optional projectId prop for project-scoped editing"

requirements-completed: [D-01, D-02, D-03, D-07, D-08, D-09, D-10, D-11]

# Metrics
duration: 6min
completed: 2026-04-01
---

# Phase 13 Plan 03: Navigation Restructure and ProjectsPage Summary

**Two-tab nav (Projects + Animation Builder), ProjectsPage card grid with upload flow, SubtitlesPage project-scoping with loadProjectBlob on mount**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-01T12:51:13Z
- **Completed:** 2026-04-01T12:57:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Updated `App.tsx` with Projects + Animation Builder tabs replacing old Subtitles tab
- Added `activeProjectId` routing state — clicking a project card sets activeProjectId, clicking Projects tab clears it (D-09)
- Created `ProjectsPage.tsx` — fetches `/api/projects` on mount, renders empty state (UploadZone) when no projects, card grid + New Project card when projects exist
- ProjectsPage handles upload → POST `/api/projects` → navigate to new project (D-10)
- Created `ProjectCard.tsx` — thumbnail via `/api/jobs/:jobId/thumbnail`, name, formatted date, optional duration
- Added responsive grid layout: `repeat(auto-fill, minmax(240px, 1fr))` per UI spec (D-01)
- Modified `SubtitlesPage.tsx` — accepts `projectId?: string` and `onBack?: () => void` props
- Project loading effect: fetches `/api/projects/:id`, parses `stateJson`, calls `loadProjectBlob` to restore store
- Added `ProjectRecord` interface to shared-types (forward-compat — Plan 01 ran in parallel worktree)
- Added `projectState.ts` to this worktree (forward-compat — Plan 02 ran in parallel worktree)

## Task Commits

Each task was committed atomically:

1. **Task 1: App.tsx nav restructure + ProjectsPage with card grid** - `9164795` (feat)
2. **Task 2: SubtitlesPage project-scoping** - `1f00a9f` (feat)

## Files Created/Modified

- `packages/frontend/src/App.tsx` — Two-tab nav, activeProjectId routing, conditional ProjectsPage/SubtitlesPage render
- `packages/frontend/src/pages/ProjectsPage.tsx` — Landing page with card grid, empty state, upload + project creation flow
- `packages/frontend/src/pages/ProjectsPage.css` — Grid layout, empty state, upload state styles
- `packages/frontend/src/components/ProjectCard.tsx` — Thumbnail, name, date, duration display
- `packages/frontend/src/components/ProjectCard.css` — Card hover states, 160px thumbnail area
- `packages/frontend/src/lib/projectState.ts` — ProjectStateBlob interface, buildStateBlob, loadProjectBlob
- `packages/frontend/src/pages/SubtitlesPage.tsx` — Added props interface, project loading effect, projectLoaded guard
- `packages/shared-types/src/index.ts` — Added ProjectRecord interface

## Decisions Made

- Placed `projectLoaded` state + `useEffect` + guard AFTER all other hooks in SubtitlesPage — React's rules of hooks require all hook calls to be unconditional and in the same order every render; early returns must come after all hooks
- Added forward-compat dependencies (ProjectRecord + projectState.ts) directly in this worktree — parallel execution with Plan 01/02 worktrees means these weren't available on this branch
- Double-cast `StyleProps` → `unknown` → `Record<string,unknown>` in projectState.ts — StyleProps lacks an index signature so single cast is rejected by TypeScript strict mode

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ProjectRecord to shared-types dist in main project**
- **Found during:** Task 1 (TypeScript check)
- **Issue:** Plan 01 added ProjectRecord to shared-types in a parallel worktree; main project's shared-types dist was outdated (before Plan 01)
- **Fix:** Rebuilt main project's shared-types dist to include ProjectRecord
- **Files modified:** `packages/shared-types/dist/` (not tracked by git, generated file)
- **Commit:** Included in Task 1 source edit

**2. [Rule 3 - Blocking] Added projectState.ts to worktree**
- **Found during:** Task 1 (TypeScript check — `lib/projectState.ts` missing)
- **Issue:** Plan 02 created projectState.ts in a parallel worktree; this worktree doesn't have it
- **Fix:** Created projectState.ts using the identical content from Plan 02's commit
- **Files modified:** `packages/frontend/src/lib/projectState.ts`
- **Commit:** 9164795 (Task 1 commit)

**3. [Rule 1 - Bug] StyleProps double-cast in projectState.ts**
- **Found during:** Task 1 (TypeScript error)
- **Issue:** `structuredClone(state.style) as Record<string, unknown>` — StyleProps has no index signature
- **Fix:** Changed to `structuredClone(state.style) as unknown as Record<string, unknown>`
- **Files modified:** `packages/frontend/src/lib/projectState.ts`
- **Commit:** 9164795 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (Rules 1 and 3)
**Impact on plan:** All deviations were forward-compat issues from parallel worktree execution. Code is correct and TypeScript-clean.

## Issues Encountered

None beyond the auto-fixed parallel worktree compatibility issues.

## User Setup Required

None — frontend changes only, no new environment variables or external services.

## Next Phase Readiness

- Plan 13-04 (auto-save + AutoSaveIndicator) has working project routing and load flow
- SubtitlesPage correctly receives projectId from App.tsx
- ProjectsPage correctly creates project records on upload

---
*Phase: 13-project-persistence-and-landing-page*
*Completed: 2026-04-01*
