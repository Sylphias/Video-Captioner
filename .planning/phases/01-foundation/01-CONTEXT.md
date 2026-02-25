# Phase 1: Foundation - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Monorepo scaffold, web UI shell with header tab navigation, and the video ingestion pipeline (upload, FFmpeg normalization, metadata extraction). Users can access the tool in a browser on the local network, see the tabbed tool shell, upload a video, and have it normalized and ready for transcription.

</domain>

<decisions>
## Implementation Decisions

### Tool shell & navigation
- Fixed horizontal tabs in the header — always visible
- For v1: single "Subtitles" tab only, no placeholder/coming-soon slots — add tabs as tools are built
- Header layout: "Eigen Video Editor" app name on the left, tool tabs on the right
- Landing page for Subtitles tool: centered upload prompt area ("Drop a video or click to upload")

### Upload experience
- Drag-and-drop zone that also works as a click-to-open file picker
- Progress bar + status text feedback: "Uploading... 45%" → "Normalizing video..." → "Ready"
- After upload completes: show video info (thumbnail, duration, resolution) + "Transcribe" button — user controls when to start transcription
- No file size limit — accept anything, it's local storage
- Manual cleanup only — job files (source video, transcript, output) persist until user explicitly deletes them

### Video normalization strategy
- **Critical decision:** Normalization (VFR-to-CFR, H.264) is applied to an internal copy for transcription and preview use ONLY
- The original uploaded video is preserved as-is for the final render output — no quality degradation from re-encoding
- Two video files per job: `original.*` (untouched) and `normalized.mp4` (for pipeline use)

### Visual direction
- Dark mode — dark background, light text
- Professional/sleek aesthetic — DaVinci Resolve as reference
- Color palette: shades of grey with green accents — monochrome base, green for interactive elements and highlights
- No bright colors, no playful design — professional video tool feel

### Project structure
- npm workspaces monorepo with 4 packages: `@eigen/frontend`, `@eigen/backend`, `@eigen/remotion-composition`, `@eigen/shared-types`
- Job data stored in `data/` folder at repo root (gitignored)

### Claude's Discretion
- Port assignments for frontend dev server and backend API
- Exact folder layout within `data/` (job-id-based subfolders)
- Header typography and spacing details
- Loading skeleton / spinner design choices
- Upload drop zone visual design (border style, icon choice)

</decisions>

<specifics>
## Specific Ideas

- DaVinci Resolve is the visual reference — professional, dense, dark, functional
- The upload landing should feel inviting but not playful — a clear drop zone, not a marketing page
- Green accents should be subtle — think status indicators and active states, not dominant color

</specifics>

<deferred>
## Deferred Ideas

- Job history / dashboard view (browse previous jobs) — potential future enhancement, not in Phase 1's upload-prompt landing
- Auto-start transcription after upload — user preferred explicit "Transcribe" button for control

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-25*
