# Project Research Summary

**Project:** Eigen Video Editor — Dynamic Subtitle Generator
**Domain:** Local video subtitle generation with word-level karaoke and progressive-reveal
**Researched:** 2026-02-25
**Confidence:** MEDIUM (no live sources available; based on training data through August 2025)

## Executive Summary

Eigen Video Editor is a single-user local video subtitle tool that ingests a video file, transcribes it using self-hosted Whisper, lets the user edit and group the transcript into subtitle phrases, previews word-highlighting animations in the browser, and exports a final MP4 with burned-in subtitles. Experts in this domain build it as a three-tier local stack: a React SPA consuming Remotion's `<Player>` for live preview, a Node.js/Fastify backend for file orchestration and job management, and a Python subprocess running faster-whisper for transcription. The critical architectural insight is that the same Remotion composition drives both in-browser preview and server-side render — subtitle logic lives once, executes in two contexts.

The recommended implementation approach is to build the data pipeline before the UI: normalize video on upload (VFR-to-CFR, any codec to H.264 via FFmpeg), transcribe with faster-whisper using word-level timestamps, feed word data through the Remotion composition with frame-based timing only, and expose transcript editing as a first-class feature rather than an afterthought. The karaoke render mode is the right first renderer because it has simpler animation logic than progressive-reveal; shipping karaoke first validates the full pipeline before adding animation complexity.

The top risks are timestamp drift (Whisper's word timestamps are interpolated, not measured), Remotion's frame-timing constraint (all animation must use `useCurrentFrame()`, never `Date.now()`), and VFR video desync (most phone/screen-recording videos have variable frame rates that break Remotion's CFR assumption). All three risks must be addressed before any UI is built on top of the pipeline. Platform compatibility between Windows/CUDA and macOS/Apple Silicon is a concrete validation requirement before committing to the transcription backend.

## Key Findings

### Recommended Stack

The stack is a Node.js monorepo (npm workspaces) with three app packages — React+Vite frontend, Fastify backend, Remotion composition — plus a shared-types package. Python is a subprocess only, not a web server. Remotion 4.x is user-specified and non-negotiable; React is therefore non-negotiable (Remotion is React-native). All `@remotion/*` packages must be pinned to the exact same version — mismatches cause silent runtime failures.

See full rationale in `.planning/research/STACK.md`.

**Core technologies:**
- **React 19 + TypeScript 5 + Vite 6**: SPA frontend, required by Remotion — verify React 19 compatibility with Remotion 4.x before pinning
- **Remotion 4.x** (`remotion`, `@remotion/player`, `@remotion/renderer`): dual-use composition for browser preview and server-side MP4 render — user-specified, no alternative considered
- **faster-whisper (Python 3.11)**: transcription with word-level timestamps, 4-8x faster than original Whisper — recommended over whisper.cpp (inferior word timestamp quality) and openai/whisper (slow, no native word timestamps)
- **Fastify 5 + Node.js 22 LTS**: backend API server with async-first design and streaming support
- **Zustand 5 + TanStack Query 5**: frontend state (transcript, style config) and async job polling
- **Tailwind 4 + shadcn/ui**: utility styling and pre-built accessible components
- **FFmpeg (system binary, 6.x+)**: video normalization on upload (VFR-to-CFR, codec normalization) and audio extraction for transcription — must be installed on both platforms
- **npm workspaces + concurrently + tsx**: monorepo management without Turborepo overhead

**Critical version note:** Verify React 19 / Remotion 4.x compatibility, `large-v3-turbo` model availability in faster-whisper, and Tailwind 4 / shadcn compatibility before pinning any versions.

### Expected Features

The feature dependency chain is linear: transcription produces word data, word data enables grouping, grouping feeds the renderer, renderer enables preview, preview gates final render. Every other feature is addable after this chain is working.

See full dependency graph in `.planning/research/FEATURES.md`.

**Must have (table stakes for v1):**
- Automatic transcription with word-level timestamps — the core value proposition
- Editable transcript (text corrections; timing read-only in v1) — transcription is never 100% accurate
- Auto word grouping by silence gaps — individual words flashing is too rapid; 3-8 word phrases are the norm
- Karaoke-mode renderer — simpler than progressive-reveal; all words visible, current word highlighted
- Live Remotion browser preview — users must see styling before committing to a slow render
- Basic style config: font size, highlight color, position (top/bottom) — minimum aesthetic control
- Final render to MP4 + download — the deliverable

**Should have (differentiators, v1.5):**
- Progressive-reveal mode — words appear as spoken; popular in educational content; add after karaoke is solid
- Manual word grouping override — complex split/merge UI; auto-grouping covers 80% of cases
- Text stroke / outline customization — legibility on busy backgrounds
- Vertical position slider (percentage, not enum) — covers platform safe zones without hard-coding

**Defer to v2+:**
- SRT/VTT subtitle file export — competing workflow, not the core render path
- Inline timestamp editing — low demand; text correction is the primary pain point
- Waveform scrubber — massive effort for marginal gain in a single-user tool
- Font family selection — single well-chosen web font default suffices for v1
- Batch processing, auth, cloud deployment, mobile UI — all explicitly out of scope

### Architecture Approach

The system is a single-machine, three-tier local stack with no database, no cloud, and no queue broker. The file system is the durable store; in-memory `Map` tracks job state. The key architectural constraint is that the Remotion composition must be a pure function of props — no side effects, no API calls from inside the component — because the same component runs in the browser (Player) and in headless Chromium (server render). Any network call inside the composition breaks server-side rendering.

See full data flow and component detail in `.planning/research/ARCHITECTURE.md`.

**Major components:**
1. **React + Vite SPA**: tabbed shell with upload panel, transcript editor, style panel, preview panel, render panel
2. **Remotion Composition** (`SubtitleComposition.tsx`): props-driven, frame-based; runs identically in browser Player and server renderer — the most architecturally critical component
3. **Fastify Backend (Node.js)**: file upload, job orchestration, video serving, subprocess management, SSE progress streaming
4. **Python Transcription Subprocess** (faster-whisper): invoked by backend as a child process; outputs `transcript.json` with word-level timestamps; no persistent Python server in v1
5. **Remotion Renderer** (invoked in worker thread): headless Chromium render to MP4; must run in a separate Node.js worker to avoid blocking the API event loop
6. **File System** (`uploads/<job-id>/`): source video, transcript.json, render-props.json, output.mp4

**Patterns to follow:**
- Props-driven composition (Pattern 1): all data passed as serializable props; no fetching inside Remotion components
- Serve video via HTTP range requests, not data URLs (Pattern 2)
- Transcript segmentation as frontend state, not backend concern (Pattern 3)
- SSE for render progress streaming (Pattern 4); polling is acceptable fallback

### Critical Pitfalls

See full prevention strategies in `.planning/research/PITFALLS.md`.

1. **Remotion frame-timing violation** — Using `Date.now()`, `setTimeout`, or any real-time API inside a Remotion composition produces correct previews but broken renders. All timing must flow through `useCurrentFrame() / fps`. Address in the very first composition spike; retrofitting requires rewriting the animation layer. (Pitfall 2, HIGH confidence)

2. **VFR video desync** — Most phone and screen-recording videos use Variable Frame Rate. Remotion assumes CFR. Run `ffmpeg -vf fps=30 -vsync cfr` on every upload before Remotion ever sees the file. Pair this with codec normalization to H.264 (Pitfall 3 + 11, HIGH confidence). Do this in the upload pipeline Phase 1 — retrofitting requires re-normalizing all existing uploads.

3. **Render event loop blocking** — `renderMedia()` runs for minutes and blocks Node.js's event loop if called directly in a route handler. Run the renderer in a Node.js worker thread; return a job ID immediately; client polls for status. Design this before the first render endpoint is built. (Pitfall 6, HIGH confidence)

4. **Whisper word timestamp drift** — faster-whisper's word timestamps are interpolated within segments, not directly measured. Drift of 0.2–0.8s on long audio makes highlights feel wrong. Enable VAD (Silero) by default to reduce hallucinations on silence/music. Evaluate WhisperX forced alignment if drift is unacceptable. Treat the transcript editing UI as a first-class feature, not a fallback. (Pitfall 1, 15, MEDIUM confidence — validate with real test videos on both platforms)

5. **Platform compatibility for transcription backend** — faster-whisper uses different code paths on Windows/CUDA vs. macOS/Apple Silicon (CoreML/CPU). Validate BOTH platforms with a real test video before building the API layer around any transcription implementation. (Pitfall 5, MEDIUM confidence)

**Additional pitfalls requiring design decisions before UI work:**
- Transcript state model: separate immutable Whisper output from mutable user edits from day one (Pitfall 10)
- Word lookup in Remotion composition: use binary search, not linear scan, to avoid preview performance collapse on long videos (Pitfall 4)
- Font rendering: use only web fonts via `@remotion/google-fonts`, never system fonts (Pitfall 9)
- Composition duration: probe with FFprobe during upload; pass as `inputProp`; never derive from browser `<video>` element (Pitfall 13)
- File paths: use `path.join()` everywhere from the first line; never string-concatenate paths (Pitfall 14)

## Implications for Roadmap

Architecture research specifies a build order driven by explicit component dependencies. Features research confirms the critical path. Pitfalls research identifies which phases have rewrite-level mistakes if sequenced wrong.

### Phase 1: Foundation and Video Ingestion Pipeline

**Rationale:** No other component can function until jobs have IDs, files have paths, and uploaded videos are normalized to a known format. VFR-to-CFR and codec normalization must happen here — retrofitting requires re-normalizing all existing uploads. Path discipline (Windows cross-platform) must be established from the first line of code.

**Delivers:** Job-id-based folder structure on disk; streaming multipart upload endpoint; FFmpeg normalization pipeline (VFR-to-CFR, H.264, AAC); FFprobe video metadata extraction (duration, fps); backend video serving for browser; in-memory job state.

**Features addressed:** Upload video, download rendered video (downstream dependency)

**Pitfalls avoided:** VFR desync (Pitfall 3), FFmpeg codec failures (Pitfall 11), large file OOM (Pitfall 12), Windows path separators (Pitfall 14), composition duration unknown (Pitfall 13)

**Research flag:** Standard patterns — streaming upload and FFmpeg normalization are well-documented. No phase-specific research needed.

### Phase 2: Transcription Service and Validation Spike

**Rationale:** The transcription backend must be validated on BOTH target platforms (Windows/CUDA and macOS/Apple Silicon) before the API layer is built around it. This is explicitly a validation spike, not production code. Platform incompatibility discovered after the API is built requires more rework than discovering it now.

**Delivers:** Python faster-whisper transcription script producing `transcript.json` with word-level timestamps; VAD (Silero) enabled by default; Fastify endpoint invoking transcription subprocess; validated real-world transcription times on both platforms; decision on WhisperX adoption based on measured timestamp drift.

**Features addressed:** Automatic transcription with word-level timestamps, progress feedback during transcription

**Pitfalls avoided:** Platform compatibility mismatch (Pitfall 5), Whisper timestamp drift (Pitfall 1), Whisper hallucination on silence (Pitfall 15)

**Research flag:** Needs phase-specific research — validate faster-whisper platform support matrix, `large-v3-turbo` model availability, and WhisperX cross-platform status against current docs before implementation. Run real benchmarks on both machines.

### Phase 3: Remotion Composition and Browser Preview

**Rationale:** The Remotion composition is the architectural centerpiece — it runs in two contexts and its frame-timing contract is a rewrite-level pitfall if violated. Build and validate it with fixture data before connecting real transcription output. The binary-search word lookup must be built into the data model before the component is used for long videos.

**Delivers:** `SubtitleComposition.tsx` as a pure props-driven component; frame-based word activation logic (binary search lookup, `useCurrentFrame() / fps`); karaoke rendering mode; `@remotion/player` embedded in frontend with live prop updates; font loaded via `@remotion/google-fonts`; validated that preview matches server render on a test video.

**Features addressed:** Live Remotion browser preview, karaoke mode renderer, subtitle positioning control

**Pitfalls avoided:** Real-time API usage in composition (Pitfall 2), preview performance collapse on long videos (Pitfall 4), font rendering mismatch between preview and render (Pitfall 9)

**Research flag:** Needs phase-specific research — verify current `<Player>` component API and `@remotion/google-fonts` API against remotion.dev/docs before implementation.

### Phase 4: Transcript Editor and Word Grouping

**Rationale:** Editing connects Phase 2 (transcript output) to Phase 3 (composition input). The transcript state model must separate immutable Whisper output from mutable user edits before the editor is built; retrofitting this separation after the UI exists is painful. Auto-grouping by silence gaps must work before manual override UI is attempted.

**Delivers:** Editable word list displaying word, start time, end time, confidence; inline text correction (word text only in v1, timestamps read-only); auto-segmentation by silence gap using multi-factor heuristic (gap threshold, max words, max duration, punctuation); Zustand store with clean separation of immutable Whisper source and mutable session state; segment break display in editor.

**Features addressed:** Editable transcript, auto word grouping by silence gaps, word grouping displayed in preview

**Pitfalls avoided:** Transcript state complexity (Pitfall 10), word grouping logic complexity (Pitfall 7)

**Research flag:** Standard patterns — transcript editing UI and Zustand store patterns are well-documented. The multi-factor grouping heuristic is a product decision, not a research question.

### Phase 5: Server-Side Render and Download

**Rationale:** Server-side render depends on the composition being registered and validated (Phase 3) and the render props being serializable (requires complete transcript + style state from Phase 4). The worker thread isolation pattern is mandatory — rendering in a route handler blocks the event loop.

**Delivers:** Render endpoint that serializes props to `render-props.json` and dispatches to a Node.js worker thread; `renderMedia()` invocation in the worker with `onProgress` callback; SSE streaming of render progress to frontend; progress bar in UI; download endpoint streaming `output.mp4`; one concurrent render at a time (no queue needed for single-user).

**Features addressed:** Final video render with burned-in subtitles, download rendered video, progress feedback during render

**Pitfalls avoided:** Render event loop blocking (Pitfall 6)

**Research flag:** Needs phase-specific research — verify current `renderMedia()` API signature, `onProgress` callback shape, and worker thread invocation pattern against remotion.dev/docs/renderer/render-media before implementation.

### Phase 6: Style Controls and Polish

**Rationale:** Style config is pure frontend state that feeds the already-built composition. This phase adds UI surface area without architectural changes. Progressive-reveal mode adds a second render path to the already-validated composition architecture.

**Delivers:** Style panel with font size, highlight color, text stroke, vertical position slider (percentage); progressive-reveal rendering mode in the composition; mode toggle (karaoke / progressive-reveal); style config persisted in Zustand store and included in render props; curated web font list (tested against render output).

**Features addressed:** Font customization, highlight color selection, text stroke, subtitle positioning control, progressive-reveal mode, both modes in same tool

**Pitfalls avoided:** Subtitle safe zone violations (Pitfall 8) — position slider rather than hard-coded enum

**Research flag:** Standard patterns — CSS/React styling patterns are well-documented. No phase-specific research needed.

### Phase Ordering Rationale

- **Foundation before everything** (Phase 1): file paths and normalized video are prerequisites for every subsequent phase; pitfall debt here accrues against all later phases
- **Transcription before UI** (Phase 2): platform compatibility must be validated before the API contract is locked in; this is explicitly a spike
- **Composition before editor** (Phase 3): the frame-timing contract must be validated with fixture data before real transcript data is connected; the data model (binary search lookup) must be in place before long-video testing
- **Editor after composition** (Phase 4): segmentation is a frontend concern that feeds the composition as props; the state model separation must be designed before the editing UI is built
- **Render after editor** (Phase 5): render props require the full transcript + style state to be in final form
- **Style last** (Phase 6): style is additive to the working pipeline; progressive-reveal adds to the validated composition without restructuring it

### Research Flags

Phases needing deeper research during planning (verify against official docs before implementation):

- **Phase 2 (Transcription):** Validate faster-whisper platform support matrix (CUDA/Windows vs. CoreML/macOS), `large-v3-turbo` availability, WhisperX cross-platform status, and measured word timestamp accuracy. This is the highest-risk phase for discovering platform incompatibility.
- **Phase 3 (Remotion Composition):** Verify `<Player>` component props API and `@remotion/google-fonts` loading approach against current remotion.dev/docs. API surfaces in Remotion 4.x may have changed since training cutoff.
- **Phase 5 (Server-Side Render):** Verify `renderMedia()` API signature, `onProgress` callback shape, and recommended worker thread invocation pattern against remotion.dev/docs/renderer/render-media.

Phases with standard patterns (skip phase-specific research):

- **Phase 1 (Foundation):** FFmpeg normalization, streaming upload, and file system patterns are well-documented and stable.
- **Phase 4 (Transcript Editor):** Zustand store patterns and transcript editing UI are standard React patterns.
- **Phase 6 (Style Controls):** CSS styling in Remotion and React state patterns are well-documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core choices (Remotion, faster-whisper, Fastify, Zustand) are well-reasoned from training data; React 19 / Remotion 4.x compatibility and `large-v3-turbo` model availability must be verified before pinning versions |
| Features | MEDIUM | Feature set derived from well-established domain patterns (Whisper ecosystem, Remotion, Kapwing/Submagic/Descript); competitive feature set not verified against current tools |
| Architecture | MEDIUM-HIGH | Props-driven Remotion composition, faster-whisper subprocess pattern, and file system job layout are HIGH confidence; SSE/`onProgress` API signature needs verification against current Remotion docs |
| Pitfalls | MEDIUM-HIGH | Frame-timing, VFR desync, render blocking, Windows paths, FFmpeg codec issues are HIGH confidence (fundamental platform constraints); Whisper timestamp drift numbers and platform compatibility matrix are MEDIUM (need real benchmarking) |

**Overall confidence:** MEDIUM

### Gaps to Address

- **React 19 / Remotion 4.x compatibility**: Remotion targets React 18+; React 19 may have breaking changes. Verify at `remotion.dev/docs` before starting Phase 3. If React 19 is unsupported, pin React 18.x.
- **Transcription platform benchmarks**: The only way to know if faster-whisper is acceptable on both platforms is to run it on both platforms with a real test video before Phase 2 is complete. Do not skip this.
- **WhisperX adoption decision**: Whether faster-whisper alone provides acceptable word timestamp accuracy, or whether WhisperX forced alignment is required, can only be determined by testing with real videos on both platforms. This decision gates the Phase 4 editing UI scope.
- **Tailwind 4 + shadcn/ui compatibility**: Tailwind 4 changed to CSS-first configuration; shadcn/ui compatibility needs verification. If incompatible, fall back to Tailwind 3.
- **`large-v3-turbo` model availability**: Verify this model exists in the faster-whisper model registry at implementation time. Fall back to `large-v3` if not.
- **Remotion API surfaces**: Three specific API pages must be checked before Phases 3 and 5: `<Player>` props, `@remotion/google-fonts`, and `renderMedia()` / `onProgress`. These are the highest-surface-area Remotion APIs in this project.

## Sources

### Primary (HIGH confidence — fundamental constraints)
- Node.js event loop behavior — Pitfall 6 (render blocking)
- FFmpeg VFR/CFR documentation — Pitfall 3 (VFR desync)
- Remotion design documentation (training data) — Pitfall 2 (frame timing), Pitfall 13 (composition duration)
- Python subprocess isolation — ARCHITECTURE.md Anti-Pattern 4

### Secondary (MEDIUM confidence — community patterns, training data)
- remotion.dev/docs (training data, August 2025 cutoff) — composition architecture, Player API, renderMedia API
- SYSTRAN/faster-whisper GitHub (training data) — word timestamp output format, platform support
- m-bain/whisperX (training data) — forced alignment accuracy claims
- WhisperX paper (training data) — word timestamp precision figures
- Kapwing, Submagic, CapCut, Descript, Descript (training data) — feature landscape patterns

### Tertiary (LOW confidence — needs live verification)
- React 19 / Remotion 4.x compatibility — verify at remotion.dev/docs before Phase 3
- `large-v3-turbo` model availability in faster-whisper — verify at PyPI before Phase 2
- Tailwind 4 / shadcn/ui compatibility — verify at shadcn/ui docs before Phase 6
- Whisper word timestamp drift numbers — verify with real benchmarks on both platforms in Phase 2
- faster-whisper Apple Silicon CoreML performance — verify with real benchmarks in Phase 2

---
*Research completed: 2026-02-25*
*Ready for roadmap: yes*
