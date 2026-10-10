---
phase: 15-desktop-app-port
plan: 09
subsystem: frontend-timeline + phase-gate
tags: [timeline, zoom, playhead, edge-handles, uat, windows, electron]

requires:
  - phase: 15-08
    provides: Windows NSIS installer
provides:
  - Playhead-anchored zoom in TimingEditor + MiniTimeline (lib/timelineZoom.ts)
  - Jump-to-playhead button (⌖) + `C` shortcut + off-screen playhead indicator in both timelines
  - Seam-aware, larger phrase edge-handle hit zones (lib/edgeHandleZones.ts)
  - Passing full end-to-end desktop UAT on Windows
affects: [16-font-style-studio]

key-files:
  created:
    - packages/frontend/src/lib/timelineZoom.ts
    - packages/frontend/src/lib/timelineZoom.test.ts
    - packages/frontend/src/lib/edgeHandleZones.ts
    - packages/frontend/src/lib/edgeHandleZones.test.ts
  modified:
    - packages/frontend/src/components/TimingEditor/TimingEditor.tsx
    - packages/frontend/src/components/TimingEditor/TimingEditor.css
    - packages/frontend/src/components/TextEditor/MiniTimeline.tsx
    - packages/frontend/src/components/TextEditor/MiniTimeline.css

key-decisions:
  - "User-named fix list (D-14), 2026-10-10: (1) zoom anchors on the playhead, not the mouse pointer (explicit user choice); (2) jump-to-playhead button + shortcut and an off-screen edge indicator (auto-follow during playback NOT requested); (3) grabbable edge handles when phrases are close together, symptom 'can't grab the right edge'"
  - "Font-styling page split out as Phase 16 (Font Style Studio): too large for the reserved fix budget"
  - "Jump-to-playhead shortcut is bare `C`, which no other shortcut uses; ignored while an input or contentEditable has focus"
  - "Root cause of fix 3: TimingEditor's end handle sat at the end of the linger tail, which by default overlaps the next phrase, so the next block painted over it. The handle now sits on the last word's real end, and handles render in a layer above the blocks"

requirements-completed: [D-03, D-14]

status: complete
---

# Plan 15-09 Summary: Workflow Fixes + End-to-End Desktop UAT

**Outcome: PASS. All three user-named fixes are shipped, and the packaged app passed the full end-to-end loop on Windows with no leftover processes.**

## Fixes (Task 2, merged in 5e61c50)

| Commit | Fix |
|--------|-----|
| baa1bb4 | Zoom keeps the playhead fixed in both timelines (Ctrl+Wheel and the −/+ buttons). An off-screen playhead is brought to the centre. Rapid wheel ticks build on each other with no drift. |
| 64e1d04 | ⌖ jump-to-playhead button and the `C` shortcut; an off-screen ◀/▶ pill with the time that jumps on click |
| d34b04b | Edge hit zones of about 12px. The inner part is capped at ¼ of the block width, and adjacent handles are split at the seam. TimingEditor handles render in an overlay layer. |

`clampEdgeDrag`, `MIN_PHRASE_DURATION` and `setPhraseTiming` are unchanged, and no store code was touched.

Automated checks: frontend build and backend tsc OK; desktop tests 13/13; vitest 78 passed, 5 failed. The 5 failures are the existing `subtitleStore` bulk-action tests and are unchanged. The 27 new helper tests pass.

## End-to-end UAT (Task 3, rebuilt installer 2026-10-10)

| Step | Result |
|------|--------|
| Install, splash, main window | PASS |
| Settings: HF token and storage folder | PASS |
| GPU transcription with diarization | PASS |
| Timeline fixes, checked by hand | PASS |
| Render and download | PASS |
| No stragglers after quit | PASS. Every python/node process left was traced to VS Code, the DaVinci Resolve MCP or Stream Deck. None ran as Eigen.exe, and none were ffmpeg or uv. |
| Single-instance relaunch | PASS |

## Known gaps

- The end handle still overlaps about 6px of the × delete button on phrases with no linger time.
- Hovering an edge handle no longer triggers the block's hover style.
- The 5 `subtitleStore` bulk-action test failures from before are still open.
