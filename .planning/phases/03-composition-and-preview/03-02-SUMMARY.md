---
phase: 03-composition-and-preview
plan: 02
subsystem: ui
tags: [remotion, player, zustand, video-streaming, karaoke, preview, fastify]

# Dependency graph
requires:
  - phase: 03-composition-and-preview/plan-01
    provides: SubtitleComposition, SubtitleOverlay, StyleProps, @eigen/remotion-composition package
  - phase: 02-transcription
    provides: Transcript with word-level timestamps from useTranscribe hook
  - phase: 01-foundation
    provides: Fastify backend with job store, upload pipeline, SSE progress

provides:
  - GET /api/jobs/:jobId/video route with HTTP Range support for seeking
  - Zustand subtitleStore with jobId, transcript, videoMetadata, style state
  - PreviewPanel component wrapping @remotion/player with viewport-fit sizing
  - SubtitlesPage integration showing preview after transcription completes

affects:
  - 04-transcript-editor (editor UI will modify subtitleStore transcript/style)
  - 05-render (server render uses same SubtitleComposition)
  - 06-styling (style controls update subtitleStore.style)

# Tech tracking
tech-stack:
  added:
    - "@remotion/player@4.0.379 (Player component for browser preview)"
    - "zustand@5.x (state management for subtitle/video/style data)"
  patterns:
    - "Viewport-fit Player sizing: derive maxWidth from 65vh * aspect ratio, responsive to window resize"
    - "Zustand store bridges hooks to composition: setJob pushes transcript/metadata from useTranscribe into Player inputProps"
    - "HTTP Range video serving: 206 partial content for seeking, 200 full file for initial load"
    - "Video component for Player, OffthreadVideo reserved for server render"

key-files:
  created:
    - packages/frontend/src/store/subtitleStore.ts
    - packages/frontend/src/components/PreviewPanel.tsx
    - packages/frontend/src/components/PreviewPanel.css
  modified:
    - packages/backend/src/routes/jobs.ts (added video route)
    - packages/frontend/src/pages/SubtitlesPage.tsx (preview integration)
    - packages/frontend/src/pages/SubtitlesPage.css (preview layout)
    - packages/remotion-composition/src/SubtitleComposition.tsx (Video for Player)
    - packages/remotion-composition/src/SubtitleOverlay.tsx (conversation phrase grouping)

key-decisions:
  - "Video (not OffthreadVideo) for browser Player — OffthreadVideo is server-render only, Video renders HTML5 <video> element"
  - "Phrase grouping: 0.3s gap threshold + punctuation splits + 8 word max — conversational audio has sub-second gaps"
  - "Viewport-fit Player: 65vh height constraint derived via aspect ratio, responsive to resize"
  - "HTTP Range request support via createReadStream({ start, end }) — required for video seeking in Player"
  - "useEffect bridges transcribe completion to Zustand: setJob called when status transitions to transcribed"

patterns-established:
  - "Zustand store as bridge between hooks and composition props — keeps Player inputProps reactive"
  - "Backend video serving with Range headers for any video consumer"

# Metrics
duration: 8min
completed: 2026-03-03
---

# Phase 3 Plan 02: Frontend Preview Panel Summary

**Live karaoke preview with Remotion Player, Zustand state bridge, HTTP Range video serving, and viewport-fit sizing**

## Performance

- **Duration:** 8 min
- **Completed:** 2026-03-03
- **Tasks:** 3 (2 auto + 1 human verification checkpoint)
- **Files modified:** 8

## Accomplishments

- Backend `GET /api/jobs/:jobId/video` route with HTTP Range support for scrubber seeking
- Zustand `subtitleStore` bridging transcript/metadata from hooks to Player inputProps
- `PreviewPanel` wrapping `@remotion/player` with viewport-fit sizing (65vh height, responsive)
- SubtitlesPage shows live karaoke preview after transcription with Re-transcribe and Upload Another buttons
- Fixed phrase grouping for conversational audio: 0.3s gap + punctuation + 8-word max (was 1.5s, showed entire transcript)
- Switched from OffthreadVideo to Video for browser Player compatibility

## Task Commits

1. **Task 1: Backend video route with HTTP Range support** - `a0237fe` (feat)
2. **Task 2: Zustand store, PreviewPanel, and SubtitlesPage integration** - `46241e9` (feat)
3. **Task 3: Human verification + fixes** - `740250c` (fix: viewport-fit, Video for Player, conversation phrase grouping)

## Files Created/Modified

- `packages/backend/src/routes/jobs.ts` - Added GET /api/jobs/:jobId/video with Range request support
- `packages/frontend/src/store/subtitleStore.ts` - Zustand store for jobId, transcript, videoMetadata, style
- `packages/frontend/src/components/PreviewPanel.tsx` - Player wrapper with viewport-fit sizing
- `packages/frontend/src/components/PreviewPanel.css` - Preview panel styles
- `packages/frontend/src/pages/SubtitlesPage.tsx` - Preview integration in transcribed state
- `packages/frontend/src/pages/SubtitlesPage.css` - Preview layout styles
- `packages/remotion-composition/src/SubtitleComposition.tsx` - Switched to Video for Player
- `packages/remotion-composition/src/SubtitleOverlay.tsx` - Conversation-aware phrase grouping

## Decisions Made

- Used `Video` from remotion (not `OffthreadVideo`) for browser Player — OffthreadVideo doesn't render in Player context
- Reduced phrase gap from 1.5s to 0.3s — conversational audio has sub-second gaps between sentences
- Added punctuation-based phrase splitting (., ?, !) and 8-word max — prevents giant phrases
- Viewport-fit Player sizing at 65vh — prevents scrolling, responsive to window resize
- Phrase linger time of 0.5s after last word ends — keeps subtitle visible briefly for readability

## Deviations from Plan

### Post-Checkpoint Fixes

**1. OffthreadVideo → Video for Player context**
- **Found during:** Checkpoint verification
- **Issue:** OffthreadVideo is server-render only; does not render video in browser Player
- **Fix:** Switched to `Video` from remotion which renders HTML5 `<video>` element

**2. Phrase grouping too coarse for conversational audio**
- **Found during:** Checkpoint verification
- **Issue:** 1.5s gap threshold caused all 144 words to group into 1 phrase (conversation gaps are 0-0.7s)
- **Fix:** Lowered gap to 0.3s, added punctuation splits and 8-word max — produces 37 readable subtitle phrases

**3. Player too large**
- **Found during:** Checkpoint verification
- **Issue:** Player at 100% width filled entire viewport, required scrolling
- **Fix:** Viewport-fit sizing: derive maxWidth from 65vh * aspect ratio

---

**Total deviations:** 3 post-checkpoint fixes (all from user verification feedback)
**Impact on plan:** All fixes improve UX quality. No scope creep.

## Issues Encountered

- Backend needed restart after adding video route (no file watcher with `node --experimental-strip-types`)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full karaoke preview pipeline working: upload → transcribe → preview with word highlighting
- Zustand store ready for Phase 4 transcript editing (modify words, re-group phrases)
- SubtitleComposition pure props-driven — same component usable for Phase 5 server render
- Style defaults in store ready for Phase 6 style controls

---
*Phase: 03-composition-and-preview*
*Completed: 2026-03-03*

## Self-Check: PASSED

All created files verified. Commits a0237fe, 46241e9, 740250c in git log. User confirmed video plays with karaoke subtitles.
