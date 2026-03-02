# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Users can upload a video and get back a rendered video with accurate, dynamically-highlighted subtitles — with full control over transcript editing, word grouping, and visual styling.
**Current focus:** Phase 4 — Transcript Editor and Grouping

## Current Position

Phase: 3 of 6 (Composition and Preview) — COMPLETE
Plan: 2 of 2 — Phase 3 complete
Status: Phase 3 fully verified — ready to begin Phase 4
Last activity: 2026-03-03 — 03-02 complete (PreviewPanel, Zustand store, video route, viewport-fit sizing, conversation phrase grouping)

Progress: [██████████] 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 10
- Average duration: 14 min
- Total execution time: 132 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4 | 52 min | 13 min |
| 02-transcription | 4 | 69 min | 17 min |
| 03-composition-and-preview | 2 | 11 min | 6 min |

**Recent Trend:**
- Last 5 plans: 8 min, 3 min, 60 min, 3 min, 2 min
- Trend: Phase 3 fast — composition + preview wiring with checkpoint fixes

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
- [02-01]: WhisperModel('turbo', device='cpu', compute_type='int8') confirmed working on Apple Silicon — 'turbo' maps to Systran/faster-whisper-large-v3-turbo; no fallback needed
- [02-01]: Python subprocess per job (not persistent daemon) — simpler, no IPC; revisit if model load time is a UX problem
- [02-01]: VAD min_silence_duration_ms=500 chosen over 2000ms default — less aggressive silence suppression
- [02-01]: Pass normalized.mp4 path directly to Python — PyAV handles audio extraction from mp4 internally
- [02-02]: runTranscription returns { promise, process } — exposes ChildProcess handle for zombie subprocess cleanup on client disconnect
- [02-02]: transcriptPath is internal-only in Job type — route layer in 02-03 must strip before SSE broadcast to avoid exposing server filesystem paths
- [Phase 02-transcription]: SSE 'ready' state no longer terminal — stream stays open through transcribing -> transcribed for frontend to monitor full lifecycle
- [Phase 02-transcription]: transcriptionProcesses Map is module-level in transcribe.ts — ChildProcess not JSON-serializable, kept separate from job store
- [Phase 02-transcription]: jobs.ts imports killTranscription from transcribe.ts (not vice versa) — one-directional import avoids circular dependency
- [02-04]: Language forced to 'en' by default in Whisper — auto-detect misidentified English as Malay causing hallucinated output; CLI override retained
- [02-04]: Model switched from large-v3-turbo to large-v3 with int8_float32 — turbo accuracy insufficient at e2e verification; mlx-whisper tried and reverted (hallucinated output on MP4)
- [02-04]: CSS tooltips (data-tooltip + ::after) preferred over native title attribute — native has ~1s delay; CSS tooltips appear instantly on hover
- [02-04]: useTranscribe is a separate hook from useUpload — each lifecycle phase owns its own focused state machine
- [03-01]: remotion@4.0.379 pinned with exact (no ^) in both remotion-composition and frontend — all remotion packages must match exactly
- [03-01]: No react in remotion-composition/package.json dependencies — peer dep only, avoids duplicate React in monorepo
- [03-01]: allowImportingTsExtensions + noEmit in frontend and backend tsconfigs — both runtimes (Vite, Node --experimental-strip-types) handle TS natively; tsc used for type-check only
- [03-01]: Binary search word activation holds highlight during intra-phrase gaps (no -1 return) — prevents karaoke flicker UX
- [03-01]: PHRASE_GAP_SEC = 1.5s for phrase splitting and active phrase display window extension
- [03-02]: Video (not OffthreadVideo) for browser Player — OffthreadVideo is server-render only
- [03-02]: Phrase grouping: 0.3s gap + punctuation splits + 8 word max — conversational audio has sub-second gaps
- [03-02]: Viewport-fit Player: 65vh height constraint derived via aspect ratio, responsive to resize
- [03-02]: useEffect bridges transcribe completion to Zustand setJob — runs when status transitions to 'transcribed'

### Pending Todos

- [Phase 4]: SRT import + word alignment — Import SRT from DaVinci Resolve, align with Whisper word timestamps using rough timestamp matching. SRT provides accurate text, Whisper provides per-word timing. Merge to get accurate text with word-level timestamps.

### Blockers/Concerns

- [Phase 2 — RESOLVED]: Transcription accuracy verified end-to-end with large-v3 int8_float32; language detection fixed by forcing 'en'; word timestamp quality approved by user
- [Phase 2 — ongoing]: Transcription speed with large-v3 is slower than turbo; if UX becomes a problem in Phase 3+, consider VAD pre-filtering or chunking
- [Phase 3 — RESOLVED]: React 18.3.x confirmed compatible with Remotion 4.0.379; Player API verified working
- [Phase 3 — RESOLVED]: Backend needs restart after code changes (no file watcher); user must Ctrl+C and re-run `just dev`
- [Phase 5]: Verify `renderMedia()` API signature and `onProgress` callback shape against current remotion.dev/docs before Phase 5
- [Phase 6]: Verify Tailwind 4 + shadcn/ui compatibility; fall back to Tailwind 3 if incompatible

## Session Continuity

Last session: 2026-03-03
Stopped at: Phase 3 complete — Composition and Preview fully verified; ready to begin Phase 4 (Transcript Editor and Grouping)
Resume file: None
