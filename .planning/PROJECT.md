# Eigen Video Editor

## What This Is

A subtitle editor for video creators, with a web frontend and backend hosted on an M4 Mac Mini. Upload a video, auto-transcribe with speaker detection, edit and style subtitles with animated text effects, then render the final video with burned-in subtitles.

## Core Value

Users can upload a video and get back a rendered video with accurate, dynamically-highlighted subtitles — with full control over transcript editing, word grouping, visual styling, and text animation.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Upload video and generate word-level timestamped transcript using a free, accuracy-optimized speech-to-text model
- [ ] Auto-detect speakers via diarization with manual rename/reassign
- [ ] Edit transcript in a text editor with visible timestamps — fix words, adjust timing
- [ ] Auto-group words into subtitle segments based on silence detection, with manual override to adjust break points
- [ ] Karaoke-style subtitle mode — all words in a phrase visible, current word highlighted in a different color
- [ ] Customize subtitle fonts, font stroke, and highlight color
- [ ] Configurable subtitle positioning on the video (top/middle/bottom or percentage)
- [ ] Create and apply reusable text animation presets (enter/hold/exit transitions with configurable easing)
- [ ] Keyframe-based subtitle position animation — define text position over time with easing, for both horizontal and vertical video
- [ ] Live preview of subtitled video in the browser before final render (via Remotion)
- [ ] Render final video with burned-in subtitles and download the result
- [ ] Runs on M4 Mac Mini, accessible on local network

### Out of Scope

- Multi-user / authentication — personal single-user tool
- Cloud hosting / deployment — local network only
- Real-time transcription — optimize for accuracy over speed
- Subtitle file export (SRT/ASS) — v1 renders video only
- Mobile interface — desktop web browser only
- Windows/Intel GPU support — M4 Mac Mini only
- Progressive-reveal mode — deferred to v2

## Context

- **Video rendering**: Remotion (https://www.remotion.dev/) for composing and rendering video with subtitle overlays in the browser and on the server
- **Transcription**: Needs word-level timestamps for highlight sync. Must be free, self-hosted, and accuracy-optimized. Whisper-based models (faster-whisper) on Apple Silicon
- **Video types**: Mix of short-form (under 3 min) and mid-length (5-30 min) videos
- **Platform**: M4 Mac Mini (macOS) — single platform target simplifies transcription setup

## Constraints

- **Cost**: Free/open-source tools only — no paid API services for transcription or rendering
- **Hosting**: M4 Mac Mini on local network, accessible from other devices
- **Transcription accuracy**: Prioritize accuracy over speed — this is for editing, not live use

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Remotion for video composition | User-specified; React-based video framework with browser preview and server-side rendering | — Pending |
| Free self-hosted transcription (Whisper-based) | Must be free, accurate, and run on local hardware with word-level timestamps | — Pending |
| Web frontend | Subtitle-focused editing workflow with staged tabs (Timeline, Text, Animation) | — Pending |
| Single-user local deployment | Personal tool, no need for auth or cloud infrastructure | — Pending |
| M4 Mac Mini only (no Windows) | Simplifies transcription setup — single platform target | — Pending |

---
*Last updated: 2026-02-25 after requirements definition*
