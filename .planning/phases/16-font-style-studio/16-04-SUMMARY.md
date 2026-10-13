---
phase: 16-font-style-studio
plan: 04
subsystem: ui
tags: [react, remotion-player, style-studio, auto-save, text-styles]

requires:
  - phase: 16-02
    provides: "useTextStyles hook and /api/styles library"
  - phase: 16-03
    provides: "Shared StyleControls (value/onChange/allowCustomFont/disabled)"
provides:
  - "Style Studio top-level tab (third tab) with three-column page"
  - "StylePreview: static Remotion Player preview of the real SubtitleOverlay at 1920x1080 over Dark/Light/Checker/Custom backdrops"
  - "StyleLibraryList: Built-in / My styles with New, inline Rename, Duplicate, Delete with inline confirmation"
  - "styleLibrary.ts: createDebouncedSaver (serialised), resolveSelection, nextStyleName, STUDIO_AUTOSAVE_DELAY_MS"
affects: [16-05, 16-06]

actuals:
  tokens: 22000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure debounced saver with a promise chain: schedule/flush/cancel/pendingId, flush on selection change and unmount"
    - "Draft state loaded from the selected style only when the selected id changes, so list refetches after a save never clobber edits"
    - "Studio isolation: nothing under StyleStudio/ touches the project (subtitle) store"

key-files:
  created:
    - packages/frontend/src/components/StyleStudio/StyleStudioPage.tsx
    - packages/frontend/src/components/StyleStudio/StyleStudioPage.css
    - packages/frontend/src/components/StyleStudio/StylePreview.tsx
    - packages/frontend/src/components/StyleStudio/StylePreview.css
    - packages/frontend/src/components/StyleStudio/StyleLibraryList.tsx
    - packages/frontend/src/components/StyleStudio/StyleLibraryList.css
    - packages/frontend/src/lib/styleLibrary.ts
    - packages/frontend/src/lib/styleLibrary.test.ts
  modified:
    - packages/frontend/src/App.tsx

key-decisions:
  - "Auto-save delay 700 ms; no manual save button or Ctrl+S"
  - "Rename and delete confirmation are inline UI (no window.confirm/prompt); a New style enters inline rename once it appears in the refetched list"
  - "Studio passes allowCustomFont={false} and disabled for built-ins; handleChange also ignores built-ins"
  - "New styles start from pickLookProps(DEFAULT_STYLE) (DEFAULT_STYLE imported as a constant only)"

patterns-established:
  - "Rename input guards against the blur fired on unmount with a ref so a commit or cancel runs once"

requirements-completed: [D-01, D-02, D-03, D-04, D-14, D-15, D-16]

duration: ~25min
completed: 2026-10-13
status: complete
---

# Phase 16 Plan 04: Style Studio page Summary

A third "Style Studio" tab where the user browses the global style library, previews any style statically (second word highlighted) over a chosen backdrop, edits their own styles with 700 ms serialised auto-save, and creates, renames, duplicates and deletes styles; built-ins stay read-only with Duplicate.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 | Studio tab, three-column page, static backdrop-aware StylePreview | a4747fe |
| 2 | createDebouncedSaver / resolveSelection (TDD, 7 tests), draft state, auto-save, read-only built-ins | 7c77257 |
| 3 | nextStyleName (TDD, test 8), StyleLibraryList, library CRUD wiring | 4077410 |

## Verification

- `just build-libs && npx tsc --noEmit -p packages/frontend`: clean after each task.
- `vitest run src/lib/styleLibrary`: 8 passing tests (RED was observed before each implementation).
- Full frontend suite: 91 pass, 5 fail, all 5 the pre-existing `subtitleStore bulk actions` baseline failures.
- Acceptance greps: 0 `useSubtitleStore` in StyleStudio/, 0 `window.confirm|prompt`, 0 `autoPlay|loop` in StylePreview, 0 manual save buttons, `allowCustomFont={false}` 1, `pickLookProps(DEFAULT_STYLE)` 1, `<StyleLibraryList` 1, `style-studio` tab entry and render in App.tsx.
- Not exercised: a live browser check of the Studio (no UI test harness for these components; the backend was not booted). The visual result (highlight word, backdrops, inline rename/confirm flow) is unverified in a running app.

## Deviations from Plan

None - plan executed as written. Small additions within intent: a `renameCancelledRef` guard in StyleLibraryList (prevents a double rename commit from the blur fired when the input unmounts), and a `newlyCreatedId` effect so a New style enters rename mode once the refetched list contains it.

## Known Limitations

- If the user switches away from an edited style and back within the time of a single list refetch, the draft is reloaded from the not-yet-refreshed list entry. Window is milliseconds; a follow-up could seed the draft cache from the PUT response.
- Some `.style-studio-page__row*` / `__heading` CSS is now unused after StyleLibraryList replaced the inline list (cosmetic dead CSS; Phase 17 redesign will rework the UI).

## Process notes

- Source files are CRLF; new files were normalised to CRLF and App.tsx was edited with a CRLF-aware script.

## Known Stubs

None.

## Threat Flags

None. T-16-11 (serialised saver, flush on switch/unmount, draft never reset by refetch), T-16-12 (built-ins ignored in handleChange, controls disabled, no Rename/Delete rendered) and T-16-13 (no subtitle-store usage in StyleStudio/) are implemented and grep/test verified.

## Self-Check: PASSED

All created files exist; commits a4747fe, 7c77257, 4077410 are present in git log.
