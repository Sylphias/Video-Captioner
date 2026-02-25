# Roadmap: Eigen Video Editor

## Overview

A personal video subtitle tool built as a local web service on an M4 Mac Mini. The build follows a strict pipeline order: establish the foundation and video ingestion pipeline first, validate transcription on Apple Silicon before building API contracts around it, prove the Remotion composition works correctly with fixture data before connecting real transcripts, then connect editing and grouping, render the final output, and finish with styling controls. Six phases, each delivering a verifiable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Monorepo scaffold, platform shell with tab nav, and the video ingestion pipeline (upload, FFmpeg normalization, metadata extraction)
- [ ] **Phase 2: Transcription** - Validate faster-whisper on Apple Silicon, build subprocess + API endpoint, stream progress to frontend
- [ ] **Phase 3: Composition and Preview** - Build the Remotion composition as a pure props-driven component; embed browser preview with karaoke rendering
- [ ] **Phase 4: Transcript Editor and Grouping** - Connect transcription output to editable UI; auto-group words into subtitle phrases with manual override
- [ ] **Phase 5: Server Render and Output** - Render final MP4 in a worker thread, stream progress via SSE, deliver download
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
- [ ] 01-01-PLAN.md — Monorepo scaffold with npm workspaces, TypeScript project references, and shared types
- [ ] 01-02-PLAN.md — Fastify backend server with plugins, in-memory job store, FFmpeg service wrappers
- [ ] 01-03-PLAN.md — React + Vite frontend shell with dark theme, header, tab navigation
- [ ] 01-04-PLAN.md — Upload pipeline end-to-end: upload route, SSE progress, UploadZone, completion UI

### Phase 2: Transcription

**Goal**: Users can generate an accurate word-level timestamped transcript from an uploaded video, with live progress feedback
**Depends on**: Phase 1
**Requirements**: TRANS-01, TRANS-02, TRANS-03
**Success Criteria** (what must be TRUE):
  1. User can trigger transcription on an uploaded video and see a progress indicator while it runs
  2. Transcription completes and produces a word-level timestamped transcript (each word has start time, end time, confidence)
  3. Transcription runs entirely on the M4 Mac Mini without any external API calls
  4. VAD filtering is active by default, reducing hallucinations on silence and non-speech audio
**Plans**: TBD

Plans:
- [ ] 02-01: Python faster-whisper spike — validate on Apple Silicon, benchmark `large-v3-turbo` (or fallback), evaluate word timestamp accuracy with real test video
- [ ] 02-02: Transcription subprocess + JSON output — Python script producing `transcript.json` with word-level timestamps
- [ ] 02-03: Backend transcription endpoint — invoke subprocess, stream SSE progress, store transcript.json per job
- [ ] 02-04: Frontend progress UI — display transcription progress, load and display raw transcript on completion

### Phase 3: Composition and Preview

**Goal**: Users can see a live browser preview of karaoke-style subtitles playing over their video, driven by the actual transcript
**Depends on**: Phase 2
**Requirements**: RENDER-01, RENDER-02
**Success Criteria** (what must be TRUE):
  1. Browser preview plays the uploaded video with karaoke-mode subtitle overlay — all words in the current phrase visible, the currently-spoken word highlighted in a distinct color
  2. Word highlighting advances in sync with video playback without drift
  3. Preview updates live when transcript or style props change (no page reload required)
  4. The same Remotion composition that drives the browser preview can be invoked for server-side render without modification
**Plans**: TBD

Plans:
- [ ] 03-01: Remotion composition — `SubtitleComposition.tsx` as a pure props-driven component with frame-based word activation (binary search, `useCurrentFrame() / fps`), karaoke rendering mode
- [ ] 03-02: Frontend preview panel — embed `@remotion/player`, connect to transcript and style props via Zustand, verify frame-timing correctness with a fixture transcript

### Phase 4: Transcript Editor and Grouping

**Goal**: Users can correct transcription mistakes and control how words are grouped into subtitle phrases, with changes immediately reflected in the preview
**Depends on**: Phase 3
**Requirements**: EDIT-01, EDIT-02, GROUP-01, GROUP-02
**Success Criteria** (what must be TRUE):
  1. User can edit the text of any word in the transcript and see the change reflected in the preview
  2. User can adjust the start and end timestamp of any word in the transcript
  3. System automatically groups words into subtitle phrases based on silence gaps, and the grouping is visible in the editor
  4. User can manually split a phrase at any word boundary or merge two adjacent phrases into one
**Plans**: TBD

Plans:
- [ ] 04-01: Zustand transcript store — separate immutable Whisper output from mutable session state; define word and segment data models
- [ ] 04-02: Transcript editor UI — editable word list with word text and timestamps; inline text correction and timestamp adjustment
- [ ] 04-03: Auto-grouping — silence-gap segmentation algorithm (gap threshold, max words, max duration, punctuation signals)
- [ ] 04-04: Manual grouping overrides — split and merge controls in the editor UI; segmentation changes flow to composition props

### Phase 5: Server Render and Output

**Goal**: Users can render a final MP4 with burned-in subtitles and download it
**Depends on**: Phase 4
**Requirements**: OUTPUT-01, OUTPUT-02, OUTPUT-03
**Success Criteria** (what must be TRUE):
  1. User can trigger a render from the UI and receive a job ID immediately (render runs in the background)
  2. User sees a render progress bar that updates in real time while the video is being rendered
  3. User can download the completed MP4 file after render completes
  4. The rendered video's subtitle timing and highlighting matches what the browser preview showed
**Plans**: TBD

Plans:
- [ ] 05-01: Render worker — `renderMedia()` in a Node.js worker thread with `onProgress` callback; verify `renderMedia()` API against current remotion.dev/docs before implementing
- [ ] 05-02: Render endpoint + SSE progress — serialize render props to `render-props.json`, dispatch to worker, stream progress via SSE
- [ ] 05-03: Download endpoint + frontend render UI — trigger render, display progress bar, serve `output.mp4`, download button on completion

### Phase 6: Styling

**Goal**: Users can customize subtitle appearance (font, size, color, stroke, position) and see changes live in the preview before committing to a render
**Depends on**: Phase 5
**Requirements**: STYLE-01, STYLE-02, STYLE-03, STYLE-04, STYLE-05
**Success Criteria** (what must be TRUE):
  1. User can change subtitle font size and see the change immediately in the preview
  2. User can choose the highlight color for the currently-spoken word and see the change in the preview
  3. User can set subtitle vertical position (percentage of frame height) and see the subtitle move in the preview
  4. User can add or adjust text stroke/outline and see the legibility change in the preview
  5. User can select from a curated list of web fonts and the chosen font renders identically in the preview and in the final MP4
**Plans**: TBD

Plans:
- [ ] 06-01: Style Zustand store — font size, highlight color, stroke, vertical position, font family; wire to composition props
- [ ] 06-02: Style panel UI — controls for all five style properties with live preview updates
- [ ] 06-03: Font loading — curated web font list via `@remotion/google-fonts`; validate font render parity between browser preview and MP4 output

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/4 | Not started | - |
| 2. Transcription | 0/4 | Not started | - |
| 3. Composition and Preview | 0/2 | Not started | - |
| 4. Transcript Editor and Grouping | 0/4 | Not started | - |
| 5. Server Render and Output | 0/3 | Not started | - |
| 6. Styling | 0/3 | Not started | - |
