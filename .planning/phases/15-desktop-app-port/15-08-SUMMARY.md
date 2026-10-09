---
phase: 15-desktop-app-port
plan: 08
subsystem: packaging
tags: [electron-builder, nsis, windows, packaging, ffmpeg, uv, remotion, better-sqlite3]

requires:
  - phase: 15-02
    provides: REMOTION_BUNDLE_DIR prebuilt-bundle hook in render.ts
  - phase: 15-05
    provides: desktop shell main.ts / backend env injection
  - phase: 15-06
    provides: in-app Python env provisioning (bundled uv consumer)
  - phase: 15-07
    provides: settings / media root / HF token
provides:
  - Unsigned per-user NSIS installer (Eigen-Setup-0.0.1.exe, ~212 MiB)
  - Build-time Remotion bundle, SHA-pinned ffmpeg 9.0.2 + uv 0.12.6 fetch
  - Backend staging (source + hoisted workspace deps + frontend dist) outside asar
  - SCRIPTS_DIR injection so packaged backend finds transcribe.py / diarize.py
affects: [15-09]

key-files:
  created:
    - packages/desktop/electron-builder.yml
    - packages/desktop/build/README.md
    - packages/desktop/scripts/build-remotion-bundle.mjs
    - packages/desktop/scripts/fetch-binaries.mjs
    - packages/desktop/scripts/stage-backend.mjs
    - packages/desktop/scripts/after-pack.cjs
  modified:
    - packages/desktop/package.json
    - packages/desktop/src/config.ts
    - packages/desktop/src/config.test.ts
    - packages/desktop/src/main.ts
    - packages/backend/package.json
    - packages/backend/src/services/transcription.ts
    - packages/backend/src/services/diarization.ts
    - .gitignore

key-decisions:
  - "better-sqlite3 bumped ^12.8 → ^12.11.1: 12.8 does not compile against Electron 43 (ABI 148); rebuilt from source at package time (needs VS Build Tools + Python)"
  - "npm workspaces hoist deps to the repo root, so stage-backend.mjs copies them into the staged backend and after-pack.cjs re-adds node_modules that electron-builder strips from extraResources"
  - "Backend located Python scripts by walking up from its own dir — breaks once packaged; now reads SCRIPTS_DIR injected by the shell (Rule 1 bug fix)"
  - "deleteAppDataOnUninstall: false — %APPDATA%\\Eigen (incl. provisioned venv) survives uninstall/reinstall"

requirements-completed: [D-06, D-10, D-13]

status: complete
---

# Plan 15-08 Summary: Windows NSIS Packaging

**Outcome: PASS: installer built, installed, launched and transcribed on Windows.**

## What was built

- `electron-builder.yml`: NSIS, `oneClick: false`, `perMachine: false` (per-user, no UAC). Backend, frontend dist, Remotion bundle, ffmpeg/ffprobe, uv and Python scripts are shipped as extraResources outside asar.
- `build-remotion-bundle.mjs`: pre-bundles the composition at build time and outputs to `REMOTION_BUNDLE_DIR`.
- `fetch-binaries.mjs`: downloads ffmpeg 9.0.2 and uv 0.12.6, each verified against a pinned SHA-256.
- `stage-backend.mjs` + `after-pack.cjs`: stage the backend with its real `node_modules`.

## Verification

| Check | Result |
|-------|--------|
| Headless smoke run (executor) | `/api/health` ok, SPA served, prebuilt Remotion bundle used, better-sqlite3 loads under Electron ABI |
| Post-merge gate | backend tsc OK, frontend build OK, desktop 13/13, frontend vitest 51/56 (5 pre-existing subtitleStore failures) |
| Human: per-user install, Start Menu entry, uninstaller | PASS |
| Human: splash → main window | PASS |
| Human: first-run setup + transcription in packaged app | PASS |
| Human: no straggler processes after quit | PASS |

## Deviations

1. The better-sqlite3 version was bumped so it builds against Electron 43.
2. The workspace staging and after-pack steps above were added.
3. The SCRIPTS_DIR packaging bug was fixed.
4. The three executor commits carry a "Claude Sonnet 5.5" co-author trailer instead of Opus. This is cosmetic and left as-is.

## Notes for 15-09

- The installer is unsigned and uses the default Electron icon, so SmartScreen warns on install.
- The app does not set `HF_HOME`, so its model cache is shared with the dev `.venv` at `%USERPROFILE%\.cache\huggingface`.
- `%APPDATA%\Eigen` is kept on uninstall.
