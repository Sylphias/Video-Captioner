---
phase: 13-project-persistence-and-landing-page
plan: 04
subsystem: ui
tags: [react, context-menu, auto-save, zustand, css]

requires:
  - phase: 13-03
    provides: ProjectCard, ProjectsPage, SubtitlesPage with project-scoping

provides:
  - ProjectContextMenu (right-click: Rename, Duplicate, Re-transcribe, Delete)
  - DeleteConfirmDialog (confirmation modal with Keep/Delete buttons)
  - Inline rename input on ProjectCard
  - ProjectsPage lifecycle actions (rename/duplicate/re-transcribe/delete with API calls)
  - AutoSaveIndicator (Saving/Saved/Error fixed bottom-right, fades after 3s)
  - SubtitlesPage auto-save with 4-second debounce on store subscription

affects:
  - project management flow
  - SubtitlesPage editing persistence

tech-stack:
  added: []
  patterns:
    - "Context menu: position fixed at clientX/clientY, dismiss on pointerdown outside or Escape"
    - "Auto-save: useSubtitleStore.subscribe with clearTimeout/setTimeout debounce, 4000ms"
    - "Pitfall #2 guard: if (!blob) return — skip save when session is not yet loaded"

key-files:
  created:
    - packages/frontend/src/components/ProjectContextMenu.tsx
    - packages/frontend/src/components/ProjectContextMenu.css
    - packages/frontend/src/components/DeleteConfirmDialog.tsx
    - packages/frontend/src/components/DeleteConfirmDialog.css
    - packages/frontend/src/components/AutoSaveIndicator.tsx
    - packages/frontend/src/components/AutoSaveIndicator.css
  modified:
    - packages/frontend/src/components/ProjectCard.tsx
    - packages/frontend/src/components/ProjectCard.css
    - packages/frontend/src/pages/ProjectsPage.tsx
    - packages/frontend/src/pages/SubtitlesPage.tsx

key-decisions:
  - "ProjectContextMenu uses useRef + pointerdown outside-click dismiss (same pattern as KeyframeTrackRow context menu)"
  - "Rename commit guard: renamingValue.trim() === '' cancels instead of saving empty name"
  - "Auto-save uses useSubtitleStore.subscribe (not useEffect + selector) — fires on any store change without React re-render overhead"
  - "handleRenameCommit made async — await fetch + fetchProjects in sequence"

patterns-established:
  - "Context menu state: { x, y, projectId } | null in parent — only one open at a time"
  - "Inline rename: isRenaming + renamingValue props on card, parent owns all rename state"

requirements-completed: [D-04, D-12, D-13, D-14, D-15, D-16, D-17]

duration: 4min
completed: 2026-04-01
---

# Phase 13 Plan 04: Context Menu, Delete Dialog, Rename, and Auto-Save Summary

**Right-click project lifecycle actions (Rename/Duplicate/Re-transcribe/Delete with confirmation dialog) and 4-second debounced auto-save with Saved/Saving/Error indicator in bottom-right corner**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-01T13:05:51Z
- **Completed:** 2026-04-01T13:09:37Z
- **Tasks:** 2 (plus 1 checkpoint)
- **Files modified:** 10

## Accomplishments

- ProjectContextMenu component: fixed-position right-click menu with Rename, Duplicate, Re-transcribe, Delete — dismiss on outside click or Escape
- DeleteConfirmDialog modal: 400px dialog with backdrop, "Delete Project?" title, warning copy, Keep/Delete buttons
- ProjectCard inline rename: isRenaming + input with autoFocus, Enter/blur commit, Escape cancel
- ProjectsPage: all CRUD lifecycle actions wired to backend API with fetchProjects refresh
- AutoSaveIndicator: 3-state indicator (Saving/Saved/Error) with 3-second fade on Saved
- SubtitlesPage: auto-save via useSubtitleStore.subscribe + 4000ms debounce, Pitfall #2 guard

## Task Commits

1. **Task 1: Context menu, delete dialog, rename, and card integration** - `4476da9` (feat)
2. **Task 2: Auto-save with debounce and status indicator** - `78bab55` (feat)

## Files Created/Modified

- `packages/frontend/src/components/ProjectContextMenu.tsx` - Right-click context menu with 4 actions
- `packages/frontend/src/components/ProjectContextMenu.css` - Menu styles (min-width 160px, box-shadow)
- `packages/frontend/src/components/DeleteConfirmDialog.tsx` - Delete confirmation modal
- `packages/frontend/src/components/DeleteConfirmDialog.css` - Dialog styles (backdrop rgba(0,0,0,0.6))
- `packages/frontend/src/components/AutoSaveIndicator.tsx` - Save status indicator (SaveStatus type)
- `packages/frontend/src/components/AutoSaveIndicator.css` - Fixed bottom-right, green dot, fade-in animation
- `packages/frontend/src/components/ProjectCard.tsx` - Added context menu + rename input props
- `packages/frontend/src/components/ProjectCard.css` - Added project-card__rename-input style
- `packages/frontend/src/pages/ProjectsPage.tsx` - All lifecycle state + API calls
- `packages/frontend/src/pages/SubtitlesPage.tsx` - Auto-save effect + AutoSaveIndicator render

## Decisions Made

- Auto-save uses `useSubtitleStore.subscribe` (not `useEffect` + store selector) — fires on any state mutation without needing React re-render cycle, ensuring saves happen even during rapid edits.
- Rename commit guard cancels (not saves) on empty `renamingValue.trim()` — prevents blank project names.
- `handleRenameCommit` is async with `await fetchProjects()` — ensures card name updates immediately after save.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript error in `packages/frontend/src/lib/projectState.ts` (StyleProps type cast) — out of scope, not introduced by this plan.

## Known Stubs

None — all API calls wire to real backend endpoints from Plan 13-01.

## Next Phase Readiness

- Phase 13 complete: full project persistence and landing page shipped
- Context menu actions functional; auto-save wires to PUT /api/projects/:id
- Human verification checkpoint (Task 3) confirms full end-to-end flow

## Self-Check: PASSED

- All created files exist at expected paths
- Commits 4476da9 and 78bab55 confirmed in git log

---
*Phase: 13-project-persistence-and-landing-page*
*Completed: 2026-04-01*
