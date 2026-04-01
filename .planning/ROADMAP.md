# Roadmap: Eigen Video Editor

## Overview

A personal video subtitle tool built as a local web service on an M4 Mac Mini. The build follows a strict pipeline order: establish the foundation and video ingestion pipeline first, validate transcription on Apple Silicon before building API contracts around it, prove the Remotion composition works correctly with fixture data before connecting real transcripts, then connect editing and grouping, render the final output, and finish with styling controls. Six phases, each delivering a verifiable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Monorepo scaffold, platform shell with tab nav, and the video ingestion pipeline (upload, FFmpeg normalization, metadata extraction)
- [x] **Phase 2: Transcription** - Validate faster-whisper on Apple Silicon, build subprocess + API endpoint, stream progress to frontend
- [x] **Phase 3: Composition and Preview** - Build the Remotion composition as a pure props-driven component; embed browser preview with karaoke rendering
- [x] **Phase 4: Transcript Editor and Grouping** - Connect transcription output to editable UI; auto-group words into subtitle phrases with manual override
- [x] **Phase 4.1: Multi-Speaker Diarization and Speaker Lanes** (INSERTED) - Speaker detection via pyannote, color-coded speaker lanes, rename/reassign UI
- [x] **Phase 5: Server Render and Output** - Render final MP4 in a worker thread, stream progress via SSE, deliver download
- [x] **Phase 6: Editing Workflow Redesign** - Restructure editing into 2-stage workflow (Timeline, Text) with collapsible preview, StyleDrawer, undo/redo, waveform timeline
- [x] **Phase 7: Text Animation Creator** - Create and store reusable text animations for vertical/horizontal video resolutions; local DB or file storage for animation presets
- [x] **Phase 8: Keyframe Position Animation** - Keyframe-based subtitle position animation: define text x/y position over time with easing controls, visual keyframe editor, support for horizontal and vertical video
- [ ] **Phase 9: Speaker Lane Layout** - Configurable speaker lane positioning in the video: define where each speaker's subtitles appear, control lane gap/stacking, visual lane position editor with preview
- [ ] **Phase 9.1: Transcription & Diarization Upgrade** (INSERTED) - Migrate from Apple Silicon CPU to NVIDIA RTX 4080 GPU; upgrade transcription (Parakeet TDT or WhisperX) and diarization (pyannote community-1 on CUDA) for faster, more accurate results
- [x] **Phase 10: SRT Import and Text Correction** - Import SRT from DaVinci Resolve, align with Whisper word timestamps for accurate text with word-level timing (completed 2026-03-28)

## Phase Details

### Phase 1: Foundation

**Goal**: Users can access the tool suite in a browser and upload a video that is normalized and ready for transcription
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, INGST-01, INGST-02, INGST-03
**Success Criteria** (what must be TRUE):
  1. User can open the app in a browser on another device on the local network and see the tabbed tool shell
  2. User can navigate between tool tabs via the header without the page reloading
  3. User can upload a video file through the web interface and receive confirmation it was received
  4. Uploaded video is normalized to CFR H.264 + AAC via FFmpeg before any downstream step sees it
  5. Video duration, fps, and resolution are extracted and available to subsequent pipeline steps
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Monorepo scaffold with npm workspaces, TypeScript project references, and shared types
- [x] 01-02-PLAN.md — Fastify backend server with plugins, in-memory job store, FFmpeg service wrappers
- [x] 01-03-PLAN.md — React + Vite frontend shell with dark theme, header, tab navigation
- [x] 01-04-PLAN.md — Upload pipeline end-to-end: upload route, SSE progress, UploadZone, completion UI

### Phase 2: Transcription

**Goal**: Users can generate an accurate word-level timestamped transcript from an uploaded video, with live progress feedback
**Depends on**: Phase 1
**Requirements**: TRANS-01, TRANS-02, TRANS-03
**Success Criteria** (what must be TRUE):
  1. User can trigger transcription on an uploaded video and see a progress indicator while it runs
  2. Transcription completes and produces a word-level timestamped transcript (each word has start time, end time, confidence)
  3. Transcription runs entirely on the M4 Mac Mini without any external API calls
  4. VAD filtering is active by default, reducing hallucinations on silence and non-speech audio
**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md — Python venv setup with faster-whisper, validation spike, production transcription script
- [x] 02-02-PLAN.md — Extended shared types (transcription statuses) and Node.js transcription service module
- [x] 02-03-PLAN.md — Backend transcription endpoint, SSE extension, transcript delivery endpoint
- [x] 02-04-PLAN.md — Frontend transcription UI: useTranscribe hook, TranscriptView, SubtitlesPage integration

### Phase 3: Composition and Preview

**Goal**: Users can see a live browser preview of karaoke-style subtitles playing over their video, driven by the actual transcript
**Depends on**: Phase 2
**Requirements**: RENDER-01, RENDER-02
**Success Criteria** (what must be TRUE):
  1. Browser preview plays the uploaded video with karaoke-mode subtitle overlay — all words in the current phrase visible, the currently-spoken word highlighted in a distinct color
  2. Word highlighting advances in sync with video playback without drift
  3. Preview updates live when transcript or style props change (no page reload required)
  4. The same Remotion composition that drives the browser preview can be invoked for server-side render without modification
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Remotion composition: install dependencies, create SubtitleComposition with OffthreadVideo + SubtitleOverlay, binary search word activation, gap-based phrase grouping
- [x] 03-02-PLAN.md — Frontend preview panel: backend video route, Zustand store, PreviewPanel with @remotion/player, SubtitlesPage integration

### Phase 4: Transcript Editor and Grouping

**Goal**: Users can correct transcription mistakes and control how words are grouped into subtitle phrases, with changes immediately reflected in the preview
**Depends on**: Phase 3
**Requirements**: EDIT-01, EDIT-02, GROUP-01, GROUP-02
**Success Criteria** (what must be TRUE):
  1. User can edit the text of any word in the transcript and see the change reflected in the preview
  2. User can adjust the start and end timestamp of any word in the transcript
  3. System automatically groups words into subtitle phrases based on silence gaps, and the grouping is visible in the editor
  4. User can manually split a phrase at any word boundary or merge two adjacent phrases into one
**Plans:** 2 plans

Plans:
- [x] 04-01-PLAN.md — Store refactor and composition rewiring: extract grouping to lib, two-layer Zustand store (original + session), composition receives pre-computed phrases
- [x] 04-02-PLAN.md — Transcript editor UI: inline word editing, timestamp adjustment, phrase split/merge controls, word-click-to-seek, SubtitlesPage integration

### Phase 04.1: Multi-Speaker Diarization and Speaker Lanes (INSERTED)

**Goal:** Users can detect speakers via pyannote diarization, see speaker-differentiated lanes in the transcript editor with color-coded borders and badges, and manually rename or reassign speakers
**Depends on:** Phase 4
**Plans:** 2 plans

Plans:
- [x] 04.1-01-PLAN.md — Backend diarization pipeline: diarize.py with pyannote-audio, service module, Fastify route, shared-types speaker field
- [x] 04.1-02-PLAN.md — Frontend speaker lanes: type propagation, store extensions, useDiarize hook, speaker badges/colors/rename/reassign in TranscriptEditor

### Phase 5: Server Render and Output

**Goal**: Users can render a final MP4 with burned-in subtitles and download it
**Depends on**: Phase 4
**Requirements**: OUTPUT-01, OUTPUT-02, OUTPUT-03
**Success Criteria** (what must be TRUE):
  1. User can trigger a render from the UI and receive a job ID immediately (render runs in the background)
  2. User sees a render progress bar that updates in real time while the video is being rendered
  3. User can download the completed MP4 file after render completes
  4. The rendered video's subtitle timing and highlighting matches what the browser preview showed
**Plans:** 2 plans

Plans:
- [x] 05-01-PLAN.md — Backend render infrastructure: shared types, Remotion entry point, bundle service, render worker, render/download routes, SSE update
- [x] 05-02-PLAN.md — Frontend render UI: useRender hook, render button, progress bar, download button, human verification

### Phase 6: Editing Workflow Redesign

**Goal**: Restructure the subtitle editing experience into a guided 4-stage workflow — text editing -> timing adjustment -> speaker assignment -> styling — so users can focus on one concern at a time and move through edits efficiently
**Depends on**: Phase 5 (+ Phase 06-01 data layer already committed: types, fonts, store, render pipeline)
**Requirements**: STYLE-01, STYLE-02, STYLE-03, STYLE-04, STYLE-05, EDIT-01, EDIT-02, GROUP-02
**Success Criteria** (what must be TRUE):
  1. User progresses through 4 distinct editing stages in order: Text -> Timing -> Speakers -> Styling
  2. Stage 1 (Text): User can edit transcript text in a paragraph/phrase-based editor for fast bulk edits (add/remove/rewrite lines)
  3. Stage 2 (Timing): User can adjust word timings within phrases and set phrase linger duration; overlapping phrases render at separate vertical positions
  4. Stage 3 (Speakers): User can auto-detect speakers, manually assign/reassign speakers, and add/remove speaker labels
  5. Stage 4 (Styling): User can customize fonts, colors, stroke, position, and per-speaker overrides with live preview
  6. Each stage's changes are immediately reflected in the video preview
  7. User can navigate back to previous stages without losing work
**Plans:** 7 plans (all complete)

Plans:
- [x] 06-01-PLAN.md — Styling data layer: extended StyleProps, per-speaker overrides, 8 Google Fonts, full stack speakerStyles propagation
- [x] 06-02-PLAN.md — Style Controls UI: StylePanel (7 controls), SpeakerStylePanel (per-speaker overrides), Transcript/Style tab bar
- [x] 06-03-PLAN.md — Stage tab shell: 2-stage navigation (Timeline/Text), collapsible preview, StyleDrawer slide-out
- [x] 06-04-PLAN.md — Text Editor: screenplay-style numbered lines, Enter/Backspace split/merge, global undo/redo
- [x] 06-05-PLAN.md — Timing Editor: waveform timeline, phrase blocks, speaker lanes, numeric timestamps, per-phrase linger, drag-to-adjust, word-end markers
- [x] 06-06-PLAN.md — Stage transitions, toast notifications, undo/redo keyboard shortcuts, e2e verification
- [x] 06-07-PLAN.md — Global time-shift: slider/input to offset all word timestamps by a fixed amount (positive or negative) to correct systematic transcription drift

### Phase 7: Text Animation Creator

**Goal**: Users can create, store, and reuse text animation presets for different video resolutions (vertical/horizontal), enabling consistent branding across projects
**Depends on**: Phase 6
**Success Criteria** (what must be TRUE):
  1. User can create custom text animations with configurable parameters (enter/exit transitions, timing, easing)
  2. Animations can be saved as reusable presets with descriptive names
  3. Presets support both vertical (9:16) and horizontal (16:9) video resolutions
  4. Saved presets persist across sessions (local DB or file storage)
  5. User can apply a saved animation preset to the current project's subtitles
**Plans:** 5 plans

Plans:
- [x] 07-01-PLAN.md — Animation type system and Remotion rendering engine: AnimationPreset types, animations.ts helpers, SubtitleOverlay integration
- [x] 07-02-PLAN.md — Backend SQLite preset storage: better-sqlite3 plugin, CRUD routes, 7 built-in preset seeding
- [x] 07-03-PLAN.md — Frontend state and preview wiring: useAnimationPresets hook, store extensions, PreviewPanel + PhraseStylePanel integration
- [x] 07-04-PLAN.md — Animation Editor UI: PresetList, PhaseTimeline, PhasePanel, AnimationPreview, useDebounced hook
- [x] 07-05-PLAN.md — Stage tab integration and end-to-end verification: Animation tab in StageTabBar, SubtitlesPage wiring, human verification

### Phase 8: Keyframe Position Animation

**Goal**: Users can animate subtitle position over time using keyframes with configurable easing, enabling dynamic text movement for both horizontal (16:9) and vertical (9:16) video
**Depends on**: Phase 7
**Success Criteria** (what must be TRUE):
  1. User can define position keyframes (x%, y%) at specific times within a phrase's lifetime
  2. User can set easing functions between keyframes (linear, ease-in, ease-out, ease-in-out, cubic bezier)
  3. Subtitle position interpolates smoothly between keyframes during playback
  4. Keyframe editor provides visual UI for adding, removing, and adjusting keyframes
  5. Position animations work correctly for both horizontal and vertical video aspect ratios
  6. Position keyframes can be saved as part of animation presets for reuse
**Plans:** 5 plans

Plans:
- [ ] 08-01-PLAN.md — Keyframe data model, interpolation engine, bezier-easing, API compatibility
- [ ] 08-02-PLAN.md — BezierEditor SVG component and EasingPicker dropdown with curve thumbnails
- [ ] 08-03-PLAN.md — Animation Builder preview canvas with drag-to-position, aspect ratio switching, builder store
- [ ] 08-04-PLAN.md — Keyframe timeline with multi-property track rows, diamond editing, easing controls
- [ ] 08-05-PLAN.md — App.tsx tab integration, SubtitleOverlay keyframe rendering, end-to-end verification

### Phase 9: Speaker Lane Layout

**Goal**: Users can control where each speaker's subtitles appear on the video — define vertical positions per speaker, configure the gap between overlapping rows, and visually preview lane positions
**Depends on**: Phase 8
**Success Criteria** (what must be TRUE):
  1. User can set a specific vertical position for each speaker's subtitles (not just a global default)
  2. User can control the gap between overlapping subtitle rows (currently hardcoded at 8%)
  3. Video preview updates in real-time as lane positions are adjusted
  4. Lane positions are saved and applied correctly in the final rendered video
  5. Positioning works correctly for both horizontal and vertical video aspect ratios
**Plans:** 3 plans

Plans:
- [ ] 09-01-PLAN.md — Core types, store extension, SubtitleOverlay lane-based positioning, PreviewPanel plumbing
- [ ] 09-02-PLAN.md — Backend lane presets SQLite plugin and CRUD routes
- [ ] 09-03-PLAN.md — Lane controls panel, drag overlay, stage-aware visibility, preset UI, verification

### Phase 9.1: Transcription & Diarization Upgrade (INSERTED)

**Goal**: Upgrade transcription and diarization pipelines to run on NVIDIA RTX 4080 GPU for significantly faster and more accurate results
**Depends on**: Phase 9
**Success Criteria** (what must be TRUE):
  1. Transcription runs on CUDA (RTX 4080) instead of CPU
  2. Transcription produces accurate word-level timestamps (at least as good as current faster-whisper large-v3)
  3. Diarization runs on CUDA with improved speaker detection accuracy
  4. Existing subtitle editing workflow continues to work with the new transcription output
  5. Platform supports Windows (development shifting from Mac to Windows PC)
**Plans:** 1/2 plans executed

Plans:
- [x] 09.1-01-PLAN.md — Platform migration (Windows paths, justfile) + Parakeet TDT spike validation
- [ ] 09.1-02-PLAN.md — CUDA transcription/diarization script rewrite + end-to-end verification

### Phase 10: SRT Import and Text Correction

**Goal**: Users can import an SRT file (e.g. from DaVinci Resolve) and align it with Whisper word timestamps to get accurate text with word-level timing
**Depends on**: Phase 9.1
**Success Criteria** (what must be TRUE):
  1. User can upload/import an SRT file alongside or after transcription
  2. SRT text is aligned with Whisper word timestamps using rough timestamp matching
  3. Resulting transcript has accurate text (from SRT) with precise per-word timing (from Whisper)
  4. User can review and adjust the alignment before accepting
**Plans:** 2/2 plans complete

Plans:
- [x] 10-01-PLAN.md — SRT parsing library, alignment algorithm, store action, useSrtImport hook
- [x] 10-02-PLAN.md — SrtDiffView component, Import SRT button, TextEditor integration, human verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 9.1 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | ✓ Complete | 2026-02-28 |
| 2. Transcription | 4/4 | ✓ Complete | 2026-03-02 |
| 3. Composition and Preview | 2/2 | ✓ Complete | 2026-03-03 |
| 4. Transcript Editor and Grouping | 2/2 | ✓ Complete | 2026-03-04 |
| 4.1 Multi-Speaker Diarization | 2/2 | ✓ Complete | 2026-03-05 |
| 5. Server Render and Output | 2/2 | ✓ Complete | 2026-03-06 |
| 6. Editing Workflow Redesign | 7/7 | ✓ Complete | 2026-03-10 |
| 7. Text Animation Creator | 5/5 | ✓ Complete | 2026-03-13 |
| 8. Keyframe Position Animation | 5/5 | ✓ Complete | 2026-03-25 |
| 9. Speaker Lane Layout | 3/3 | ◆ Verifying | - |
| 9.1 Transcription Upgrade | 1/2 | In Progress|  |
| 10. SRT Import & Text Correction | 2/2 | Complete    | 2026-03-28 |

### Phase 11: Text Editor Enhancements

**Goal:** Improve the text editing view with multi-select phrase joining, find-and-replace for mass word correction, full keyboard shortcuts, contextual bulk actions toolbar, and low-confidence word hints
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11
**Depends on:** Phase 10
**Plans:** 3/3 plans complete

Plans:
- [x] 11-01-PLAN.md — Bulk store actions (mergePhrases, deletePhrases, duplicatePhrase, movePhraseUp/Down) with unit tests
- [x] 11-02-PLAN.md — Multi-select UI, BulkActionsToolbar, keyboard shortcuts, low-confidence word underlines
- [x] 11-03-PLAN.md — Find/Replace bar with preview modal, findReplace utility with tests

### Phase 12: UI/UX Layout Improvements

**Goal:** Reposition Re-transcribe/Re-upload buttons, make style drawer behave like Animation page (inline, not overlay), and make Global Styling a permanent fixture on the left panel
**Requirements**: TBD
**Depends on:** Phase 11
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 12 to break down)

### Phase 13: Project persistence and landing page — save/load video projects, project list UI, nav restructure

**Goal:** Users can save and load video editing sessions as named projects, with a landing page showing a card grid of existing projects, auto-save, and full project lifecycle management (rename, delete, duplicate, re-transcribe)
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15, D-16, D-17
**Depends on:** Phase 12
**Plans:** 4 plans

Plans:
- [ ] 13-01-PLAN.md — Backend SQLite project store, CRUD API routes, thumbnail endpoint
- [ ] 13-02-PLAN.md — Frontend state serialization (buildStateBlob, loadProjectBlob)
- [ ] 13-03-PLAN.md — Nav restructure (Projects | Animation Builder), ProjectsPage card grid, SubtitlesPage project-scoping
- [ ] 13-04-PLAN.md — Project lifecycle (context menu, delete, rename, duplicate, re-transcribe), auto-save with indicator
