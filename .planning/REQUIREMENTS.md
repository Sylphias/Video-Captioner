# Requirements: Eigen Video Editor

**Defined:** 2026-02-25
**Core Value:** Users can upload a video and get back a rendered video with accurate, dynamically-highlighted subtitles — with full control over transcript editing, word grouping, and visual styling.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Platform

- [ ] **PLAT-01**: User can switch between tools via header navigation tabs in the web interface
- [ ] **PLAT-02**: Backend runs on M4 Mac Mini and is accessible from other devices on the local network

### Video Ingestion

- [ ] **INGST-01**: User can upload a video file through the web interface
- [ ] **INGST-02**: System normalizes uploaded video (VFR-to-CFR, H.264 codec) via FFmpeg
- [ ] **INGST-03**: System extracts video metadata (duration, fps, resolution) on upload

### Transcription

- [ ] **TRANS-01**: User can generate word-level timestamped transcript from uploaded video
- [ ] **TRANS-02**: User sees progress feedback during transcription
- [ ] **TRANS-03**: Transcription runs locally on Apple Silicon (M4 Mac Mini)

### Transcript Editing

- [ ] **EDIT-01**: User can edit transcript word text to fix transcription mistakes
- [ ] **EDIT-02**: User can adjust word-level timestamps in the transcript editor

### Word Grouping

- [ ] **GROUP-01**: System auto-groups words into subtitle phrases based on silence detection
- [ ] **GROUP-02**: User can manually split and merge word groups to override auto-grouping

### Subtitle Rendering

- [ ] **RENDER-01**: Karaoke mode displays all words in a phrase with current word highlighted in chosen color
- [ ] **RENDER-02**: User can preview subtitled video in the browser with live updates as settings change

### Styling

- [ ] **STYLE-01**: User can customize subtitle font size
- [ ] **STYLE-02**: User can choose highlight color for the currently-spoken word
- [ ] **STYLE-03**: User can set subtitle vertical position (top/middle/bottom or percentage)
- [ ] **STYLE-04**: User can customize text stroke/outline for subtitle legibility
- [ ] **STYLE-05**: User can select from a curated list of web fonts for subtitles

### Output

- [ ] **OUTPUT-01**: User can render final video with burned-in subtitles as MP4
- [ ] **OUTPUT-02**: User can download the rendered video file
- [ ] **OUTPUT-03**: User sees progress feedback during video rendering

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Subtitle Modes

- **RENDER-03**: Progressive-reveal mode where words appear on screen as spoken with current word highlighted
- **RENDER-04**: User can choose between karaoke and progressive-reveal modes per video

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Windows/Intel GPU support | Hosting on M4 Mac Mini only |
| SRT/VTT/ASS subtitle export | Render-only workflow; subtitle files are a competing output path |
| Multi-user / authentication | Single-user personal tool |
| Cloud deployment | Local network only by design |
| Mobile / responsive UI | Video editing requires desktop screen space |
| Real-time transcription | Batch for accuracy; not live use |
| Speaker diarization | Irrelevant for burned-in subtitles |
| Subtitle translation | Out of scope; manual editing covers this |
| Video editing (trim/cut/splice) | Different tool category entirely |
| Batch processing | Single video workflow |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | — | Pending |
| PLAT-02 | — | Pending |
| INGST-01 | — | Pending |
| INGST-02 | — | Pending |
| INGST-03 | — | Pending |
| TRANS-01 | — | Pending |
| TRANS-02 | — | Pending |
| TRANS-03 | — | Pending |
| EDIT-01 | — | Pending |
| EDIT-02 | — | Pending |
| GROUP-01 | — | Pending |
| GROUP-02 | — | Pending |
| RENDER-01 | — | Pending |
| RENDER-02 | — | Pending |
| STYLE-01 | — | Pending |
| STYLE-02 | — | Pending |
| STYLE-03 | — | Pending |
| STYLE-04 | — | Pending |
| STYLE-05 | — | Pending |
| OUTPUT-01 | — | Pending |
| OUTPUT-02 | — | Pending |
| OUTPUT-03 | — | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 0
- Unmapped: 22 ⚠️

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after initial definition*
