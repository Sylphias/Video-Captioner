# Phase 15: Desktop App Port - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 15-desktop-app-port
**Areas discussed:** Shell technology & window model, Target platform & Python/ML strategy, Packaging/data/startup, Remaining webapp workflow fixes

---

## Shell Technology & Window Model

| Option | Description | Selected |
|--------|-------------|----------|
| Electron | Ships its own Node runtime; backend runs in-process or as child; largest download but simplest integration for an all-Node stack | ✓ |
| Tauri | Smaller/lighter but Rust core; Node backend would still need packaging as a sidecar | |
| Lightweight launcher / tray app | Tray utility starts server and opens browser; cheapest, least desktop-app feel | |

**User's choice:** Electron

Before answering the architecture question, the user asked two clarifying questions:
1. *"Do we need to stick with the same backend/frontend system for a local app?"* — Answered: no, but keeping the HTTP split makes this a packaging job rather than a rewrite (IPC would require rewriting all fetch/SSE/video-streaming code).
2. *"Does the backend start/stop with the Electron app? Will processes be cleaned up without stragglers?"* — Answered: yes by design; grandchild processes (Python/FFmpeg/Remotion workers) are the real risk, mitigated by graceful shutdown, tree-kill fallback, orphan watchdog, and single-instance lock. These guarantees were folded into the decision.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep HTTP split | Backend as managed child process with lifecycle guarantees; frontend code unchanged | ✓ |
| Rewrite to Electron IPC | No open port but large refactor of hooks/SSE/video serving | |
| Hybrid | IPC for app concerns + HTTP for data/media | |

**User's choice:** Keep HTTP split (with lifecycle guarantees)

| Option | Description | Selected |
|--------|-------------|----------|
| Backend serves built frontend | @fastify/static serves Vite build; window loads http://localhost:3001 | ✓ |
| Electron loads files directly | file:// or app:// protocol; needs API base URL injection | |
| You decide | Defer to research/planning | |

**User's choice:** Backend serves built frontend

| Option | Description | Selected |
|--------|-------------|----------|
| Splash/loading window | Instant splash until backend health check passes | ✓ |
| Main window with loading state | One window with internal spinner | |
| Make startup fast instead | Defer Remotion bundling to first use | |

**User's choice:** Splash/loading window

---

## Target Platform & Python/ML Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Windows only | User's daily-driver Windows/RTX 4080 machine | ✓ |
| Windows + macOS | Cross-build both; doubles ML provisioning/testing surface | |
| macOS only (M4 Mac Mini) | Original PROJECT.md target (stale) | |

**User's choice:** Windows only

| Option | Description | Selected |
|--------|-------------|----------|
| Keep everything in WSL (was recommended) | Electron spawns backend via wsl.exe; proven env unchanged | |
| Fully native Windows | Port stack: Windows CUDA torch + WhisperX venv, Windows FFmpeg, backend on Windows Node | ✓ |
| Split: backend Windows, Python WSL | Path translation across boundary; most fragile | |

**User's choice:** Fully native Windows (went against the low-risk recommendation — user prefers a genuinely self-contained desktop app)

| Option | Description | Selected |
|--------|-------------|----------|
| First-run setup in-app | App detects missing venv, runs uv setup with progress UI | ✓ |
| Manual setup script | One-time script outside the app | |
| Bundle everything in installer | ~6-7GB installer | |

**User's choice:** First-run setup in-app

| Option | Description | Selected |
|--------|-------------|----------|
| In-app settings + auto-download | HF token pasted once into settings; models download on first transcription | ✓ |
| Env/.env file like today | Keep HUGGINGFACE_TOKEN env var | |
| Part of first-run setup wizard | Token + model pre-download during first run | |

**User's choice:** In-app settings + auto-download

---

## Packaging, Data & Startup

| Option | Description | Selected |
|--------|-------------|----------|
| Windows installer | electron-builder NSIS, Start Menu, per-user install | ✓ |
| Portable folder/exe | Run from anywhere, no install step | |
| Repo-launched app | `npm run app` dev workflow, no packaging | |

**User's choice:** Windows installer

| Option | Description | Selected |
|--------|-------------|----------|
| User-data dir + configurable media root | DBs/settings in %APPDATA%; media root changeable in settings | ✓ |
| Everything in %APPDATA% | Fixed location, multi-GB video on C:\ | |
| Ask on first run | Explicit project-location prompt | |

**User's choice:** User-data dir + configurable media root

| Option | Description | Selected |
|--------|-------------|----------|
| Keep LAN access (was recommended) | 0.0.0.0 binding preserves multi-device workflow | |
| Localhost only | 127.0.0.1; nothing else on network can reach it | ✓ |
| Settings toggle (default off) | Localhost with opt-in LAN switch | |

**User's choice:** Localhost only (drops the LAN workflow intentionally)

| Option | Description | Selected |
|--------|-------------|----------|
| Bundle with the app | Static ffmpeg/ffprobe binaries inside install | ✓ |
| First-run download | Fetch alongside Python setup | |
| Require on PATH | Today's behavior (winget/choco) | |

**User's choice:** Bundle with the app

---

## Remaining Webapp Workflow Fixes

| Option | Description | Selected |
|--------|-------------|----------|
| I'll type the list now | Enumerate specific fixes into CONTEXT.md | |
| Fix-budget, decided later | Plan reserves a fixes task; items named at execution/verification | ✓ |
| Drop fixes from this phase | Pure desktop port; fixes to backlog | |

**User's choice:** Fix-budget, decided later

---

## Claude's Discretion

- Electron process API choice for backend child (utilityProcess vs child_process), health-check details
- electron-builder config (app id, icon, install defaults)
- userData directory naming and settings file format
- First-run uv invocation mechanics and progress reporting
- Default media-root location
- Splash window visual design
- Bundled-ffmpeg path injection into the ffmpeg service
- Whether the Vite hot-reload dev workflow is preserved alongside the packaged app

## Deferred Ideas

- macOS / M4 Mac Mini build — revisit if the Mac Mini deployment becomes real again
- LAN multi-device access — could return later as a settings toggle
- Auto-update mechanism — manual reinstall acceptable for a personal tool
