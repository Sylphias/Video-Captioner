# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Users can upload a video and get back a rendered video with accurate, dynamically-highlighted subtitles — with full control over transcript editing, word grouping, and visual styling.
**Current focus:** Phase 6 — Styling

## Current Position

Phase: 6 of 6 (Styling)
Plan: 0 of 3 — not yet planned
Status: Ready to plan Phase 6
Last activity: 2026-03-06 — Phase 5 complete (verified, human-approved)

Progress: [██████████████████] 87%

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 14 min
- Total execution time: ~142 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4 | 52 min | 13 min |
| 02-transcription | 4 | 69 min | 17 min |
| 03-composition-and-preview | 2 | 11 min | 6 min |
| 04-transcript-editor-and-grouping | 2 | ~1 day | — |
| 04.1-multi-speaker-diarization | 2 | ~2 days | — |
| 05-server-render-and-output | 2/3 | ~18 min | — |

**Recent Trend:**
- Phase 05-01 complete — Remotion SSR pipeline implemented cleanly; bundle() verified working with 1.2s startup; TypeScript type workaround needed for Composition generic constraint
- Phase 05-02 complete (8 min) — useRender hook + render UI implemented and verified; user confirmed burned-in subtitles in downloaded MP4

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
- [04-01]: SessionWord/SessionPhrase defined in grouping.ts (not store) to avoid circular import
- [04-01]: manualSplitWordIndices: Set<number> of global word indices — survives phrase rebuilds triggered by timestamp edits
- [04-01]: Text-only updateWord skips phrase rebuild — updates word in-place to prevent clobbering manual splits
- [04-01]: phrases[] in composition replaces words[] — composition is now a pure renderer of pre-computed phrases
- [04-02]: seekToTime stored as ((timeSec) => void) | null in useState — wrapped in arrow on set to prevent React calling it as initializer
- [04-02]: WordCell click seeks to word.start (not midpoint) — clicking signals intent to play from word's beginning
- [04-02]: addWord/deleteWord/addPhrase added to store beyond plan spec — transcript editor without CRUD is not functionally usable
- [04-02]: go-to-subtitle uses data-word-index DOM attribute for scroll target — avoids React ref arrays, consistent with existing pattern
- [04-02]: Split button opacity:0 by default, revealed on .phrase-row:hover — avoids visual clutter on dense transcripts
- [04.1-01]: Diarization is opt-in via separate POST endpoint — transcription does not auto-trigger it
- [04.1-01]: NEVER use MPS device for pyannote — known accuracy regression on Apple Silicon; always CPU
- [04.1-01]: Diarization lifecycle returns to 'transcribed' on success — enriches transcript in place, no new terminal state needed
- [04.1-01]: pyannote-audio 4.0.4 (not 3.3.2) — 3.3.2 use_auth_token incompatible with current huggingface_hub; torch 2.8.0 pinned
- [04.1-01]: Audio pre-loaded as WAV via ffmpeg→torchaudio — torchcodec broken with brew ffmpeg on macOS
- [04.1-01]: DiarizeOutput.speaker_diarization.itertracks() — pyannote 4.x changed pipeline return type
- [04.1-01]: numSpeakers optional param on POST body and CLI — constrains pyannote speaker count
- [04.1-01]: Three HuggingFace model licenses required: speaker-diarization-3.1, segmentation-3.0, speaker-diarization-community-1
- [04.1-01]: set dotenv-load in justfile — auto-loads .env for HUGGINGFACE_TOKEN
- [04.1-01]: HUGGINGFACE_TOKEN read from process.env at pipeline execution time — fails gracefully with descriptive error if missing
- [04.1-02]: Speaker color index: parseInt(SPEAKER_XX.replace('SPEAKER_', ''), 10) % 8 — works for arbitrary speaker IDs, wraps at 8 colors
- [04.1-02]: Phrase reassign assigns ALL words in phrase to new speaker — simpler UX, whole-phrase assignment semantics
- [04.1-02]: useDiarize reloads store via useSubtitleStore.getState().setJob() inside the hook on 'transcribed' SSE event
- [04.1-02]: reassignWordSpeaker updates phrase in-place (no full rebuild) to preserve manual splits (research Pitfall #4)
- [04.1-02]: Resizable preview/editor split via drag handle — 20%-75% range, PreviewPanel uses ResizeObserver for responsive sizing
- [04.1-02]: Pre-transcribe video preview removed — not useful since speaker assessment happens after transcription
- [04.1-02]: addWord preserves phrase boundary via manual split at globalIdx+1 — prevents auto-grouper from merging new word into next phrase
- [04.1-02]: Timestamp drag clamped: start < end - 0.01, end > start + 0.01 — prevents invalid intermediate values during drag
- [04.1-02]: Insert-phrase buttons between rows (opacity:0 on hover reveal) — supplements bottom-only "Add phrase" button
- [05-01]: remotion-entry.ts named separately from index.ts as bundle() entry point — avoids collision with frontend package exports
- [05-01]: OffthreadVideo during server render, Video during browser Player — useRemotionEnvironment().isRendering conditional
- [05-01]: Composition as any cast in Root.tsx — Remotion Composition generic requires Record<string,unknown> which SubtitleCompositionProps doesn't satisfy (no index signature)
- [05-01]: videoSrc must be HTTP URL in render inputProps — headless Chrome cannot access filesystem paths
- [05-01]: durationInFrames = Math.floor(duration * fps) — must be integer, not float
- [05-02]: useRender reads store via useSubtitleStore.getState() inside render() callback — accesses current store at trigger time without stale closure
- [05-02]: Download MP4 uses <a href download> anchor — browser handles Content-Disposition natively without JS file handling

### Roadmap Evolution

- Phase 04.1 inserted after Phase 4: Multi-Speaker Diarization and Speaker Lanes (URGENT) — auto-detect speakers via pyannote.audio, propagate speaker labels through types/grouping/store/composition, add speaker lanes to editor UI with manual override

### Pending Todos

- [Phase 4 — deferred UX]: Drag-to-adjust timestamps on WordCell — more ergonomic than typing timestamp values
- [Phase 4 — deferred UX]: Split button hit area too small when words are close — wider hit area or alternative interaction
- [Phase 5+]: SRT import + word alignment — Import SRT from DaVinci Resolve, align with Whisper word timestamps using rough timestamp matching. SRT provides accurate text, Whisper provides per-word timing. Merge to get accurate text with word-level timestamps.

### Blockers/Concerns

- [Phase 2 — RESOLVED]: Transcription accuracy verified end-to-end with large-v3 int8_float32; language detection fixed by forcing 'en'; word timestamp quality approved by user
- [Phase 2 — ongoing]: Transcription speed with large-v3 is slower than turbo; if UX becomes a problem in Phase 3+, consider VAD pre-filtering or chunking
- [Phase 3 — RESOLVED]: React 18.3.x confirmed compatible with Remotion 4.0.379; Player API verified working
- [Phase 3 — RESOLVED]: Backend needs restart after code changes (no file watcher); user must Ctrl+C and re-run `just dev`
- [Phase 5 — RESOLVED]: renderMedia() API and onProgress shape verified in 05-RESEARCH.md and confirmed working in 05-01 implementation
- [Phase 5 — RESOLVED]: End-to-end render pipeline verified by user (05-02) — burned-in subtitles confirmed in downloaded MP4
- [Phase 6]: Verify Tailwind 4 + shadcn/ui compatibility; fall back to Tailwind 3 if incompatible

## Session Continuity

Last session: 2026-03-06
Stopped at: Phase 05-02 complete. Render UI verified end-to-end (burned-in subtitles confirmed). Ready for 05-03.
Resume with: `/gsd:execute-phase 5`
Resume file: None
