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
- [ ] **Phase 6: Styling** - Add font, color, stroke, and position controls; connect style state to composition props and render props

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

**Goal**: Restructure the subtitle editing experience into a guided 4-stage workflow — text editing → timing adjustment → speaker assignment → styling — so users can focus on one concern at a time and move through edits efficiently
**Depends on**: Phase 5 (+ Phase 06-01 data layer already committed: types, fonts, store, render pipeline)
**Requirements**: TBD (to be defined during discuss-phase)
**Success Criteria** (what must be TRUE):
  1. User progresses through 4 distinct editing stages in order: Text → Timing → Speakers → Styling
  2. Stage 1 (Text): User can edit transcript text in a paragraph/phrase-based editor for fast bulk edits (add/remove/rewrite lines)
  3. Stage 2 (Timing): User can adjust word timings within phrases and set phrase linger duration; overlapping phrases render at separate vertical positions
  4. Stage 3 (Speakers): User can auto-detect speakers, manually assign/reassign speakers, and add/remove speaker labels
  5. Stage 4 (Styling): User can customize fonts, colors, stroke, position, and per-speaker overrides with live preview
  6. Each stage's changes are immediately reflected in the video preview
  7. User can navigate back to previous stages without losing work
**Plans:** TBD (to be planned)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | ✓ Complete | 2026-02-28 |
| 2. Transcription | 4/4 | ✓ Complete | 2026-03-02 |
| 3. Composition and Preview | 2/2 | ✓ Complete | 2026-03-03 |
| 4. Transcript Editor and Grouping | 2/2 | ✓ Complete | 2026-03-04 |
| 4.1 Multi-Speaker Diarization | 2/2 | ✓ Complete | 2026-03-05 |
| 5. Server Render and Output | 2/2 | ✓ Complete | 2026-03-06 |
| 6. Editing Workflow Redesign | 0/? | Not started | - |
