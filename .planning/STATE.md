# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Users can upload a video and get back a rendered video with accurate, dynamically-highlighted subtitles — with full control over transcript editing, word grouping, and visual styling.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 6 (Foundation)
Plan: 0 of 4 in current phase
Status: Ready to plan
Last activity: 2026-02-25 — Roadmap created, requirements mapped, STATE.md initialized

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-build]: M4 Mac Mini only — no Windows/CUDA path needed; simplifies transcription setup to Apple Silicon (CoreML/CPU) only
- [Pre-build]: faster-whisper chosen over whisper.cpp (inferior word timestamps) and openai/whisper (slow); validate `large-v3-turbo` at implementation time
- [Pre-build]: Remotion composition must be a pure props-driven function — no `Date.now()`, no API calls inside; all timing via `useCurrentFrame() / fps`
- [Pre-build]: VFR-to-CFR normalization must happen on upload in Phase 1; retrofitting is expensive

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 2]: Verify `large-v3-turbo` availability in faster-whisper at implementation time; fall back to `large-v3` if missing
- [Phase 2]: Run real benchmark with test video to confirm word timestamp accuracy is acceptable; evaluate WhisperX if drift is unacceptable
- [Phase 3]: Verify React 19 / Remotion 4.x compatibility before pinning versions; may need to pin React 18.x
- [Phase 3]: Verify `<Player>` props API and `@remotion/google-fonts` API against current remotion.dev/docs before Phase 3
- [Phase 5]: Verify `renderMedia()` API signature and `onProgress` callback shape against current remotion.dev/docs before Phase 5
- [Phase 6]: Verify Tailwind 4 + shadcn/ui compatibility; fall back to Tailwind 3 if incompatible

## Session Continuity

Last session: 2026-02-25
Stopped at: Roadmap created and STATE.md initialized. No plans created yet.
Resume file: None
