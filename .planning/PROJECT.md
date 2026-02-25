# Eigen Video Editor

## What This Is

A personal video tools suite with a web frontend and backend, designed to run locally on an Intel desktop or M4 Mac Mini. The platform provides a tabbed interface for switching between different video tools. The first tool is a dynamic subtitle generator that creates word-highlighted subtitles with live preview and final video rendering.

## Core Value

Users can upload a video and get back a rendered video with accurate, dynamically-highlighted subtitles — with full control over transcript editing, word grouping, and visual styling.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Web-based tool suite with header navigation tabs for switching between tools
- [ ] Backend API to handle video processing, transcription, and rendering
- [ ] Upload video and generate word-level timestamped transcript using a free, accuracy-optimized speech-to-text model
- [ ] Edit transcript in a text editor with visible timestamps — fix words, adjust timing
- [ ] Auto-group words into subtitle segments based on silence detection, with manual override to adjust break points
- [ ] Karaoke-style subtitle mode — all words in a phrase visible, current word highlighted in a different color
- [ ] Progressive-reveal subtitle mode — words appear on screen as spoken, current word highlighted
- [ ] User chooses between karaoke-style and progressive-reveal per video
- [ ] Customize subtitle fonts, font stroke, and highlight color
- [ ] Configurable subtitle positioning on the video (top/middle/bottom or drag to position)
- [ ] Live preview of subtitled video in the browser before final render (via Remotion)
- [ ] Render final video with burned-in subtitles and download the result
- [ ] Runs locally on Intel desktop (GPU) or M4 Mac Mini

### Out of Scope

- Multi-user / authentication — personal single-user tool
- Cloud hosting / deployment — runs locally only
- Real-time transcription — optimize for accuracy over speed
- Subtitle file export (SRT/ASS) — v1 renders video only
- Mobile interface — desktop web browser only

## Context

- **Video rendering**: Remotion (https://www.remotion.dev/) for composing and rendering video with subtitle overlays in the browser and on the server
- **Transcription**: Needs word-level timestamps for highlight sync. Must be free, self-hosted, and accuracy-optimized. Whisper-based models are the likely candidate — can leverage GPU on Intel desktop or run on M4 Mac Mini
- **Video types**: Mix of short-form (under 3 min) and mid-length (5-30 min) videos
- **Platform targets**: Intel desktop with GPU (Windows) and M4 Mac Mini (macOS) — transcription model must work on both

## Constraints

- **Cost**: Free/open-source tools only — no paid API services for transcription or rendering
- **Hosting**: Local-only, must run on consumer hardware (Intel desktop GPU or M4 Mac Mini)
- **Transcription accuracy**: Prioritize accuracy over speed — this is for editing, not live use
- **Cross-platform**: Backend must run on both Windows (Intel/GPU) and macOS (M4 Apple Silicon)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Remotion for video composition | User-specified; React-based video framework with browser preview and server-side rendering | — Pending |
| Free self-hosted transcription (Whisper-based) | Must be free, accurate, and run on local hardware with word-level timestamps | — Pending |
| Web frontend with tabbed navigation | Extensible UI for adding future tools to the suite | — Pending |
| Single-user local deployment | Personal tool, no need for auth or cloud infrastructure | — Pending |

---
*Last updated: 2026-02-25 after initialization*
