---
phase: 15-desktop-app-port
plan: 07
subsystem: settings
tags: [settings, app-config, huggingface-token, media-root, fastify, react, electron]

requires:
  - phase: 15-01
    provides: DATA_ROOT / MEDIA_ROOT env-driven backend config
  - phase: 15-05
    provides: window.eigen.chooseFolder preload bridge, desktop shell main.ts
  - phase: 15-06
    provides: pythonEnv / setup routes and App launch gate (untouched)
provides:
  - fastify.appConfig (settings.json under DATA_ROOT; getSetting/setSetting/getAll, atomic writes)
  - GET/PUT /api/settings (no raw token echo; token format + writable media-root validation)
  - SettingsDialog + Header gear entry point + settingsPrefs client
  - Desktop shell launches the backend with the saved media root
  - First-transcription model-download progress state (Job.phase = downloading_model)
affects: [15-08, 15-09]

actuals:
  tokens: 14500
  tasks: 3
  commits: 3

key-files:
  created:
    - packages/backend/src/services/appConfig.ts
    - packages/backend/src/routes/settings.ts
    - packages/backend/src/services/modelCache.ts
    - packages/frontend/src/components/SettingsDialog.tsx
    - packages/frontend/src/components/SettingsDialog.css
    - packages/frontend/src/lib/settingsPrefs.ts
    - packages/frontend/src/lib/settingsPrefs.test.ts
  modified:
    - packages/backend/src/index.ts
    - packages/backend/src/routes/transcribe.ts
    - packages/backend/src/routes/diarize.ts
    - packages/backend/src/services/transcription.ts
    - packages/shared-types/src/index.ts
    - packages/frontend/src/components/Header.tsx
    - packages/frontend/src/components/Header.css
    - packages/frontend/src/hooks/useTranscribe.ts
    - packages/frontend/src/pages/SubtitlesPage.tsx
    - packages/desktop/src/config.ts
    - packages/desktop/src/config.test.ts
    - packages/desktop/src/main.ts

key-decisions:
  - "The shell (not the backend) applies the saved media root: backend resolves MEDIA_ROOT once at startup, so main.ts reads settings.json at launch via readSavedMediaRoot; the dialog says the change takes effect on next start and that existing projects are not moved"
  - "Token validation is a format check (hf_ prefix) only, no network call to HuggingFace"
  - "Model-download percent is inferred from bytes in the HF cache blobs/ dir (transcribe.py's stdout protocol is unchanged and gives no download percent), kept monotonic"
  - "GET /api/settings reports hasToken true when the HUGGINGFACE_TOKEN env fallback is set so the dialog does not mislead dev users"

requirements-completed: [D-09, D-11]

status: complete
---

# Phase 15 Plan 07: In-app Settings Summary

**Backend settings store + /api/settings, header-gear SettingsDialog for the HuggingFace token and media storage folder (native picker), routes sourcing the token from config, and a visible first-run model-download progress state**

## Accomplishments
- `appConfig` fastify plugin: `settings.json` under DATA_ROOT, atomic temp-file + rename writes, mode 0600, corrupt/missing file falls back to defaults.
- `GET/PUT /api/settings`: returns `{mediaRoot, activeMediaRoot, hasToken}` and never the token; PUT validates everything before saving anything (token format, absolute + existing + actually-writable directory via a probe file) and returns 400 with the UI-SPEC copy and a `field` name.
- `transcribe.ts` / `diarize.ts` read `appConfig.getSetting('hfToken') ?? process.env.HUGGINGFACE_TOKEN`; the diarize missing-token message now points at Settings.
- `SettingsDialog` (480px, TranscriptionOptionsDialog chrome, BEM `settings-dialog`): masked write-only token field (blank = keep), read-only media path + "Choose Folder…" via `window.eigen.chooseFolder` (disabled with explanation outside Electron), Save Settings/Cancel, inline errors, Escape/Enter handling.
- Header gear button (`data-tooltip="Settings"`, inline stroke SVG) opens the dialog.
- Desktop: `readSavedMediaRoot(dataRoot)` (validated, unit tested) feeds `resolveMediaRoot` in `main.ts`, closing the Plan 05 gap.
- Model download: pipeline detects an uncached faster-whisper large-v3, sets `Job.phase='downloading_model'` and drives `progress` from cache growth; `SubtitlesPage` shows "Downloading transcription model… N%" in the existing progress-card (works for upload auto-transcribe and re-transcribe since both go through the `transcribing` branch); a failure while the model is still incomplete yields "Model download failed — check your internet connection and try again." with the existing "Try again" button.

## Task Commits
1. Task 1 backend appConfig + /api/settings + token reads: `a94ee27`
2. Shell media-root wiring (supports Task 1/D-11): `9ca3846`
3. Task 2 SettingsDialog + Header gear + settingsPrefs: `be40029`
4. Task 3 model-download progress: `0efa65d`

## Deviations from Plan

**1. [Rule 3 - Blocking] Worktree base lacked Plan 06**
- Worktree HEAD predated 15-06 (which this plan builds on); fast-forwarded the branch to `main` (HEAD was an ancestor, no merge commit) before starting.

**2. [Rule 2 - Missing critical] Media root had no effect without shell wiring**
- The backend reads MEDIA_ROOT once; saving the setting alone changed nothing. Added `readSavedMediaRoot` + `main.ts` wiring (files outside the plan's list: `packages/desktop/src/{config.ts,config.test.ts,main.ts}`), plus a "takes effect next start" hint in the dialog.

**3. [Rule 3 - Blocking] Task 3 required backend + shared-types changes**
- No model-download signal reached the client, and the plan scoped Task 3 to `SubtitlesPage.tsx` only. Added optional `Job.phase`, `services/modelCache.ts`, an `onProgress(percent, status?)` second argument in `transcription.ts`, and pipeline logic in `transcribe.ts`, plus `useTranscribe.ts`. The transcribe.py stdout protocol is unchanged.

**4. [Rule 2] Extra tests** for `settingsPrefs` (4) and `readSavedMediaRoot` (4).

## Verification
- `npx tsc -b packages/backend --force`: exit 0 (after each task).
- `npm run build --workspace packages/frontend`: success.
- `npm test --workspace packages/desktop`: 13/13 pass (was 9).
- Frontend vitest (repo root): 51 pass / 5 fail of 56. Before this plan: 47 pass / 5 fail of 52 (same 5 pre-existing `subtitleStore.test.ts` bulk-action failures; +4 new passing tests). No new failures.
- Live backend smoke (DATA_ROOT/MEDIA_ROOT in temp dirs, port 3099): GET returns mediaRoot/activeMediaRoot/hasToken only; nonexistent and relative mediaRoot -> 400 "Folder is not writable…"; malformed token -> 400 "Invalid token…"; valid PUT persists to settings.json and GET reports `hasToken:true` without the token; `hfToken:""` clears it; write probe file is cleaned up. Env fallback path covered by `hasToken` logic only (transcribe not run).
- modelCache smoke against a fake HF cache: uncached -> false; percent math capped at 99; watcher reports 1 then 11 and stays monotonic when blobs/ is removed; `model.bin` in a snapshot -> cached true; HF_HOME honored.
- Grep acceptance checks (appConfig, api/settings, `getSetting('hfToken')` in both routes, UI copy, chooseFolder, data-tooltip, "Downloading transcription model"): all present.

## Known Stubs
None.

## Threat Flags
None beyond the plan's register. T-15-71 (plaintext token at rest, mode 0600 + user-profile ACL, safeStorage left as follow-up), T-15-72 (writable-dir validation), T-15-73 (no token echo), T-15-74 (preload unchanged) are implemented. Note: `PUT /api/settings` is unauthenticated on 127.0.0.1 like every other API route (D-02/D-12).

## Human Verification Needed
- Real Electron on Windows: gear opens the dialog, Choose Folder returns a native path, saving then restarting launches the backend with that MEDIA_ROOT.
- First transcription on a machine without the large-v3 cache: bar advances during the ~3 GB download, flips to "Transcribing…", and an offline run shows the failure copy. Cache layout (`blobs/` growth, `HF_HUB_DISABLE_SYMLINKS` behavior) was only simulated.
- Changing the media root does not move existing projects' media (by design here); a migration step may be wanted.

## Self-Check: PASSED
- FOUND files: appConfig.ts, settings.ts, modelCache.ts, SettingsDialog.tsx/.css, settingsPrefs.ts/.test.ts
- FOUND commits: a94ee27, 9ca3846, be40029, 0efa65d
