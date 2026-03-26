---
phase: 01-foundation
plan: 02
subsystem: api
tags: [fastify, ffmpeg, typescript, nodejs, multipart, cors, video-processing]

# Dependency graph
requires:
  - phase: 01-01
    provides: npm workspaces monorepo with @eigen/shared-types (Job, JobStatus, VideoMetadata types)
provides:
  - Fastify server on 0.0.0.0:3001 with CORS (origin:true) and multipart (unlimited file size)
  - In-memory job store as Map<string, Job> decorated on Fastify instance with TypeScript type safety
  - FFmpeg normalizeVideo wrapper producing CFR H.264 + AAC .mp4 with progress callback
  - FFprobe probeVideo wrapper returning VideoMetadata with duration/fps/width/height/codec
  - extractThumbnail wrapper producing JPEG at 1-second mark via fast seeking
  - DATA_ROOT constant pointing to repo-root data/ directory, auto-created at startup
affects:
  - 01-03 (frontend upload flow requires backend server running on 3001)
  - 01-04 (integration wires upload routes to FFmpeg services established here)
  - all subsequent phases (FFmpeg pipeline is core to transcription, thumbnail, and rendering)

# Tech tracking
tech-stack:
  added:
    - "@fastify/cors@9.0.1 (CORS for LAN access)"
    - "@fastify/multipart@8.3.0 (streaming upload with unlimited file size)"
    - "fastify-plugin (fp wrapper for encapsulation-breaking plugins)"
    - "/opt/homebrew/bin/ffmpeg + ffprobe (system Homebrew FFmpeg 7.x, installed via brew install ffmpeg)"
  patterns:
    - "Fastify plugins wrapped with fastify-plugin (fp()) to break encapsulation and share decorators across the instance"
    - "TypeScript module augmentation (declare module 'fastify') for FastifyInstance.jobs type safety"
    - "FFmpeg spawn with -progress pipe:1 for machine-readable stdout progress parsing"
    - "Absolute Homebrew paths (/opt/homebrew/bin/ffmpeg) in all spawn calls — avoids PATH issues when not started from a shell"
    - "Startup fail-fast: execFileSync('which', ['ffmpeg']) at module load time with clear install instruction"

key-files:
  created:
    - packages/backend/src/index.ts
    - packages/backend/src/plugins/cors.ts
    - packages/backend/src/plugins/multipart.ts
    - packages/backend/src/services/jobStore.ts
    - packages/backend/src/services/ffmpeg.ts
    - packages/backend/src/services/thumbnail.ts
  modified: []

key-decisions:
  - "fastify-plugin (fp()) wraps all plugins to break Fastify encapsulation — required for fastify.jobs decorator to be accessible in routes registered after jobStorePlugin"
  - "FFmpeg installed via Homebrew (brew install ffmpeg) at plan execution time as a blocking prerequisite"
  - "fileSize: 0 in @fastify/multipart limits means unlimited — required for the no-file-size-limit user constraint"
  - "normalizeVideo accepts optional durationMs param for progress percentage calculation (since FFmpeg stdout progress is in out_time_ms)"

patterns-established:
  - "All Fastify plugins use fp() wrapper from fastify-plugin for proper encapsulation"
  - "FFmpeg/FFprobe always invoked via child_process.spawn with absolute /opt/homebrew/bin/ paths"
  - "Service modules export named functions (not classes or default plugin objects)"
  - "ESM imports throughout — all files use import/export with .ts extensions for --experimental-strip-types"

# Metrics
duration: 3min
completed: 2026-02-25
---

# Phase 1 Plan 02: Fastify Backend Foundation Summary

**Fastify server on 0.0.0.0:3001 with in-memory job store, FFmpeg normalize/probe via child_process.spawn, and thumbnail extraction — all using @eigen/shared-types for typed interfaces**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-25T15:39:01Z
- **Completed:** 2026-02-25T15:41:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Fastify server bootstraps with CORS, multipart (unlimited file size), and job store plugin in correct order
- Job store (`Map<string, Job>`) decorated onto Fastify instance with TypeScript module augmentation for type-safe `fastify.jobs` access
- FFmpeg normalize produces CFR 30fps H.264 + AAC .mp4 from any input using spawn with `-progress pipe:1` for progress
- FFprobe extracts all 5 metadata fields (duration, fps, width, height, codec) from any video file
- Thumbnail extraction produces JPEG at 1-second mark using fast input seeking
- FFmpeg installed as system dependency via Homebrew (`brew install ffmpeg`) during plan execution

## Task Commits

Each task was committed atomically:

1. **Task 1: Fastify server bootstrap with plugins and job store** - `7ccd819` (feat)
2. **Task 2: FFmpeg service wrappers — normalize, probe, and thumbnail** - `200b00c` (feat)

**Plan metadata:** `(pending)`

## Files Created/Modified

- `packages/backend/src/index.ts` - Fastify server bootstrap: registers plugins, DATA_ROOT, health check, listens on 0.0.0.0:3001
- `packages/backend/src/plugins/cors.ts` - CORS plugin (origin: true) wrapped with fastify-plugin
- `packages/backend/src/plugins/multipart.ts` - Multipart plugin (fileSize: 0, files: 1, parts: 10) wrapped with fastify-plugin
- `packages/backend/src/services/jobStore.ts` - Job store plugin with TypeScript augmentation, createJob/updateJob helpers
- `packages/backend/src/services/ffmpeg.ts` - normalizeVideo + probeVideo spawn wrappers with /opt/homebrew/bin paths
- `packages/backend/src/services/thumbnail.ts` - extractThumbnail spawn wrapper with fast -ss seek before -i

## Decisions Made

- Used `fastify-plugin` (fp()) to wrap all plugins — without it, Fastify encapsulation prevents `fastify.jobs` from being visible to routes registered in sibling plugins
- `normalizeVideo` accepts optional `durationMs` because FFmpeg's `-progress pipe:1` reports `out_time_ms` (microseconds) on stdout — knowing total duration is required to compute percentage; made optional so callers without probed duration can still use normalize without progress
- FFmpeg installed at plan execution time via `brew install ffmpeg` — this is a required system dependency documented in RESEARCH.md; plan verification step (`which ffmpeg`) would have failed otherwise
- ESM `.ts` extensions used in import specifiers for compatibility with `--experimental-strip-types` (Node 22)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed FFmpeg via Homebrew**
- **Found during:** Task 2 verification (`which ffmpeg` check)
- **Issue:** FFmpeg binaries not present at `/opt/homebrew/bin/ffmpeg` — required system dependency was not installed
- **Fix:** Ran `brew install ffmpeg` as a background task during Task 1 execution; verified `/opt/homebrew/bin/ffmpeg` and `/opt/homebrew/bin/ffprobe` exist before proceeding with Task 2
- **Files modified:** No source files (system-level install)
- **Verification:** `ls /opt/homebrew/bin/ffmpeg /opt/homebrew/bin/ffprobe` returned both paths; all 3 FFmpeg tests passed
- **Committed in:** N/A (system dependency, not a code change)

---

**Total deviations:** 1 auto-fixed (1 blocking — system dependency)
**Impact on plan:** Required for Task 2 verification to pass. No scope creep; FFmpeg is the documented system prerequisite.

## Issues Encountered

- Node version mismatch: active shell used Node 18.x, but `--experimental-strip-types` requires Node 22. Resolved by sourcing `.zshrc` and using `nvm use 22` before each verification. The backend's `package.json` dev script (`node --watch --experimental-strip-types`) already handles this correctly when started with the right Node version.

## User Setup Required

None - FFmpeg was installed during plan execution. The only system dependency (`brew install ffmpeg`) is now satisfied.

## Next Phase Readiness

- Fastify backend is ready to receive route modules (upload, jobs SSE) in 01-04
- Job store and FFmpeg services are the core building blocks needed by the upload route
- `DATA_ROOT` exported from index.ts is ready for use by route modules to construct job directory paths
- All services import from `@eigen/shared-types` — types are fully wired across the monorepo

---
*Phase: 01-foundation*
*Completed: 2026-02-25*

## Self-Check: PASSED

All 7 expected files found. Both task commits verified in git log (7ccd819, 200b00c).
