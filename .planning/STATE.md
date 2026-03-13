# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Users can upload a video and get back a rendered video with accurate, dynamically-highlighted subtitles — with full control over transcript editing, word grouping, and visual styling.
**Current focus:** Phase 7 — Text Animation Creator

## Current Position

Phase: 7 of 7 (Text Animation Creator — COMPLETE)
Plan: 5 of 5 — all complete, human verification passed
Status: Phase 7 complete. All original milestone phases done. Considering new phase for animation motion/positioning.
Last activity: 2026-03-13 — 07-05 verification passed, stable slot allocation committed (a8c5aae)

Progress: [████████████████████] 100% (7 of 7 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: 12 min
- Total execution time: ~158 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4 | 52 min | 13 min |
| 02-transcription | 4 | 69 min | 17 min |
| 03-composition-and-preview | 2 | 11 min | 6 min |
| 04-transcript-editor-and-grouping | 2 | ~1 day | — |
| 04.1-multi-speaker-diarization | 2 | ~2 days | — |
| 05-server-render-and-output | 2/3 | ~18 min | — |
| 06-styling | 5/5 | ~39 min | — |
| 07-text-animation-creator | 4/5 | 20 min | 5 min |

**Recent Trend:**
- Phase 06-03 complete (~25 min) — 4-stage nav shell: StageTabBar, SpeakersStage, collapsible PreviewPanel, SubtitlesPage restructured to stage-conditional rendering
- Phase 07-01 complete (6 min) — AnimationPreset type hierarchy, CompositionPhrase serialization boundary type, animations.ts computation engine, SubtitleOverlay animation integration
- Phase 07-03 complete (3 min) — useAnimationPresets hook, PreviewPanel serialization boundary preset resolution, PhraseStylePanel animation preset picker, undo/redo support for animation state
- Phase 07-04 complete (4 min) — AnimationEditor UI: PresetList + AnimationPreview + PhaseTimeline + PhasePanel + useDebounced, all TypeScript-verified

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
- [06-01]: @remotion/google-fonts subpath imports used (e.g. @remotion/google-fonts/Inter) — matches ./* export pattern in package.json
- [06-01]: loadFont() called at module level in fonts.ts — Remotion handles delayRender/continueRender internally; no async handling needed in component code
- [06-01]: SpeakerStyleOverride = Partial<StyleProps> & { animationType?: AnimationType } — allows selective override of any style field per speaker
- [06-01]: dist folders must be rebuilt before dependent packages type-check against new types — inherent limitation of workspace setup
- [06-02]: Individual Zustand selectors per style field (not whole style object) — minimizes re-renders during rapid color picker drag
- [06-02]: Toggle-to-override pattern in SpeakerStylePanel — checkbox checked initializes with default, unchecked removes field from SpeakerStyleOverride entirely
- [06-02]: Animation type selector unconditional per speaker; other override fields use opt-in checkboxes — animation is primary per-speaker customization
- [06-03]: StageId type exported from StageTabBar.tsx — SubtitlesPage imports component + type from one location
- [06-03]: diarizeState/diarize/numSpeakers/setNumSpeakers passed as explicit props to SpeakersStage — useDiarize is hook-scoped state, not in Zustand
- [06-03]: Preview collapse button opacity:0 by default, shown on .preview-panel:hover — keeps video UI uncluttered
- [06-03]: Text stage keeps TranscriptEditor as fallback — placeholder alone would break editing until Plan 04
- [Phase 06-styling]: useUndoStore is a separate Zustand store (not middleware on subtitleStore) — avoids circular dependency; subtitleStore calls useUndoStore.getState().pushSnapshot() before each mutation
- [Phase 06-04]: StateSnapshot.manualSplitWordIndices stored as number[] (not Set) — structuredClone cannot clone Set; re-hydrated to Set<number> in restoreSnapshot
- [Phase 06-04]: updatePhraseText: same word count -> text-only update preserving original timestamps; different word count -> redistribute timestamps evenly across phrase time window
- [06-05]: FFmpeg waveform: mono 8kHz f32le PCM piped to stdout, downsampled to 2000 peaks via max amplitude bucketing; module-level Map cache by jobId prevents re-extraction
- [06-05]: Per-phrase lingerDuration: SessionPhrase.lingerDuration -> TranscriptPhrase.lingerDuration -> PreviewPanel inputProps -> SubtitleOverlay (phrase.lingerDuration ?? style.lingerDuration ?? 1.0)
- [06-05]: Greedy lane assignment for timeline: tracks laneEndTimes[], assigns to lowest available lane, capped at 3 lanes max to prevent excessive height
- [06-05]: setPhraseLinger uses pushUndo before mutation — consistent with all other mutating store actions; updates phrase in-place without rebuilding phrase array
- [post-06]: 3-stage flow (Timing → Text → Styling) replaces 4-stage — Speakers stage redundant after speaker management moved into TimingEditor lane headers
- [post-06]: Auto-diarize after transcription with hasAutoDiarizedRef guard — speaker detection is always useful, no reason to require manual trigger
- [post-06]: Speaker lanes replace greedy overlap lanes — buildSpeakerLanes() groups phrases by dominantSpeaker; each speaker gets a dedicated row with editable name and delete button
- [post-06]: Waveform in its own row above speaker lanes (48px) — clearer audio overview than embedding in first lane at reduced opacity
- [post-06]: Click empty lane space → addPhraseAtTime — crosshair cursor signals affordance; new phrase gets 0.5s duration capped to next word boundary
- [post-06]: deletePhrase removes all words in phrase from flat array — won't delete if it would leave zero words; adjusts manual split indices
- [post-06]: Phrase block × delete button: opacity:0 → visible on hover; positioned top-right absolute within phrase block
- [07-01]: SpeakerStyleOverride is now Partial<StyleProps> only — animationType removed; per-speaker animation handled via AnimationPreset at system level, not a legacy enum
- [07-01]: CompositionPhrase extends TranscriptPhrase with resolved animationPreset: AnimationPreset — frontend resolves IDs at serialization boundary (Remotion composition cannot access hooks/stores/APIs)
- [07-01]: animations.ts uses --textSliceProgress as a special CSS property marker for typewriter/letter-by-letter — cleaner than mixing text logic into pure computation helpers
- [07-01]: Word-scope stagger applies to enter phase only; exit has no stagger (all words exit together)
- [07-01]: mergeStyles helper safely concatenates CSS transform strings so multiple transforms don't clobber each other
- [07-02]: better-sqlite3 requires Node 20+ — must use nvm to ensure Node 22 when installing; project .nvmrc already pins v22
- [07-02]: animationPresetsPlugin registers before presetsRoutes — decorates fastify.db which routes depend on
- [07-02]: Seeding uses staggered timestamps (now - N*1000ms) so ORDER BY created_at ASC keeps built-ins before user presets
- [07-02]: PUT /api/presets/:id merges provided fields into existing params JSON — partial updates without full replacement
- [07-03]: useAnimationPresets uses refreshTick counter pattern — increment triggers useEffect re-fetch; all CRUD mutations call refresh() after success
- [07-03]: Select value of empty string represents "use global default" — maps cleanly to val || null in onChange handler for setPhraseAnimationPresetId
- [07-03]: SubtitleComposition already forwarded animationPreset to SubtitleOverlay in 07-01 — no changes needed in 07-03
- [07-04]: Remotion Player generic constraint: PreviewComposition must be cast via `unknown as React.ComponentType<Record<string,unknown>>` — same pattern as Root.tsx Composition cast
- [07-04]: AnimationEditor editing state (selectedPresetId) is separate from global active state (activeAnimationPresetId) — editing ≠ applying
- [07-04]: PhaseTimeline exit drag inverts delta — dragging right shrinks exit duration (handle is left boundary of exit block, so handle moving right = exit block left-edge moving right = exit shrinks)

### Roadmap Evolution

- Phase 04.1 inserted after Phase 4: Multi-Speaker Diarization and Speaker Lanes (URGENT) — auto-detect speakers via pyannote.audio, propagate speaker labels through types/grouping/store/composition, add speaker lanes to editor UI with manual override

### Pending Todos

- [Phase 7 — DONE]: Overlapping subtitle positioning — stable slot allocation implemented with same-speaker replacement
- [Phase 7 — DONE]: Human verification checkpoint for 07-05 Task 2 — all 10 UAT areas passed
- [Future UX]: Configurable subtitle lane gap — control the vertical spacing between overlapping subtitle rows (currently hardcoded OVERLAP_OFFSET_PCT = 8). Add to Global Styling panel with a visual preview showing lane positions on the video.
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

Last session: 2026-03-13
Stopped at: Phase 7 fully complete. All 7 milestone phases done. User wants to:
  1. Add new phase for animation motion/positioning on video
  2. Redefine app focus to subtitle-specific (not general video tools suite)

Next planned work:
  - Discuss new phase scope (animation motion paths/positioning)
  - Update PROJECT.md to reflect subtitle-focused app identity
  - Potentially start new milestone
