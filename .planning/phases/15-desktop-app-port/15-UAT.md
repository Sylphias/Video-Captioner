---
status: testing
phase: 15-desktop-app-port
source: [15-VERIFICATION.md]
started: 2026-10-10T12:15:05Z
updated: 2026-10-10T12:15:05Z
---

## Current Test

number: 1
name: Orphan watchdog on Electron crash / force-kill (D-03)
expected: |
  Force-kill ONLY the Eigen.exe main process (Task Manager "End task", not "End process tree") while a
  transcription is running, then again while a render is running. Within ~5s the backend exits on its own and
  no python.exe / uv.exe / ffmpeg.exe / chrome-headless-shell / Remotion compositor processes from Eigen remain.
awaiting: user response

## Tests

### 1. Orphan watchdog on Electron crash / force-kill (D-03)
expected: Within ~5s of force-killing Eigen.exe mid-transcription and mid-render, the backend exits and no Eigen python/uv/ffmpeg/headless-browser/compositor processes remain
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
