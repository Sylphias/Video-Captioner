---
phase: 05-server-render-and-output
plan: 01
subsystem: api
tags: [remotion, bundler, renderer, worker-threads, sse, ssr, mp4, render-pipeline]

requires:
  - phase: 03-composition-and-preview
    provides: SubtitleComposition component, COMPOSITION_ID, remotion-composition package structure
  - phase: 04.1-multi-speaker-diarization-and-speaker-lanes
    provides: TranscriptPhrase/StyleProps types, diarization lifecycle returning to 'transcribed'

provides:
  - POST /api/jobs/:jobId/render — accepts phrases+style, returns 202, dispatches to worker thread
  - GET /api/jobs/:jobId/download — streams rendered MP4 with Content-Disposition attachment header
  - Remotion bundle initialized at server startup via initBundle() using bundle()
  - render-worker.ts runs selectComposition + renderMedia with onProgress progress reporting
  - 'rendering' and 'rendered' JobStatus values and outputPath field on Job
  - SSE closes on 'rendered' terminal state; outputPath stripped from broadcasts
  - remotion-entry.ts calling registerRoot(RemotionRoot) as entry point for bundle()
  - Root.tsx with RemotionRoot wrapping SubtitleComposition in Remotion Composition
  - SubtitleComposition uses OffthreadVideo during server render, Video during browser preview

affects: [05-02-render-ui]

tech-stack:
  added:
    - "@remotion/bundler@4.0.379 (exact, no ^)"
    - "@remotion/renderer@4.0.379 (exact, no ^)"
  patterns:
    - "bundle() called once at startup — never per render (anti-pattern per Remotion docs)"
    - "renderMedia() dispatched to worker_threads to avoid blocking Fastify event loop"
    - "Worker posts { type: 'progress' | 'done' | 'error' } messages to main thread"
    - "Main thread writes progress to job store; existing SSE polling picks it up automatically"
    - "videoSrc must be HTTP URL for headless Chrome (not filesystem path)"

key-files:
  created:
    - packages/remotion-composition/src/Root.tsx
    - packages/remotion-composition/src/remotion-entry.ts
    - packages/backend/src/services/render.ts
    - packages/backend/src/workers/render-worker.ts
    - packages/backend/src/routes/render.ts
  modified:
    - packages/shared-types/src/index.ts
    - packages/remotion-composition/src/SubtitleComposition.tsx
    - packages/backend/src/routes/jobs.ts
    - packages/backend/src/index.ts
    - packages/backend/package.json

key-decisions:
  - "remotion-entry.ts is the bundle() entry point (not index.ts) — avoids collision with frontend package exports"
  - "OffthreadVideo conditional via useRemotionEnvironment().isRendering — frame-perfect for server render, Video for browser Player"
  - "Worker thread file referenced by path.resolve to .ts file — works with Node 22 --experimental-strip-types"
  - "Composition<AnyZodObject, Props> type params not usable directly due to Record<string,unknown> constraint — used TypedComposition = Composition as any workaround"
  - "videoSrc set to http://localhost:3001/api/jobs/${jobId}/video — headless Chrome cannot access filesystem paths"
  - "durationInFrames computed as Math.floor(duration * fps) — must be integer, Math.floor not Math.round"

patterns-established:
  - "Pattern: bundle() at server startup — initBundle() called before fastify.listen(), result stored in module-level variable"
  - "Pattern: Worker progress reporting — parentPort.postMessage({ type, progress/error }) → updateJob() → SSE polling"

duration: 10min
completed: 2026-03-05
---

# Phase 5 Plan 1: Server Render and Output Summary

**Remotion SSR pipeline with bundle-at-startup, worker-thread renderMedia, and render/download endpoints serving burned-in subtitle MP4s**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-05T13:26:29Z
- **Completed:** 2026-03-05T13:36:36Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Full backend render pipeline: bundle() at startup, worker thread runs selectComposition + renderMedia, progress flows through existing SSE infrastructure
- POST /api/jobs/:jobId/render and GET /api/jobs/:jobId/download endpoints complete with proper validation
- Remotion entry point (remotion-entry.ts + Root.tsx) enabling bundle() to work with the remotion-composition package
- SubtitleComposition upgraded to use OffthreadVideo during server render for frame-accurate subtitle timing

## Task Commits

Each task was committed atomically:

1. **Task 1: Add render types, Remotion entry point, and install SSR packages** - `b26a2c4` (feat)
2. **Task 2: Render service, worker thread, render/download routes, and SSE terminal state** - `ca98296` (feat)

**Plan metadata:** `4218400` (docs: complete plan)

## Files Created/Modified
- `packages/shared-types/src/index.ts` - Added 'rendering', 'rendered' to JobStatus, outputPath to Job
- `packages/remotion-composition/src/Root.tsx` - RemotionRoot component wrapping SubtitleComposition in Remotion Composition (NEW)
- `packages/remotion-composition/src/remotion-entry.ts` - Calls registerRoot(RemotionRoot) — entry point for bundle() (NEW)
- `packages/remotion-composition/src/SubtitleComposition.tsx` - Conditionally uses OffthreadVideo (server) vs Video (browser)
- `packages/backend/src/services/render.ts` - initBundle() at startup + dispatchRender() spawning worker thread (NEW)
- `packages/backend/src/workers/render-worker.ts` - selectComposition + renderMedia + onProgress message posting (NEW)
- `packages/backend/src/routes/render.ts` - POST /api/jobs/:jobId/render + GET /api/jobs/:jobId/download (NEW)
- `packages/backend/src/routes/jobs.ts` - SSE terminal state adds 'rendered'; outputPath stripped from broadcasts
- `packages/backend/src/index.ts` - Registers renderRoutes, calls initBundle() before fastify.listen()
- `packages/backend/package.json` - Added @remotion/bundler@4.0.379 and @remotion/renderer@4.0.379 (exact)

## Decisions Made
- `remotion-entry.ts` named separately from `index.ts` to avoid collision with frontend package exports
- `useRemotionEnvironment().isRendering` conditional: OffthreadVideo for server render, Video for browser Player
- Worker .ts file referenced via `path.resolve(__dirname, '../workers/render-worker.ts')` — works with Node 22 `--experimental-strip-types`
- `Composition as any` cast used in Root.tsx — Remotion's `Composition` generic requires `Record<string,unknown>` constraint which SubtitleCompositionProps doesn't satisfy due to missing index signature
- videoSrc in render inputProps is HTTP URL (`http://localhost:3001/api/jobs/${jobId}/video`) — headless Chrome cannot access filesystem paths directly
- `Math.floor(duration * fps)` for durationInFrames — Remotion requires integer, not float

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Composition type error: Props must extend Record<string, unknown>**
- **Found during:** Task 1 (Root.tsx creation, TypeScript check)
- **Issue:** `<Composition<SubtitleCompositionProps>>` failed because `SubtitleCompositionProps` lacks a string index signature required by `Record<string, unknown>`. Remotion's `Composition` generic has this constraint.
- **Fix:** Used `const TypedComposition = Composition as any` workaround — all props still typed at the call site, just bypasses the Composition generic constraint
- **Files modified:** `packages/remotion-composition/src/Root.tsx`
- **Verification:** `npx tsc --build tsconfig.build.json` exits 0
- **Committed in:** b26a2c4 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - TypeScript type bug in Remotion Composition generic)
**Impact on plan:** Fix was necessary for TypeScript compilation. No scope creep — same runtime behavior.

## Issues Encountered
- Port 3001 already in use when verifying server startup during Task 2 — this was the existing backend instance running in development, not a problem. The Remotion bundle logged successfully before the EADDRINUSE error.

## User Setup Required
None - no external service configuration required for this plan. Remotion Chrome Headless Shell is auto-installed by @remotion/renderer.

## Next Phase Readiness
- Backend render pipeline complete: bundle, dispatch, progress, download all implemented
- Phase 05-02 can now add the frontend UI: render button, progress bar, download link
- All success criteria met: types, entry point, worker, routes, SSE terminal state, TypeScript clean

---
*Phase: 05-server-render-and-output*
*Completed: 2026-03-05*
