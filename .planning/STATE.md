# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Users can upload a video and get back a rendered video with accurate, dynamically-highlighted subtitles — with full control over transcript editing, word grouping, and visual styling.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 6 (Foundation)
Plan: 3 of 4 in current phase
Status: In progress
Last activity: 2026-02-25 — Completed 01-03 (React + Vite frontend shell, dark theme, Header, SubtitlesPage)

Progress: [██░░░░░░░░] 12%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 2.3 min
- Total execution time: 7 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 7 min | 2.3 min |

**Recent Trend:**
- Last 5 plans: 3 min, 2 min, 2 min
- Trend: Stable ~2 min

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
- [01-03]: Dark mode is the only mode — dark styles applied directly to :root/body, no class-based toggle
- [01-03]: Co-located .css files per component (not CSS modules, not styled-components) — keeps tooling minimal
- [01-03]: Single Subtitles tab only — no placeholder/coming-soon slots per user decision
- [01-03]: global.css @imports tokens.css to enforce token-first load order independent of JS import sequence

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
Stopped at: Completed 01-03-PLAN.md — React + Vite frontend shell, dark theme tokens, Header/TabNav/SubtitlesPage
Resume file: None
