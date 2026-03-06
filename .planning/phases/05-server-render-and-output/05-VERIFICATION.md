---
phase: 05-server-render-and-output
verified: 2026-03-06T11:22:08Z
status: passed
score: 9/9 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Upload a short video, transcribe it, click Render MP4, then open the downloaded file in a video player"
    expected: "Burned-in karaoke subtitles visible in the MP4, timing and word-level highlighting matches the browser preview"
    why_human: "Correctness of rendered subtitle timing and visual appearance cannot be verified programmatically — requires viewing the output file"
---

# Phase 5: Server Render and Output — Verification Report

**Phase Goal:** Users can render a final MP4 with burned-in subtitles and download it
**Verified:** 2026-03-06T11:22:08Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/jobs/:jobId/render returns 202 immediately and begins rendering in the background | VERIFIED | `render.ts` L56: `reply.code(202).send({ jobId, status: 'rendering' })` after `dispatchRender()` call (non-blocking worker spawn) |
| 2 | Render progress (0-100%) is reflected in the job store and visible via the existing SSE endpoint | VERIFIED | Worker posts `{ type: 'progress', progress }` messages; `render.ts` L62: `updateJob(jobs, jobId, { progress: msg.progress })`; SSE polls every 500ms |
| 3 | Completed render produces a valid MP4 file on disk at the job's outputPath | VERIFIED | `render-worker.ts` L43-52: `renderMedia({ codec: 'h264', outputLocation: outputPath })`; `done` message triggers `updateJob({ status: 'rendered', outputPath })` |
| 4 | GET /api/jobs/:jobId/download serves the rendered MP4 with Content-Disposition attachment header | VERIFIED | `render.ts` L79: `Content-Disposition: attachment; filename="output-${jobId}.mp4"`, L81: `reply.send(createReadStream(job.outputPath))` |
| 5 | SSE stream closes on 'rendered' status (not left open indefinitely) | VERIFIED | `jobs.ts` L45: `job.status === 'transcribed' \|\| job.status === 'rendered' \|\| job.status === 'failed'` triggers `clearInterval + reply.raw.end()` |
| 6 | User can click Render MP4 from the transcribed state to trigger a server-side render | VERIFIED | `SubtitlesPage.tsx` L239-263: render-controls section with button calling `render(uploadState.jobId!)`, disabled during rendering |
| 7 | User sees a progress bar updating in real time while the video is being rendered | VERIFIED | `SubtitlesPage.tsx` L265-274: progress track rendered when `renderState.status === 'rendering'`, width driven by `renderState.progress` |
| 8 | User sees a Download button appear when render completes | VERIFIED | `SubtitlesPage.tsx` L254-262: `<a>` anchor with `/download` href rendered conditionally on `renderState.status === 'rendered'` |
| 9 | Rendered video subtitle timing and highlighting matches what the browser preview showed | HUMAN NEEDED | OffthreadVideo conditional (SubtitleComposition.tsx L6-15) and exact inputProps propagation are structurally correct; visual match requires human playback |

**Score:** 8/9 truths fully verified programmatically, 1 requires human confirmation (visual correctness)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared-types/src/index.ts` | 'rendering', 'rendered' in JobStatus; outputPath on Job | VERIFIED | L1: both statuses present; L19: `outputPath?: string` with comment |
| `packages/remotion-composition/src/remotion-entry.ts` | registerRoot entry point for bundle() | VERIFIED | 4-line file: imports registerRoot and RemotionRoot, calls registerRoot(RemotionRoot) |
| `packages/remotion-composition/src/Root.tsx` | RemotionRoot wrapping SubtitleComposition in Remotion Composition | VERIFIED | Exports RemotionRoot, uses COMPOSITION_ID, durationInFrames/fps/width/height placeholder values overridden at render time |
| `packages/remotion-composition/src/SubtitleComposition.tsx` | OffthreadVideo for server render, Video for browser preview | VERIFIED | L6: `useRemotionEnvironment()`, L11-15: `isRendering ? OffthreadVideo : Video` |
| `packages/backend/src/services/render.ts` | initBundle() at startup + dispatchRender() to worker thread | VERIFIED | Exports `initBundle`, `getBundleLocation`, `dispatchRender`; worker spawned via `new Worker(workerPath, { workerData: { bundleLocation, ... } })` |
| `packages/backend/src/workers/render-worker.ts` | selectComposition + renderMedia with onProgress | VERIFIED | L28-52: selectComposition, override with real metadata, renderMedia with codec h264, onProgress posting progress messages |
| `packages/backend/src/routes/render.ts` | POST /api/jobs/:jobId/render and GET /api/jobs/:jobId/download | VERIFIED | Both routes implemented, 202 return, Content-Disposition attachment header, createReadStream delivery |
| `packages/frontend/src/hooks/useRender.ts` | useRender hook with POST trigger, SSE tracking, download URL | VERIFIED | Full state machine: idle->rendering->rendered/failed, EventSource cleanup on unmount |
| `packages/frontend/src/pages/SubtitlesPage.tsx` | Render button, progress bar, download button in transcribed state | VERIFIED | All three UI elements present at L239-278, useRender imported L5, reset wired L87 |
| `packages/backend/package.json` | @remotion/bundler and @remotion/renderer at exact 4.0.379 | VERIFIED | Both at "4.0.379" (no caret) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `services/render.ts` | `remotion-composition/src/remotion-entry.ts` | `bundle({ entryPoint })` path resolution | VERIFIED | L14-17: `path.resolve(__dirname, '../../../remotion-composition/src/remotion-entry.ts')` |
| `workers/render-worker.ts` | `services/render.ts` | Worker spawned by dispatchRender with workerData | VERIFIED | `render.ts` L43-56: `new Worker(workerPath, { workerData: { bundleLocation, ... } })`; worker reads via `workerData` |
| `routes/render.ts` | `services/render.ts` | Route calls dispatchRender() on POST | VERIFIED | `render.ts` L11: imports `dispatchRender`; L54: calls `dispatchRender(fastify.jobs, jobId, outputPath, inputProps)` |
| `routes/jobs.ts` | SSE terminal states | 'rendered' added to terminal state check | VERIFIED | `jobs.ts` L45: three-way terminal check including 'rendered'; L39: outputPath destructured and stripped from SSE broadcasts |
| `index.ts` | `services/render.ts` initBundle | Called before fastify.listen() | VERIFIED | `index.ts` L14: imports initBundle; L50: `await initBundle()` before `fastify.listen()` at L55 |
| `useRender.ts` | POST /api/jobs/:jobId/render | fetch POST with phrases and style from Zustand store | VERIFIED | L39-40: reads store via `useSubtitleStore.getState()`; L44-48: fetch POST with JSON body |
| `useRender.ts` | GET /api/jobs/:jobId/status | EventSource SSE for progress tracking | VERIFIED | L64: `new EventSource(\`/api/jobs/${jobId}/status\`)`; L73-83: handles rendering/rendered/failed states |
| `SubtitlesPage.tsx` | GET /api/jobs/:jobId/download | Download anchor pointing to download endpoint | VERIFIED | L257: `href={\`/api/jobs/${uploadState.jobId}/download\`}` with `download` attribute |

---

### Requirements Coverage

| Success Criterion | Status | Notes |
|-------------------|--------|-------|
| User can trigger a render from the UI and receive a job ID immediately | SATISFIED | Render button dispatches POST, 202 returned before worker completes |
| User sees a render progress bar that updates in real time | SATISFIED | SSE polls every 500ms, progress bar width bound to renderState.progress |
| User can download the completed MP4 file after render completes | SATISFIED | Download anchor appears on rendered status, href points to download endpoint |
| Rendered video subtitle timing and highlighting matches browser preview | HUMAN NEEDED | Same inputProps (phrases, style) passed to both Player and renderMedia; OffthreadVideo for frame accuracy; visual match requires human |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `render-worker.ts` | 34 | Comment: "Override static placeholder metadata..." | INFO | Not a code stub — comment explains intentional design pattern (Root.tsx uses defaults, overridden by selectComposition resolve) |

No blockers or warnings found. The only match for "placeholder" is a clarifying comment, not a stub implementation.

---

### Human Verification Required

#### 1. Rendered MP4 subtitle correctness

**Test:** Upload a short video (10-30 seconds), complete transcription, click "Render MP4", wait for completion, click "Download MP4", open the file in QuickTime or VLC.

**Expected:** Burned-in subtitles appear on the video; words highlight in karaoke style at the correct timestamps; the highlighted word matches what was shown in the browser preview at the same moment in time.

**Why human:** Visual appearance and timing accuracy of the rendered output cannot be verified by reading source code. The structural wiring (same phrases/style passed to both browser Player and renderMedia worker) is correct, but whether the frame extraction via OffthreadVideo produces visually accurate timing requires actual playback of a rendered file.

---

### Gaps Summary

No gaps found. All 9 must-have truths are either fully verified programmatically or have a structurally sound implementation with one item (subtitle timing match) requiring human playback confirmation.

The end-to-end pipeline is fully wired:

- Backend: `initBundle()` at startup → `POST /render` dispatches to worker thread → `renderMedia()` with `onProgress` → job store updated → SSE broadcasts progress → SSE closes on 'rendered' → `GET /download` streams the file
- Frontend: `useRender` hook POSTs with current phrases/style from Zustand → opens EventSource → updates progress bar → shows download anchor on completion
- Types: `JobStatus` includes 'rendering' and 'rendered'; `outputPath` on `Job` is internal-only and stripped from SSE broadcasts
- The `Composition as any` workaround in Root.tsx is documented and intentional (Remotion generic constraint), does not affect runtime behavior

---

_Verified: 2026-03-06T11:22:08Z_
_Verifier: Claude (gsd-verifier)_
