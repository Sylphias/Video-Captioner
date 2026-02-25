# Architecture Patterns

**Domain:** Local video subtitle generation tool suite (web app + backend)
**Researched:** 2026-02-25
**Confidence:** MEDIUM — Based on strong training knowledge of Remotion, Whisper, and video pipeline patterns. External sources were unavailable; flag for validation against current Remotion and faster-whisper docs before implementation.

---

## Recommended Architecture

The system is a **single-machine local stack** with three clearly separated tiers: a React web frontend, a Node/Python backend, and a file system as the durable store. There is no cloud, no queue broker, and no database — keeping the architecture simple enough for a single-user local tool.

```
Browser (React + Remotion Player)
        |
        | HTTP (REST or tRPC)
        |
Backend API (Node.js / Express or Fastify)
  |            |               |
  |            |               |
  v            v               v
File System  Transcription  Remotion
(video I/O)  Service        Renderer
             (Python /       (headless
             faster-whisper) Chromium)
```

The key architectural insight: **Remotion serves dual purpose**. The same React composition used for in-browser live preview (via `@remotion/player`) is rendered server-side by the Remotion CLI/renderer into the final MP4. This means subtitle logic lives in one place — the React composition — and is shared between preview and render.

---

## Component Boundaries

| Component | Responsibility | Language/Runtime | Communicates With |
|-----------|---------------|-----------------|-------------------|
| **Web Frontend** | Tabbed UI shell, tool views (subtitle editor, style controls, preview), user interaction | React + TypeScript (Vite) | Backend API (HTTP), Remotion Player (in-process) |
| **Remotion Player** | In-browser live preview of the subtitle composition, scrubbing | `@remotion/player` React component (runs in browser) | Frontend (props), does NOT call backend |
| **Backend API** | File upload, job orchestration, job status, serving video files for preview | Node.js (Express or Fastify) | Frontend (HTTP), Transcription Service (subprocess or HTTP), Remotion Renderer (subprocess or `@remotion/renderer`) |
| **Transcription Service** | Runs faster-whisper, returns word-level JSON transcript | Python (subprocess or FastAPI microservice) | Backend API only |
| **Remotion Renderer** | Server-side render of final video (headless Chromium + ffmpeg) | Node.js via `@remotion/renderer` or CLI | Backend API (invocation), File System (reads source video, writes output MP4) |
| **File System** | Durable store for uploaded videos, transcripts, rendered outputs | Local disk | Backend API (read/write), Remotion Renderer (read source, write output) |

---

## Data Flow

### Upload and Transcription Flow

```
1. User selects video file
        |
        v
2. Frontend POST /api/upload
   → Backend writes video to disk (e.g., uploads/<job-id>/source.mp4)
   → Backend returns job-id + video URL for preview
        |
        v
3. Frontend POST /api/transcribe { job-id }
   → Backend invokes Transcription Service (faster-whisper)
   → faster-whisper reads source.mp4, runs Whisper model
   → Returns word-level JSON: [{ word, start, end, confidence }]
   → Backend writes transcript to disk: uploads/<job-id>/transcript.json
   → Backend returns transcript to frontend
        |
        v
4. Frontend displays editable transcript
   User edits words, adjusts timing, sets segment break points
   Frontend holds edited transcript in local state
```

### Preview Flow

```
5. User configures style (font, color, mode, position)
        |
        v
6. Frontend passes props to <Player> component:
   { videoSrc, transcript, style, mode }
   → Remotion Player renders composition in-browser
   → No backend call needed — pure React/browser rendering
   → User scrubs timeline, sees word-by-word highlighting live
```

### Final Render Flow

```
7. User clicks "Render"
        |
        v
8. Frontend POST /api/render {
     job-id,
     transcript (edited),
     style config,
     subtitle mode
   }
   → Backend serializes render props to disk:
     uploads/<job-id>/render-props.json
   → Backend invokes Remotion Renderer:
     npx remotion render <composition> --props=render-props.json --output=output.mp4
   → Backend polls/streams render progress
   → Returns progress % to frontend via SSE or polling
        |
        v
9. Render completes → output.mp4 at uploads/<job-id>/output.mp4
   Frontend polls /api/jobs/<job-id>/status
   On complete: Frontend shows download link
   GET /api/jobs/<job-id>/download → streams file to browser
```

---

## Component Detail

### Frontend (React + Vite)

The frontend is a single-page app with a tabbed shell. For v1, one tab: "Subtitle Generator." Future tabs add future tools without restructuring.

Key views within the subtitle tool:
1. **Upload panel** — drag-drop or file picker, sends to backend
2. **Transcript editor** — editable word list with timestamps; segment break controls
3. **Style panel** — font, color, stroke, mode (karaoke/progressive), position
4. **Preview panel** — Remotion `<Player>` component consuming props derived from editor state
5. **Render panel** — trigger render, progress bar, download link

State management: Local React state + context is sufficient for single-user, single-job-at-a-time use. No need for Redux or Zustand in v1.

### Remotion Composition (Shared Logic)

This is the most architecturally important component because it runs in **two contexts**: inside the browser (Player) and inside headless Chromium (server render).

```
SubtitleComposition.tsx
  props: {
    videoSrc: string,          // URL to source video file served by backend
    transcript: WordSegment[], // [{word, start, end}], grouped into phrases
    mode: 'karaoke' | 'progressive',
    style: StyleConfig,        // font, colors, stroke, position
    durationInFrames: number,
    fps: number
  }
```

The composition:
- Renders the source video as background
- At each frame, calculates current time → determines active phrase and active word
- Applies karaoke (all words visible, current highlighted) or progressive (words appear on-cue) rendering
- Uses Remotion's `useCurrentFrame()` and `useVideoConfig()` hooks

This composition is registered in `remotion.config.ts` (or `Root.tsx`) for the server renderer to find it by name.

### Backend API (Node.js)

Responsibilities:
- Serve static frontend (in dev: Vite dev server; in prod: serve build/)
- Handle multipart file uploads (e.g., multer)
- Manage job state in-memory (Map of job-id → status) — no database needed for single-user
- Serve uploaded video files to the browser for Remotion Player preview
- Invoke Python transcription subprocess
- Invoke Remotion renderer subprocess
- Stream render progress (SSE or polling endpoint)
- Stream final output file for download

Endpoints:
```
POST   /api/upload                   → { jobId, videoUrl }
POST   /api/jobs/:id/transcribe      → { transcript }
POST   /api/jobs/:id/render          → { started: true }
GET    /api/jobs/:id/status          → { status, progress }
GET    /api/jobs/:id/download        → file stream
GET    /static/uploads/:id/source.mp4 → video file (for Player)
```

### Transcription Service (Python / faster-whisper)

Two valid deployment patterns:

**Pattern A — Direct subprocess (simpler, recommended for v1)**
Backend calls Python script directly:
```
python transcribe.py --input /path/to/source.mp4 --output /path/to/transcript.json --model large-v3
```
Script exits when done. Backend reads output JSON. No persistent process.

**Pattern B — FastAPI microservice (more complex, better for iteration)**
Python runs a persistent FastAPI server on localhost:8001. Backend POSTs job requests, polls for completion. Avoids Python startup overhead on repeated calls.

Recommendation: Start with Pattern A (subprocess). Upgrade to Pattern B if startup latency becomes painful during development iteration.

Output schema (transcript.json):
```json
{
  "words": [
    { "word": "Hello", "start": 0.0, "end": 0.4, "confidence": 0.98 },
    { "word": "world", "start": 0.5, "end": 0.9, "confidence": 0.97 }
  ],
  "language": "en",
  "duration": 45.2
}
```

### File System Layout

```
uploads/
  <job-id>/
    source.mp4          ← uploaded video
    transcript.json     ← faster-whisper output
    render-props.json   ← serialized render input
    output.mp4          ← final rendered video
```

Jobs are ephemeral for a single-user tool. No cleanup needed in v1; add a cleanup route later if disk fills.

---

## Patterns to Follow

### Pattern 1: Props-Driven Composition

**What:** All subtitle rendering logic lives in the Remotion composition and is driven entirely by props. No side effects inside the composition.

**When:** Always — this is what makes server-side render match the preview exactly.

**Why:** If the composition calls out to an API or reads from a database, the server renderer won't have access to the same context the browser does. Props must be fully serializable and self-contained.

```typescript
// Good: composition is a pure function of props
export const SubtitleComposition: React.FC<SubtitleProps> = ({
  videoSrc, transcript, mode, style
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;
  const activeWord = getActiveWord(transcript, currentTime);
  // ...
};

// Bad: fetching inside composition
export const SubtitleComposition = () => {
  const [transcript, setTranscript] = useState(null);
  useEffect(() => { fetch('/api/transcript').then(...) }, []); // breaks server render
};
```

### Pattern 2: Serve Video from Backend for Player

**What:** The Remotion Player in the browser needs to load the source video. Serve it as a static file from the backend, not as a data URL.

**When:** Building the upload → preview flow.

**Why:** Data URLs for large videos exhaust browser memory. Serving via HTTP range requests enables efficient seeking in the Player's video element.

```typescript
// Backend
app.use('/static/uploads', express.static(path.join(__dirname, '../uploads')));

// Frontend — pass URL, not file content
<Player
  component={SubtitleComposition}
  inputProps={{ videoSrc: `/static/uploads/${jobId}/source.mp4`, ... }}
/>
```

### Pattern 3: Transcript Segmentation as Frontend Concern

**What:** The raw word list from Whisper is segmented into subtitle phrases in the frontend, not in the transcription service.

**When:** Building the transcript editor.

**Why:** Segmentation is a user-facing editing operation — the user adjusts where phrase breaks occur. Keeping it in frontend state means edits don't require backend round-trips. The render payload includes the segmented (not raw) transcript.

### Pattern 4: SSE for Render Progress

**What:** Use Server-Sent Events to stream render progress from backend to frontend.

**When:** Implementing the render job.

**Why:** Remotion render can take minutes for long videos. SSE is simpler than WebSockets for one-way streaming and works with any HTTP framework. Polling is an acceptable fallback (poll every 2s) if SSE adds complexity.

```typescript
// Backend — Remotion renderer emits progress callbacks
await renderMedia({
  composition,
  outputLocation,
  onProgress: ({ progress }) => {
    // write to SSE stream
    res.write(`data: ${JSON.stringify({ progress })}\n\n`);
  }
});
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Side Effects Inside Remotion Composition

**What:** Fetching data, reading files, or calling APIs from within the composition's render function.

**Why bad:** The server-side renderer runs in headless Chromium with no access to the running backend. Any network calls from within the composition during server render will fail silently or hang.

**Instead:** Pass all data as props. Serialize the complete render props to a JSON file before invoking the renderer.

### Anti-Pattern 2: Running Remotion Dev Server as Production Server

**What:** Using `npx remotion studio` or Vite dev server as the primary server in production.

**Why bad:** Remotion Studio is a dev tool — not designed to serve video files or handle uploads. The application needs its own backend server with explicit routing.

**Instead:** Run Remotion composition as a separate Vite/React app built for embedding. The `<Player>` component is imported and embedded in the frontend app. The server-side render uses `@remotion/renderer` as a library, not the Studio UI.

### Anti-Pattern 3: Storing Job State in a Database for Single-User Local Use

**What:** Adding SQLite, Postgres, or any database to track job state.

**Why bad:** Over-engineering for a tool that runs one job at a time for one user. Adds setup friction and cross-platform complexity.

**Instead:** In-memory job state (a `Map` in Node.js) is sufficient. Jobs survive as files on disk even if the server restarts — re-scan the uploads directory on startup if recovery matters.

### Anti-Pattern 4: Python Environment Mixed With Node Environment

**What:** Running faster-whisper in the same process or via native Node bindings.

**Why bad:** Python/Node interop via bindings (napi, python-bridge) is fragile, difficult to debug, and often breaks across platforms. Python ML environments (conda/venv) conflict with Node module resolution.

**Instead:** Keep Python strictly isolated in its own virtualenv or conda env. Backend calls it as a subprocess with `child_process.spawn`. Communicate via stdin/stdout (JSON) or via files.

### Anti-Pattern 5: Processing Audio in the Browser

**What:** Running Whisper or any heavy transcription model client-side (WebAssembly).

**Why bad:** Whisper.cpp/WASM has much lower accuracy than the Python faster-whisper implementation, lacks GPU acceleration, and will lock up the browser tab for minutes.

**Instead:** All transcription happens on the backend Python service. The browser only displays results.

---

## Build Order Implications

The component dependency graph drives the recommended build order:

```
Phase 1: File System + Backend Scaffold
  → Establishes job-id-based folder structure
  → No other components can function without this

Phase 2: Upload Endpoint + Video Serving
  → Backend can accept video, return URL
  → Prerequisite for Player preview and transcription

Phase 3: Transcription Service (Python)
  → Can be developed/tested independently with a test video
  → Depends on Phase 1 (file paths), not on Phase 2

Phase 4: Remotion Composition + Player Preview
  → Composition component can be built with mock/fixture transcript
  → Depends on Phase 2 (video URL serving) for real preview

Phase 5: Transcript Editor (Frontend)
  → Connects Phase 3 output → Phase 4 input
  → Word list display, timing edit, segmentation controls

Phase 6: Server-Side Render + Download
  → Depends on Phase 4 (composition registered for render)
  → Depends on Phase 1 (output file path)

Phase 7: Style Controls + Polish
  → Font, color, mode, position controls
  → Pure frontend additions; can be layered on top of working pipeline
```

Critical path: File System → Upload → Composition → Editor → Render.
Transcription and composition can be developed in parallel after the file system is established.

---

## Scalability Considerations

This is a local single-user tool. Scalability is not a goal. However, some sizing context:

| Concern | At 1 user (target) | At 10 users (not a goal) |
|---------|-------------------|--------------------------|
| Concurrency | One job at a time; no queue needed | Would need job queue (Bull/BullMQ) |
| Transcription | GPU or Apple Silicon handles 5-30 min video in 1-5x realtime | Bottleneck; need worker pool |
| Render time | 5-30 min video = 2-15 min render on local hardware | Bottleneck; need distributed rendering |
| Disk | ~500MB/job (source + output); manual cleanup | Need retention policy |
| State | In-memory Map per server process | Need persistent DB |

The architecture explicitly avoids premature scaling infrastructure. Revisit only if the tool becomes multi-user.

---

## Sources

**Confidence notes:**
- Remotion composition architecture (props-driven, `useCurrentFrame`, `@remotion/renderer`, `@remotion/player`): HIGH — based on extensive training data from Remotion docs and codebase; confirm against current remotion.dev/docs before implementation
- faster-whisper subprocess pattern: HIGH — established pattern in the open-source ML tooling community
- SSE for render progress: MEDIUM — Remotion's `renderMedia` API supports `onProgress` callback; SSE pattern is standard; verify current API signature
- File system job layout: HIGH — standard pattern for local processing tools
- Build order dependencies: HIGH — derived from explicit component dependency graph

**Key docs to verify during implementation (could not fetch in this session):**
- `https://www.remotion.dev/docs/renderer/render-media` — current `renderMedia` API signature and `onProgress` callback
- `https://www.remotion.dev/docs/player` — current `<Player>` component props
- `https://github.com/SYSTRAN/faster-whisper` — current word-level timestamp output format
- `https://www.remotion.dev/docs/config` — composition registration for server-side render
