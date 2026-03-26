---
phase: 01-foundation
verified: 2026-02-27T18:55:25Z
status: gaps_found
score: 4/5 must-haves verified
re_verification: false
gaps:
  - truth: "After upload completes, user sees video thumbnail, duration, resolution, and a 'Transcribe' button"
    status: partial
    reason: >
      The ready-state UI correctly renders thumbnail, duration, resolution, fps, and the Transcribe
      button. However, while in the 'normalizing' state the progress bar immediately jumps to and
      stays at 100% instead of incrementing. This is caused by a unit error on line 60 of
      packages/backend/src/services/ffmpeg.ts: FFmpeg's out_time_ms value is in microseconds, but
      the formula divides by 1000 and then multiplies by 1000 again, yielding values ~1000x too
      large (clamped immediately to 100 by Math.min). The user sees "Normalizing video... 100%"
      the entire time normalization is running. The normalization itself completes correctly.
    artifacts:
      - path: "packages/backend/src/services/ffmpeg.ts"
        issue: >
          Line 60: const percent = Math.min(100, Math.round((outTimeMs / 1000 / durationMs) * 100 * 1000))
          out_time_ms is microseconds; durationMs is milliseconds. The /1000 and *1000 cancel to
          (outTimeMs_µs / durationMs_ms) * 100 = correct percent * 1000. Fix:
          const percent = Math.min(100, Math.round((outTimeMs / durationMs) * 100 / 1000))
    missing:
      - "Fix progress formula on line 60 of packages/backend/src/services/ffmpeg.ts"
human_verification:
  - test: "Upload flow end-to-end with a real video file"
    expected: >
      Drop zone renders with 'Drop a video or click to upload'. After selecting a file: uploading
      progress increments from 0–100%. After file transfer completes: 'Normalizing video...' progress
      increments from 0–100% (not stuck at 100%). After normalization: thumbnail displays, duration
      in mm:ss format, resolution as WxH, fps, and a disabled Transcribe button are all visible.
      'Upload another video' link resets to idle state.
    why_human: >
      Visual render, progress bar animation, and real FFmpeg processing cannot be verified
      programmatically. The progress defect in the gaps section IS verifiable (confirmed by
      arithmetic) but correct behavior after the fix needs runtime confirmation.
  - test: "LAN access from a second device"
    expected: >
      App loads at http://{mac-mini-ip}:5173 from a different machine on the same network.
      Full upload flow works from that device.
    why_human: Network topology cannot be verified statically.
---

# Phase 01: Foundation Verification Report

**Phase Goal:** Users can access the tool suite in a browser and upload a video that is normalized and ready for transcription
**Verified:** 2026-02-27T18:55:25Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can drag-and-drop or click to open a file picker | VERIFIED | UploadZone.tsx uses `useDropzone` with `accept: { 'video/*': [] }`, `multiple: false`; renders full-zone clickable div with input |
| 2 | Progress shows Uploading % then Normalizing % then Ready | PARTIAL | Uploading % works via XHR `upload.onprogress`. Normalizing % is always 100% due to unit error in ffmpeg.ts line 60 (see gap). Ready state displays correctly. |
| 3 | After completion: thumbnail, duration, resolution, fps, Transcribe button visible | VERIFIED | SubtitlesPage.tsx ready branch renders `<img src="/api/jobs/{jobId}/thumbnail">`, `formatDuration(meta.duration)`, `meta.width x meta.height`, `meta.fps fps`, disabled Transcribe button |
| 4 | Original preserved; normalized.mp4 is a separate file | VERIFIED | upload.ts streams original to `original{ext}`, normalizes to `normalized.mp4` separately; original is never overwritten |
| 5 | Video metadata (duration, fps, resolution) extracted and stored in job record | VERIFIED | probeVideo() returns all 5 fields (duration, fps, width, height, codec); stored via `updateJob(..., { metadata })` on job completion; accessible to downstream steps via `fastify.jobs.get(jobId).metadata` |
| 6 | Upload and normalization work for any file size without memory issues | VERIFIED | upload.ts uses `pipeline(data.file, createWriteStream(...))` — never buffers; Fastify bodyLimit set to 10GB |

**Score:** 4/5 truths fully verified (Truth 2 is partial due to the normalization progress defect)

---

### Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `packages/backend/src/routes/upload.ts` | 30 | 94 | VERIFIED | Full streaming upload, fire-and-forget normalization pipeline, 202 response |
| `packages/backend/src/routes/jobs.ts` | 25 | 73 | VERIFIED | SSE endpoint polls job store every 500ms; thumbnail endpoint serves JPEG |
| `packages/frontend/src/components/UploadZone.tsx` | 20 | 54 | VERIFIED | `useDropzone`, video/* accept, drag-active styling, disabled state |
| `packages/frontend/src/hooks/useUpload.ts` | 30 | 143 | VERIFIED | XHR upload with progress, SSE EventSource subscription, full state machine |
| `packages/frontend/src/pages/SubtitlesPage.tsx` | 40 | 111 | VERIFIED | All 4 states rendered: idle, uploading/normalizing, ready, failed |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `useUpload.ts` | `routes/upload.ts` | `xhr.open('POST', '/api/upload')` | WIRED | Line 130: `xhr.open('POST', '/api/upload')` with FormData |
| `useUpload.ts` | `routes/jobs.ts` | `new EventSource('/api/jobs/${jobId}/status')` | WIRED | Line 70: `new EventSource(\`/api/jobs/${jobId}/status\`)` |
| `routes/upload.ts` | `services/ffmpeg.ts` | `normalizeVideo` + `probeVideo` calls | WIRED | Lines 55, 62, 71: `probeVideo(originalPath)`, `normalizeVideo(...)`, `probeVideo(normalizedPath)` |
| `routes/upload.ts` | `services/thumbnail.ts` | `extractThumbnail` after normalization | WIRED | Line 75: `extractThumbnail(normalizedPath, thumbnailPath)` |
| `UploadZone.tsx` | `react-dropzone` | `useDropzone` hook | WIRED | Line 1: `import { useDropzone } from 'react-dropzone'`; line 10: `useDropzone({...})` |
| `SubtitlesPage.tsx` | `useUpload.ts` | `useUpload()` hook | WIRED | Line 1: `import { useUpload }...`; line 12: `const { state, upload, reset } = useUpload()` |

All 6 key links are fully wired with both call site and response/result usage confirmed.

---

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| PLAT-01: Header with Subtitles tab, no page reload on navigation | SATISFIED | TabNav renders `<button>` elements; App.tsx uses `useState('subtitles')` — no router, no page reload |
| PLAT-02: Backend on 0.0.0.0:3001, frontend on 0.0.0.0:5173, LAN accessible | SATISFIED | `fastify.listen({ port: 3001, host: '0.0.0.0' })`; vite.config.ts `host: true` (0.0.0.0) |
| INGST-01: Drag-and-drop + click upload zone, streaming multipart upload | SATISFIED | react-dropzone with `accept: { 'video/*': [] }`; pipeline() streaming in upload.ts |
| INGST-02: FFmpeg normalization (libx264, 30fps CFR, AAC), original preserved | SATISFIED | ffmpeg.ts args: `-c:v libx264 -r 30 -c:a aac`; original file untouched |
| INGST-03: FFprobe extracts duration, fps, width, height, codec | SATISFIED | probeVideo() parses all 5 fields from ffprobe JSON output and stores in job.metadata |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/backend/src/services/ffmpeg.ts` | 60 | Progress percent formula yields values ~1000x too large | Warning | `Math.min(100, ...)` clamps to 100 immediately; normalization progress bar shows 100% throughout instead of incrementing. Normalization still completes correctly. |

No TODO/FIXME/placeholder comments found in any source file. No empty implementations. The Transcribe button is intentionally `disabled` as a Phase 2 placeholder — this is correct per plan specification.

---

### Human Verification Required

#### 1. Upload flow end-to-end with a real video

**Test:** Start backend (`node --experimental-strip-types packages/backend/src/index.ts`) and frontend (`cd packages/frontend && npx vite --host`). Open http://localhost:5173. Drag a video file onto the drop zone or click to select one.

**Expected:** Uploading progress increments 0–100%. After transfer: Normalizing progress increments 0–100% (this will show 100% immediately until the gap is fixed). After normalization: thumbnail image loads, duration shows as mm:ss, resolution as WxH, fps as a number, Transcribe button is visible but disabled, "Upload another video" link resets to idle.

**Why human:** Visual rendering, actual FFmpeg execution, and SSE streaming behavior require a running process.

#### 2. LAN access from a second device

**Test:** Find the machine's local IP (`ipconfig getifaddr en0`). Open `http://{ip}:5173` from a phone or another computer on the same Wi-Fi.

**Expected:** App loads and the full upload flow works from the second device.

**Why human:** Network topology and firewall rules cannot be verified statically.

---

### Gaps Summary

One gap blocks full truth verification:

**Normalization progress is always reported as 100%.** The formula on line 60 of `packages/backend/src/services/ffmpeg.ts` has a unit mismatch. FFmpeg's `-progress pipe:1` emits `out_time_ms` in **microseconds**, but the formula treats `durationMs` as milliseconds. The arithmetic:

```
(outTimeMs_µs / 1000 / durationMs_ms) * 100 * 1000
= (outTimeMs_µs / durationMs_ms) * 100        — the /1000 and *1000 cancel
= correct_percent * 1000                       — result is 1000x too large
```

`Math.min(100, ...)` clamps every progress event to 100 from the first tick. The fix is:

```typescript
// Line 60 — fix unit mismatch (out_time_ms is µs, durationMs is ms)
const percent = Math.min(100, Math.round((outTimeMs / durationMs) * 100 / 1000))
```

This is a display-only defect. Normalization itself runs to completion correctly; the `normalizeVideo` promise resolves only when FFmpeg exits 0, and the final `onProgress(100)` call at line 73 still fires. The `status: 'ready'` transition, metadata extraction, and thumbnail extraction all work. The gap is that users cannot see real normalization progress — they see 100% the entire time the encode is running.

All other phase success criteria are fully met. The codebase is production-quality with no stubs, no orphaned artifacts, no placeholder implementations, and proper error handling in every path.

---

_Verified: 2026-02-27T18:55:25Z_
_Verifier: Claude (gsd-verifier)_
