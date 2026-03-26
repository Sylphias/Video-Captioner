# Technology Stack

**Project:** Eigen Video Editor
**Researched:** 2026-02-25
**Confidence note:** All network research tools (WebSearch, WebFetch, Context7) were unavailable during this session. All recommendations are based on training data with cutoff August 2025. Versions MUST be verified against npm/PyPI registries before pinning in package.json / requirements.txt.

---

## Recommended Stack

### Core Framework

| Technology | Version (verify) | Purpose | Confidence | Why |
|------------|-----------------|---------|------------|-----|
| React | 19.x | UI component model, required by Remotion | MEDIUM | Remotion 4.x targets React 18+; React 19 is stable as of late 2024. Remotion compatibility with React 19 needs verification against remotion.dev/docs |
| TypeScript | 5.x | Type safety across frontend and backend | HIGH | Industry default; Remotion ships its own types; prevents subtle frame/timestamp type bugs |
| Vite | 6.x | Frontend dev server and bundler | MEDIUM | Supersedes CRA/webpack for React SPAs; fast HMR; no SSR needed for this local tool |
| Node.js | 22.x LTS | Backend runtime | HIGH | LTS release as of Oct 2024; cross-platform; npm ecosystem for Remotion CLI |

### Video Rendering

| Technology | Version (verify) | Purpose | Confidence | Why |
|------------|-----------------|---------|------------|-----|
| remotion | 4.x | Video composition, browser preview, server-side render | HIGH (user-specified) | User-specified. Remotion is the only React-native video composition framework with both browser Player and server-side headless rendering. No alternative considered. |
| @remotion/player | 4.x (matches remotion) | In-browser live preview | HIGH | Remotion's official browser player component; lets user preview subtitles before committing to a full render |
| @remotion/renderer | 4.x (matches remotion) | Server-side headless rendering via Node.js API | HIGH | Used by backend to trigger `renderMedia()` — the primary render pipeline |
| @remotion/cli | 4.x (matches remotion) | Dev studio and render CLI | HIGH | Useful in development; not needed at runtime |
| ffmpeg (system binary) | 6.x or 7.x | Muxing, audio extraction, container handling | HIGH | Remotion depends on ffmpeg being installed on the host. Also used independently for audio-only extraction before transcription. Must be present on both Windows and macOS. |

**Critical Remotion note:** All `@remotion/*` packages must be on the exact same version. Mismatched versions cause silent runtime failures. Pin all to the same semver in package.json.

### Transcription (Self-Hosted Speech-to-Text)

| Technology | Version (verify) | Purpose | Confidence | Why |
|------------|-----------------|---------|------------|-----|
| faster-whisper | 1.x (Python) | Primary transcription engine with word-level timestamps | HIGH | faster-whisper is a CTranslate2-based reimplementation of Whisper that is 4-8x faster than original Whisper while producing identical or better accuracy. Supports word-level timestamps natively via `word_timestamps=True`. Works on CUDA (Intel GPU/Windows), CPU, and Apple Silicon via CoreML/CPU. |
| CTranslate2 | (installed by faster-whisper) | Inference runtime for faster-whisper | HIGH | Bundled as a faster-whisper dependency; no separate install needed |
| Python | 3.11.x | Runtime for faster-whisper | HIGH | 3.11 is the stable sweet spot — 3.12+ may have dependency compatibility gaps with some ML libs as of 2025. Verify at implementation. |
| whisper-large-v3 or large-v3-turbo model | — | Accuracy-optimized model weights | MEDIUM | large-v3 is the highest-accuracy Whisper model; large-v3-turbo is faster with minimal accuracy loss (released late 2024). For a local personal tool, large-v3-turbo is the recommended default — verify if it's available in faster-whisper's model list at implementation. |

**Why faster-whisper over alternatives:**

| Alternative | Verdict | Reason Against |
|-------------|---------|----------------|
| openai/whisper (original) | Do not use | Slow; no word timestamps in base API (requires separate alignment); CPU-inefficient |
| WhisperX | Consider as fallback | Adds forced alignment for more precise word timestamps; but adds dependency on wav2vec2 models and is more complex to install cross-platform |
| whisper.cpp | Do not use as primary | Fast on CPU/Metal but word-level timestamp quality is less reliable; JSON output parsing is manual; Python integration is awkward |
| Parakeet-TDT (NVIDIA) | Do not use | NVIDIA-only; not cross-platform with M4 Mac Mini |
| Vosk | Do not use | Lower accuracy than Whisper models; not competitive for quality-first use case |

**Word timestamp precision note:** faster-whisper's `word_timestamps=True` uses attention-based alignment. For cases where word boundaries feel imprecise, WhisperX can be layered on top using wav2vec2 forced alignment — mark this as a Phase 2 quality enhancement if needed.

### Backend API

| Technology | Version (verify) | Purpose | Confidence | Why |
|------------|-----------------|---------|------------|-----|
| Fastify | 5.x | HTTP API server (Node.js) | MEDIUM | Fastify 5 (released 2024) is faster than Express with built-in TypeScript support and schema validation via JSON Schema / Zod. For a local tool with file uploads and long-running jobs, Fastify's async-first design and streaming support are better fits than Express. |
| @fastify/multipart | (matches Fastify major) | Video file upload handling | MEDIUM | Fastify's official multipart plugin; handles large binary uploads efficiently |
| zod | 3.x | Input validation and TypeScript inference | HIGH | Industry standard for runtime type validation; works identically on frontend and backend for shared schema definitions |
| child_process / execa | execa 9.x | Spawning Python transcription subprocess | MEDIUM | execa is a typed wrapper around Node's child_process with better error handling and stream support; used to invoke the Python transcription script and capture JSON output |

**Why not Express:** Express 5 is still in RC as of mid-2025 and Express 4 has no native async error propagation. For a greenfield project, Fastify 5 is the clear choice.

**Why not a Python web framework (FastAPI) for the entire backend:** The rendering pipeline is entirely Node.js/Remotion, so a Node.js backend is required. Python is only needed for the transcription subprocess. A Python API server would add unnecessary complexity. The backend calls Python as a subprocess and receives JSON.

### Frontend UI

| Technology | Version (verify) | Purpose | Confidence | Why |
|------------|-----------------|---------|------------|-----|
| Tailwind CSS | 4.x | Utility-first styling | MEDIUM | Tailwind 4 was released early 2025 with CSS-first configuration (no tailwind.config.js). For a local personal tool with no design system requirements, Tailwind is the fastest path to a usable UI. |
| shadcn/ui | (component-level, not versioned as package) | Pre-built accessible UI components | MEDIUM | shadcn/ui generates copy-paste Radix UI components styled with Tailwind. Good for the transcript editor, sliders, and modal dialogs needed in this tool. No external dependency lock-in — components are owned by the project. |
| Radix UI | (installed by shadcn/ui) | Headless accessible primitives | HIGH | Underpins shadcn/ui; handles keyboard navigation, focus management, ARIA for free |
| Zustand | 5.x | Frontend state management | HIGH | Lightweight, no-boilerplate state management. For this tool: transcript state, word groupings, subtitle style config, and render job status all need shared state. Zustand's flat store model is appropriate for this scope — not complex enough to warrant Redux. |
| React Query (TanStack Query) | 5.x | Server state, async job polling | HIGH | Handles upload progress, transcription job polling, and render job status without manual useEffect chains. TanStack Query v5 is stable and the standard for async state in React apps. |

**Why not Next.js:** This is a local tool with no SEO, SSR, or routing requirements beyond simple tabs. Vite + React SPA is lighter, faster to start, and has no server-side rendering complexity to reason about. Next.js adds unnecessary framework overhead.

**Why not Vue or Svelte:** Remotion is React-native. Using any other framework would mean either embedding a React island or forgoing Remotion — both bad. React is non-negotiable here.

### File Handling and Media Pipeline

| Technology | Version (verify) | Purpose | Confidence | Why |
|------------|-----------------|---------|------------|-----|
| ffmpeg (system binary) | 6.x+ | Audio extraction from video for transcription | HIGH | The transcription model needs audio input; ffmpeg extracts WAV/16kHz mono audio reliably from any video container. Also handles the final mux if Remotion needs it. |
| fluent-ffmpeg | 2.x (Node.js) | Node.js wrapper for ffmpeg subprocess | LOW | Convenience wrapper; alternatively use execa directly with ffmpeg CLI flags. Prefer execa directly for simplicity — fluent-ffmpeg adds abstraction for little gain in this use case. |
| multer or @fastify/multipart | — | Streaming upload to disk | MEDIUM | For large video files, streaming to disk (not buffering in memory) is essential. @fastify/multipart with disk storage mode handles this. |

### Monorepo / Project Structure

| Technology | Version (verify) | Purpose | Confidence | Why |
|------------|-----------------|---------|------------|-----|
| npm workspaces | (built-in to npm 7+) | Monorepo package management | HIGH | No external tool needed. npm workspaces handles shared dependencies between `apps/frontend`, `apps/backend`, `apps/remotion`, and `packages/shared-types`. |
| concurrently | 9.x | Run frontend + backend dev servers together | HIGH | `npm run dev` starts both Vite and Fastify simultaneously with labeled output. Simple and sufficient for a local tool. |
| tsx | 4.x | TypeScript execution for Node.js backend dev | HIGH | `tsx` (formerly ts-node-esm) runs TypeScript directly in Node.js without a separate compile step in dev mode. For production, compile with `tsc`. |

### Shared Types

| Technology | Purpose | Confidence | Why |
|------------|---------|------------|-----|
| Shared TypeScript types package | Word timestamps, transcript structure, subtitle segment schema, render job status | HIGH | Define once in `packages/shared-types`, import in both frontend and backend. Prevents transcript data structure drift. Specifically: `WordTimestamp`, `SubtitleSegment`, `TranscriptJob`, `RenderJob` types. |

---

## Alternatives Considered (Summary)

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Transcription | faster-whisper | openai/whisper | 4-8x slower; no native word timestamps |
| Transcription | faster-whisper | WhisperX | More complex install; add as Phase 2 enhancement |
| Transcription | faster-whisper | whisper.cpp | Word timestamp quality inferior; awkward Python integration |
| Backend | Fastify 5 | Express 4 | No async error handling; Express 5 still in RC |
| Backend | Node.js + Python subprocess | FastAPI (Python only) | Remotion renderer is Node.js-native; can't avoid Node.js |
| Frontend | Vite + React SPA | Next.js | SSR/routing overhead unnecessary for local single-user tool |
| State | Zustand | Redux Toolkit | Redux boilerplate excessive for this scope |
| State | Zustand | Context API | Context re-render problems at transcript edit scale |
| Styling | Tailwind 4 | CSS Modules | Tailwind faster for utility-heavy tool UIs |
| Monorepo | npm workspaces | Turborepo / nx | Overkill for 3-4 packages; no build caching needed locally |

---

## Installation Sketch

```bash
# System prerequisites (must be installed on host)
# - Node.js 22.x LTS
# - Python 3.11.x
# - ffmpeg 6.x+ (in PATH)

# Monorepo root
npm install

# Backend (Node.js)
npm install fastify @fastify/multipart zod execa
npm install -D typescript tsx @types/node

# Frontend
npm install react react-dom zustand @tanstack/react-query zod
npm install -D vite @vitejs/plugin-react tailwindcss typescript

# Remotion (all packages must match version)
npm install remotion @remotion/player @remotion/renderer @remotion/cli

# Python transcription service
pip install faster-whisper
# Model download (on first run, or pre-download):
# python -c "from faster_whisper import WhisperModel; WhisperModel('large-v3-turbo')"
```

---

## Version Verification Checklist

Before pinning versions in package.json, verify the following at implementation time:

- [ ] `remotion` — check remotion.dev/changelog for latest 4.x stable
- [ ] `@remotion/player`, `@remotion/renderer`, `@remotion/cli` — must match `remotion` version exactly
- [ ] `react` — verify Remotion docs explicitly list supported React versions (18 vs 19)
- [ ] `faster-whisper` — check PyPI for 1.x stability; confirm `large-v3-turbo` model is available
- [ ] `tailwindcss` — confirm v4 stable release and shadcn/ui compatibility with Tailwind 4
- [ ] `fastify` — confirm v5 stable release on npm
- [ ] `execa` — confirm ESM-only nature in v9; ensure backend uses ESM (`"type": "module"`)
- [ ] Python 3.11 vs 3.12 — check faster-whisper's tested Python versions
- [ ] GPU support on Windows — verify CUDA version required by faster-whisper's CTranslate2 build

---

## Cross-Platform Notes

### Windows (Intel + GPU)
- faster-whisper with CUDA: requires CUDA toolkit and cuDNN installed; CTranslate2 ships a CUDA-enabled wheel on PyPI
- ffmpeg: install via Chocolatey or winget; must be in PATH
- Node.js: standard installer works
- GPU acceleration for Remotion rendering: Remotion uses Chrome headless for rendering; GPU acceleration in headless Chrome on Windows requires `--enable-gpu` flags (verify in Remotion renderer docs)

### macOS (M4 Apple Silicon)
- faster-whisper on Apple Silicon: runs on CPU or uses CoreML via the `ct2-transformers` path; no CUDA available
- Performance: M4 Mac Mini is fast enough on CPU for large-v3 transcription of short/mid-length videos; not blocking
- ffmpeg: install via Homebrew (`brew install ffmpeg`)
- Node.js: standard installer or nvm works; Apple Silicon native builds available
- Remotion: standard npm install; uses system Chrome or Remotion's bundled Chromium

---

## Sources

All recommendations based on training data (knowledge cutoff August 2025). No live sources were available during this research session.

Authoritative sources to verify at implementation:
- Remotion docs and changelog: https://www.remotion.dev/docs
- faster-whisper PyPI: https://pypi.org/project/faster-whisper/
- faster-whisper GitHub: https://github.com/SYSTRAN/faster-whisper
- Fastify docs: https://fastify.dev/docs/latest/
- TanStack Query v5 docs: https://tanstack.com/query/v5
- Tailwind CSS v4 docs: https://tailwindcss.com/docs
- shadcn/ui docs: https://ui.shadcn.com/docs
- Zustand GitHub: https://github.com/pmndrs/zustand
- execa npm: https://www.npmjs.com/package/execa
