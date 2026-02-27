# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Users can upload a video and get back a rendered video with accurate, dynamically-highlighted subtitles — with full control over transcript editing, word grouping, and visual styling.
**Current focus:** Phase 2 — Transcription

## Current Position

Phase: 1 of 6 (Foundation) — COMPLETE
Plan: 4 of 4 completed
Status: Phase 1 complete — ready for Phase 2
Last activity: 2026-02-28 — Completed 01-04 (upload pipeline end-to-end: multipart POST, FFmpeg normalization, SSE progress, UploadZone, SubtitlesPage)

Progress: [███░░░░░░░] 17%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 13.5 min
- Total execution time: 52 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4 | 52 min | 13 min |

**Recent Trend:**
- Last 5 plans: 3 min, 2 min, 2 min, 45 min
- Trend: Variable (01-04 included end-to-end testing + bug fixing)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-build]: M4 Mac Mini only — no Windows/CUDA path needed; simplifies transcription setup to Apple Silicon (CoreML/CPU) only
- [Pre-build]: faster-whisper chosen over whisper.cpp (inferior word timestamps) and openai/whisper (slow); validate `large-v3-turbo` at implementation time
- [Pre-build]: Remotion composition must be a pure props-driven function — no `Date.now()`, no API calls inside; all timing via `useCurrentFrame() / fps`
- [Pre-build]: VFR-to-CFR normalization must happen on upload in Phase 1; retrofitting is expensive
- [01-01]: npm workspaces use `"*"` (not `"workspace:*"`) for intra-workspace deps — workspace: is pnpm/yarn only
- [01-01]: Frontend tsconfig uses module:ESNext + moduleResolution:bundler (required by Vite); backend uses NodeNext
- [01-01]: TypeScript composite + project references for incremental cross-package builds
- [01-01]: Node 22 LTS pinned in .nvmrc
- [01-02]: fastify-plugin (fp()) required to break Fastify encapsulation so fastify.jobs decorator is visible across route plugins
- [01-02]: normalizeVideo accepts optional durationMs for progress % calculation via FFmpeg -progress pipe:1 out_time_ms output
- [01-02]: FFmpeg installed via brew install ffmpeg — absolute paths /opt/homebrew/bin/ffmpeg used to avoid PATH issues
- [01-03]: Dark mode is the only mode — dark styles applied directly to :root/body, no class-based toggle
- [01-03]: Co-located .css files per component (not CSS modules, not styled-components) — keeps tooling minimal
- [01-03]: Single Subtitles tab only — no placeholder/coming-soon slots per user decision
- [01-03]: global.css @imports tokens.css to enforce token-first load order independent of JS import sequence
- [01-04]: @fastify/multipart fileSize: 0 means 0-byte limit (not unlimited) — must use explicit byte count (10GB)
- [01-04]: Fastify default bodyLimit is 1MB — must set bodyLimit: 10GB in constructor for video upload tool
- [01-04]: Vite proxy target must use 127.0.0.1 (not localhost) — Node.js resolves localhost to IPv6 ::1 on macOS; Fastify binds IPv4 only
- [01-04]: Manual SSE on reply.raw used instead of @fastify/sse plugin — more reliable, API uncertainty confirmed at runtime
- [01-04]: XHR used for upload phase (not fetch) — only XHR exposes xhr.upload.onprogress for real per-byte upload progress

### Pending Todos

None.

### Blockers/Concerns

- [Phase 2]: Verify `large-v3-turbo` availability in faster-whisper at implementation time; fall back to `large-v3` if missing
- [Phase 2]: Run real benchmark with test video to confirm word timestamp accuracy is acceptable; evaluate WhisperX if drift is unacceptable
- [Phase 3]: Verify React 19 / Remotion 4.x compatibility before pinning versions; may need to pin React 18.x
- [Phase 3]: Verify `<Player>` props API and `@remotion/google-fonts` API against current remotion.dev/docs before Phase 3
- [Phase 5]: Verify `renderMedia()` API signature and `onProgress` callback shape against current remotion.dev/docs before Phase 5
- [Phase 6]: Verify Tailwind 4 + shadcn/ui compatibility; fall back to Tailwind 3 if incompatible

## Session Continuity

Last session: 2026-02-28
Stopped at: Completed 01-04-PLAN.md — upload pipeline end-to-end, Phase 1 complete
Resume file: None
