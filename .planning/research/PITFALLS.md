# Domain Pitfalls

**Domain:** Web-based video subtitle generator (Remotion + Whisper + word-level karaoke/progressive-reveal)
**Researched:** 2026-02-25
**Confidence:** MEDIUM — primary sources (WebFetch/WebSearch) were unavailable. Findings drawn from training data on Remotion docs, Whisper ecosystem, and video pipeline engineering through August 2025. All claims should be verified against official Remotion and Whisper docs before implementation.

---

## Critical Pitfalls

Mistakes that cause rewrites or significant rework.

---

### Pitfall 1: Whisper Word Timestamps Are Off-by-One and Drift on Long Audio

**What goes wrong:** Whisper's `--word_timestamps` flag (and equivalents in faster-whisper, whisper.cpp) produces per-word start/end times that are interpolated within a segment, not directly measured. On long audio (10+ minutes), accumulated drift causes word timestamps to diverge from actual audio by 0.2–0.8 seconds. The karaoke highlight fires visibly late or early.

**Why it happens:** Whisper was designed for transcription accuracy, not timestamp precision. Word-level timing is derived by force-aligning the segment-level transcript against the audio using a CTC head — it's a post-processing estimate, not a direct detection. Segment boundaries are more reliable than word boundaries. Silence padding between segments introduces additional drift.

**Consequences:** The highlight animation never feels right. Users manually editing timing discover that many words need adjustment. The editing UI becomes load-bearing instead of a polish step.

**Prevention:**
- Use faster-whisper with WhisperX for word-level alignment. WhisperX applies phoneme-level forced alignment (via wav2vec2) on top of Whisper segments, giving word timestamps accurate to ~30ms rather than interpolated.
- Alternatively: run whisper.cpp with `--max-len 1` (character-level chunking) to get finer segment boundaries, then post-process.
- Design the transcript editing UI as a first-class feature, not a fallback. Even with WhisperX, some words need manual correction — especially for music, accents, or fast speech.
- Store timestamps with millisecond precision in the data model from day one. Rounding to seconds or tenths at the storage layer makes editing impossible.

**Detection (warning signs):**
- Test with a known-timing video (clap at second 5, second 30, second 120). Check how far off the highlight is at each clap.
- If drift exceeds 150ms on a 5-minute video, the alignment pipeline needs improvement before building the editing UI.

**Phase:** Address in the transcription pipeline phase (before building any UI). WhisperX vs whisper.cpp vs faster-whisper choice must be validated on both target platforms (Intel/Windows GPU and M4 Mac/Apple Silicon) before the editing layer is built.

---

### Pitfall 2: Remotion's `useCurrentFrame()` Mental Model Breaks Video Sync

**What goes wrong:** Remotion renders video frame-by-frame in a headless Chromium browser. Each frame is a static React render at a specific frame number. This means: no `setTimeout`, no `setInterval`, no `Date.now()`, no `requestAnimationFrame`, no actual audio playback during rendering. Developers who build their subtitle animation using time-based logic (e.g., checking `Date.now() >= word.startTime`) get correct behavior in preview but broken output in rendered video.

**Why it happens:** The live preview uses a fake clock driven by `useCurrentFrame()` / `useVideoConfig()`. But if any component uses real clock APIs for logic, those APIs return the actual wall-clock time during rendering — which is not the video time. The rendered frame for second 10 of a 30fps video is rendered at whatever wall-clock time Chromium gets to it, which could be seconds later.

**Consequences:** Subtitle highlights appear at wrong times in the rendered output. Sometimes they appear correct in preview but broken in render, creating a hard-to-diagnose bug. This is a rewrite-level mistake if the entire animation system is built on real time.

**Prevention:**
- All timing logic must flow through `useCurrentFrame()` and `fps` from `useVideoConfig()`. Convert frame numbers to seconds: `const currentTime = frame / fps`.
- Compute which word is active using `currentTime >= word.start && currentTime < word.end`.
- Never use `Date.now()`, `performance.now()`, `setTimeout`, or `setInterval` inside Remotion components. Use `spring()`, `interpolate()`, and `useCurrentFrame()` exclusively.
- Use Remotion's `<Audio>` and `<Video>` components rather than native HTML elements — these are frame-aware.
- Add a lint rule or comment in the component file as a reminder: "NO real-time APIs inside Remotion components."

**Detection:**
- After building the subtitle component, render a 10-second test video and compare rendered timestamps against preview timestamps at frames 30, 150, and 300. Any discrepancy = real-time API leak.

**Phase:** Critical to get right in the very first Remotion composition spike. Fixing it later means rewriting the entire animation layer.

---

### Pitfall 3: Audio/Video Desync in the Final Render

**What goes wrong:** The final rendered video has subtitles that are correctly timed to the transcript but the audio is audibly out of sync with the video frames. This is most common when the input video has a Variable Frame Rate (VFR) — common in screen recordings, phone videos, and any video from a modern smartphone.

**Why it happens:** Remotion's renderer assumes a Constant Frame Rate (CFR). When it ingests a VFR video, the frame count doesn't match the audio duration. The rendered output has the correct number of frames but the audio plays at a different rate than the video, causing progressive desync. On a 10-minute VFR video, desync can reach 2–3 seconds by the end.

**Consequences:** The final video looks broken even though the subtitle timing in Remotion was correct. Users re-render multiple times, suspecting the subtitle data, before discovering the input format is the cause.

**Prevention:**
- Pre-process all uploaded videos through FFmpeg before handing them to Remotion: `ffmpeg -i input.mp4 -vf fps=30 -vsync cfr output.mp4`. This converts VFR to CFR at a fixed fps.
- Enforce this in the upload pipeline. Do not let raw user uploads reach Remotion directly.
- Store the normalized video and use it as the source for both preview and final render.
- Expose the detected fps in the UI so the user knows what frame rate was used.

**Detection:**
- Run `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate,avg_frame_rate -of default=noprint_wrappers=1 <input>` on uploaded videos. If `r_frame_rate != avg_frame_rate`, the video is VFR. Build this check into the upload handler.

**Phase:** Upload/ingestion pipeline (very early). Skipping this in Phase 1 requires going back to re-normalize all previously uploaded videos.

---

### Pitfall 4: Browser Preview Performance Collapse on Long Videos

**What goes wrong:** Remotion's `<Player>` component in the browser renders every frame as a React component. For short videos (under 2 minutes, 30fps), this is fine. For mid-length videos (5–30 minutes at 30fps = 9,000–54,000 frames), seeking in the timeline becomes sluggish and the scrubber feels broken. On slower machines (M4 Mac Mini is fine, but less capable machines struggle), this can render the preview unusable.

**Why it happens:** Remotion's Player doesn't pre-decode frames — it renders the React component tree on every frame change. For subtitle-heavy compositions with many interpolation calculations per frame, this is CPU-intensive. Large subtitle datasets (word arrays with thousands of entries) cause slow lookups if implemented naively as linear scans.

**Consequences:** The preview feels unusable for long-form content. Users can't scrub quickly, making transcript editing frustrating.

**Prevention:**
- Pre-process the word array into an indexed structure (e.g., sorted by start time, with a binary search lookup for "which word is active at time T?"). A linear scan through thousands of words per frame will cause frame drops.
- For the `<Player>` component, implement lazy seeking: debounce the timeline scrubber so rapid seeking doesn't fire a re-render on every pixel of drag.
- Set a reasonable `playbackRate` limit on the Player (don't allow 4x playback of long videos in preview).
- For videos over 10 minutes, consider rendering a low-resolution preview proxy (e.g., 480p, 15fps) and using that for interactive preview. Only use full-resolution for final render.

**Detection:**
- Benchmark with a 20-minute video and 800+ words. Measure frame render time in browser DevTools. If average frame render exceeds 16ms, the active-word lookup is the bottleneck.

**Phase:** Architecture decision for the data model (how words are stored/indexed) must be made before the Remotion composition is built. Proxy preview strategy should be decided before the UI phase.

---

### Pitfall 5: Whisper Model Choice vs. Platform Compatibility Mismatch

**What goes wrong:** The project targets two platforms: Intel desktop (Windows, GPU) and M4 Mac Mini (Apple Silicon, macOS). Whisper model variants have different compatibility matrices. A model that runs efficiently on an NVIDIA GPU via CUDA will not run efficiently — or at all — on Apple Silicon via the same code path. Projects that pick one implementation without validating both platforms discover the mismatch in production.

**Why it happens:** faster-whisper uses CTranslate2 which has CUDA support for NVIDIA but requires separate CoreML or Metal backends for Apple Silicon. whisper.cpp has Metal support for Apple Silicon but requires different build flags for CUDA on Windows. The Python `openai-whisper` package runs on CPU on Apple Silicon (no Metal acceleration without extra work). These are different binaries with different installation paths.

**Consequences:** One of the two target machines ends up with 10x slower transcription, making the tool unusable on that platform. The user discovers this after building the API layer around one implementation.

**Prevention:**
- Validate BOTH platforms before committing to any transcription backend. Specifically: run a 10-minute test video on Intel/Windows and on M4/macOS and measure real-world transcription time.
- Recommended path (as of August 2025): faster-whisper + WhisperX for accuracy, with CTranslate2's CUDA backend on Windows and its CPU/CoreML path on macOS. OR: whisper.cpp as a cross-platform binary that supports Metal on macOS and CUDA/CPU on Windows.
- Abstract the transcription backend behind an interface so the backend can be swapped without changing the API layer.
- Document the install/build steps for each platform explicitly in the project — they are different enough to cause frustration.

**Detection:**
- Run the same audio file on both platforms. Record: model load time, transcription time per minute of audio, memory usage. If either platform exceeds 5x the other's time, the backend needs platform-specific optimization.

**Phase:** Must be resolved in the transcription research/spike phase, before any API layer is built around it. Flag as a "needs phase-specific research" item.

---

### Pitfall 6: Remotion Server-Side Render Requires Node.js Environment — Not a Web Server

**What goes wrong:** Remotion's server-side rendering (`renderMedia()` / `renderFrames()`) must run inside a Node.js process with Puppeteer/Chromium available. Developers who architect the backend as a lightweight HTTP API server (Express, Fastify) and try to invoke `renderMedia()` as a route handler discover that the render process blocks the event loop for minutes, making the server unresponsive during rendering. Long videos (30 minutes) can take 15–60 minutes to render.

**Why it happens:** `renderMedia()` is CPU- and memory-intensive. It spawns a Chromium instance, renders frames at the target resolution, and encodes them with FFmpeg. This is not compatible with a synchronous request/response model. Blocking Node.js's event loop during this operation drops all other requests.

**Consequences:** The API server becomes completely unresponsive during rendering. If the client disconnects (browser tab closed), the render continues in the background with no way to cancel it. Multiple renders queue up unboundedly.

**Prevention:**
- Run the render in a separate worker process (Node.js `worker_threads` or a child process). The HTTP handler enqueues the render job and returns a job ID immediately. The client polls for status.
- Implement a simple render queue with one concurrent render at a time (this is a single-user tool — no need for complex queue infrastructure).
- Use Remotion's `onProgress` callback to stream render progress to the client via Server-Sent Events or WebSocket, so the user sees a progress bar.
- Expose a cancel endpoint that kills the render worker process.
- Store render artifacts (in-progress and completed) in a known directory; clean up old renders automatically.

**Detection:**
- Try rendering a 5-minute video while simultaneously making other API requests. If those requests hang, the render is blocking the event loop.

**Phase:** The render worker architecture must be designed in the backend phase, before the first render endpoint is built. Retrofitting worker isolation onto a blocking implementation requires rewriting the render layer.

---

## Moderate Pitfalls

---

### Pitfall 7: Word Grouping Logic Is Harder Than It Looks

**What goes wrong:** Auto-grouping words into subtitle segments (phrases) based on silence detection sounds simple but produces ugly results. Common failures: groups that are too long (reader can't keep up), groups that break in the middle of a clause ("I was going to / the store"), and groups that don't align with natural speech rhythm. The segment break logic becomes a tuning exercise with no single right answer.

**Prevention:**
- Use a multi-factor grouping heuristic, not just silence detection: (1) minimum silence duration threshold (e.g., 300ms), (2) maximum words per group (e.g., 8–10), (3) maximum group duration (e.g., 4 seconds), (4) respect sentence punctuation from the transcript.
- Make all four thresholds user-adjustable in the UI rather than hardcoding them.
- Expose a "manual break" UI: let the user click between any two words to force a segment break, and click a break to remove it. This is the escape hatch for every edge case.
- Don't try to solve the grouping problem perfectly in code — the manual override UI is the real feature.

**Phase:** Feature design phase. The data model for "segment breaks" must be flexible enough to encode both auto-detected and manually-added breaks.

---

### Pitfall 8: Subtitle Positioning and Safe Zones

**What goes wrong:** Subtitles placed at the "bottom" of a 9:16 vertical video (common for short-form content) are frequently occluded by platform UI (YouTube Shorts progress bar, TikTok controls). Subtitles placed at the "top" of a 16:9 landscape video conflict with title cards and logos. Projects that hard-code "bottom-center" positioning get complaints from users when the video is uploaded to a specific platform.

**Prevention:**
- Implement subtitle positioning as a configurable Y-offset (percentage of video height) rather than a fixed pixel value or a three-position enum (top/middle/bottom).
- Provide presets for common platforms' safe zones (e.g., "YouTube Shorts safe zone: 20%–70% of height").
- For the v1, expose a vertical position slider (0–100% of frame height) that the user can adjust visually in the preview. This is simple to implement and covers all cases.

**Phase:** UI/styling phase. Easy to get right if designed up front; annoying to retrofit if the position was hardcoded during the prototype.

---

### Pitfall 9: Font Rendering Differences Between Preview and Rendered Output

**What goes wrong:** The live browser preview renders text using the browser's font stack. The server-side render uses fonts available in the Chromium instance Remotion spawns. If the font is a system font (e.g., "SF Pro" on macOS, "Segoe UI" on Windows), it may not be available inside Remotion's Chromium. The rendered video has a fallback font that looks different from the preview.

**Prevention:**
- Use only web fonts (Google Fonts via Remotion's font loading utilities, or self-hosted font files bundled with the Remotion project).
- Remotion provides `@remotion/google-fonts` for loading fonts in a render-safe way. Use this instead of `<link>` tags.
- Test the render output visually against the preview for every new font before exposing it to the user as an option.
- Do not allow users to pick system fonts. Provide a curated list of tested web fonts.

**Phase:** Early subtitle styling phase. Test this during the first composition prototype with actual rendering.

---

### Pitfall 10: Transcript Edit State Management Gets Complicated Fast

**What goes wrong:** The transcript has several interdependent pieces of state: raw Whisper output, user-corrected text, user-adjusted timestamps, segment grouping (auto + manual overrides), styling preferences, and subtitle mode (karaoke vs. progressive-reveal). Projects that store all of this in one flat object find that editing one field has unexpected side effects on others. "Undo" becomes impossible.

**Prevention:**
- Separate immutable source data (original Whisper output) from mutable derived data (user corrections, grouping, styling). Store them as separate objects in the session/project state.
- Model the editing session as a series of patches/operations on top of the original transcript, not as in-place mutation of the raw data. This enables "reset to original" and per-field undo.
- Use a simple state machine or explicit "dirty" tracking to know what has changed and needs to be persisted.
- Persist state to the backend incrementally (auto-save) rather than requiring a manual save action — lost work on a 30-minute video is a terrible UX.

**Phase:** Data model design phase (very early). Retrofitting a clean state model after the UI is built requires a painful migration.

---

### Pitfall 11: FFmpeg Version and Codec Compatibility

**What goes wrong:** Remotion uses FFmpeg internally for encoding. The version of FFmpeg bundled by Remotion may not support all input codecs (e.g., HEVC/H.265, AV1, older codec variants). Upload a video encoded with HEVC and Remotion's render fails with a cryptic FFmpeg error. Additionally, Remotion may ship its own FFmpeg binary that conflicts with a system-installed FFmpeg, causing version confusion.

**Prevention:**
- Pre-process uploaded videos to H.264 + AAC (MP4) using FFmpeg during upload, before Remotion ever sees them. This normalizes both the codec and the container.
- Use the same FFmpeg binary for both the normalization step and Remotion (or at minimum, know which version each is using).
- Test with a variety of input formats: iPhone .mov (HEVC), Android .mp4 (H.264), screen recording .mkv (various), before considering input ingestion complete.

**Phase:** Upload/ingestion pipeline. Pairs with the VFR normalization (Pitfall 3) — these should be done in the same FFmpeg pre-processing step.

---

## Minor Pitfalls

---

### Pitfall 12: Large File Uploads Without Streaming

**What goes wrong:** A 30-minute video can be 500MB–2GB. An HTTP multipart upload that buffers the entire file in memory before writing to disk will OOM the backend server, or at minimum create a terrible user experience with no progress feedback.

**Prevention:**
- Use streaming multipart upload (e.g., `busboy` in Node.js) to write the file to disk incrementally.
- Show upload progress in the UI (the browser's `fetch` with `ReadableStream` or XMLHttpRequest `onprogress` event provides this).
- Set a reasonable max file size limit and reject gracefully with a clear error message.

**Phase:** Upload pipeline, Phase 1.

---

### Pitfall 13: Remotion Composition Duration Must Be Known Upfront

**What goes wrong:** Remotion requires the composition's `durationInFrames` to be set when the composition is defined. If the video duration isn't known at composition-definition time (e.g., because it's dynamically fetched), the composition renders with the wrong duration (too short = subtitle cutoff, too long = extra empty frames at the end).

**Prevention:**
- Probe the video duration server-side (via FFprobe) during upload and store it. Pass it as an `inputProp` to the Remotion composition so `durationInFrames` is set correctly at composition init time.
- Do not try to derive duration from the browser's `<video>` element `onloadedmetadata` event — there's a timing race between the metadata loading and Remotion's composition initialization.

**Phase:** Remotion composition setup, very early.

---

### Pitfall 14: Development vs. Render Environment Differences (Windows Paths)

**What goes wrong:** The project runs on both Windows (Intel desktop) and macOS (M4 Mac Mini). Path separators differ (`\` vs `/`). If any code builds file paths with string concatenation using hardcoded `/`, those paths break on Windows. This is especially common in FFmpeg command construction and in the Remotion `<staticFile>` loading path.

**Prevention:**
- Use Node.js `path.join()` for all file path construction, never string concatenation with `/` or `\`.
- Test the full pipeline on Windows explicitly. Don't assume macOS-passing tests mean Windows works.
- Use forward-slash paths in Remotion's `staticFile()` and `<Img>` — Remotion normalizes these internally, but double-check on Windows.

**Phase:** Backend foundation phase. Establish `path.join()` discipline from the first line of code.

---

### Pitfall 15: Whisper Hallucination on Silence and Music

**What goes wrong:** Whisper is known to hallucinate text (invent words that were not spoken) on silent sections, music, background noise, and applause. For a video with a 10-second music intro, Whisper may produce a paragraph of invented text. These hallucinations appear as subtitle segments with plausible-sounding but wrong words.

**Prevention:**
- Use Voice Activity Detection (VAD) to pre-filter audio before passing to Whisper. faster-whisper and WhisperX both support Silero VAD integration. Enable it.
- Review the transcript for unexpectedly dense text in sections where the speaker is not talking (intro/outro, music sections, pauses).
- The transcript editing UI should make it easy to delete spurious segments (hallucinations), not just correct words.

**Phase:** Transcription pipeline. VAD should be enabled by default, not added later.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Transcription backend selection | Platform incompatibility (Pitfall 5) — implementation that works on Mac fails on Windows or vice versa | Validate on BOTH platforms before committing to any backend |
| Whisper word timestamps | Drift and interpolation inaccuracy (Pitfall 1) — highlights fire late | Use WhisperX or whisper.cpp with VAD; treat transcript editing as first-class feature |
| Remotion composition setup | Real-time API usage (Pitfall 2) — previews correct, renders wrong | Enforce frame-based timing from day one; no `Date.now()` in components |
| Upload/ingestion pipeline | VFR desync (Pitfall 3) + codec failures (Pitfall 11) | Always normalize to CFR H.264 with FFmpeg before any further processing |
| Remotion composition setup | Composition duration (Pitfall 13) — clips cut off or extra blank frames | Probe duration with FFprobe during upload; pass as inputProp |
| Backend API architecture | Blocking render (Pitfall 6) — server freezes during render | Design worker/queue architecture before the first render endpoint |
| Data model design | Transcript state complexity (Pitfall 10) — edits corrupt each other | Separate immutable source from mutable derived state early |
| Subtitle styling | Font rendering mismatch (Pitfall 9) | Use only web fonts via Remotion's font utilities |
| Long-video preview | Preview performance collapse (Pitfall 4) | Binary search word lookup; consider proxy preview for 10+ minute videos |
| Cross-platform backend | Windows path separators (Pitfall 14) | Use `path.join()` everywhere from the start |

---

## Sources

**Confidence note:** WebSearch and WebFetch were unavailable during this research session. All findings are drawn from training data through August 2025 covering:
- Remotion documentation (remotion.dev), GitHub issues, and community Discord discussions
- Whisper and faster-whisper GitHub issues and documentation
- WhisperX paper and implementation notes
- General FFmpeg and web video pipeline engineering knowledge

**Verification recommended before implementation:**
- Remotion: https://www.remotion.dev/docs/troubleshooting (confirm current frame-timing guidance)
- Remotion fonts: https://www.remotion.dev/docs/fonts (confirm `@remotion/google-fonts` API is current)
- faster-whisper: https://github.com/SYSTRAN/faster-whisper (confirm Apple Silicon/CoreML support status)
- WhisperX: https://github.com/m-bain/whisperX (confirm cross-platform status and word alignment accuracy)
- Remotion renderMedia: https://www.remotion.dev/docs/renderer/render-media (confirm worker/process isolation approach)

**Confidence by pitfall:**
| Pitfall | Confidence | Notes |
|---------|------------|-------|
| 1 (Whisper timestamp drift) | MEDIUM | Well-documented in WhisperX paper; verify current accuracy numbers |
| 2 (Remotion frame timing) | HIGH | Core Remotion design constraint, explicitly documented |
| 3 (VFR desync) | HIGH | Fundamental video format issue, well-established |
| 4 (Preview performance) | MEDIUM | Inferred from React rendering model; verify with actual Remotion Player benchmarks |
| 5 (Platform compatibility) | MEDIUM | Verify current faster-whisper/whisper.cpp platform support matrix |
| 6 (Render blocking) | HIGH | Node.js event loop constraint, fundamental |
| 7 (Word grouping) | HIGH | UI/UX pattern, not technology-specific |
| 8 (Safe zones) | HIGH | Platform-specific UI constraint, well-established |
| 9 (Font rendering) | MEDIUM | Verify current Remotion font loading approach |
| 10 (State complexity) | HIGH | General state management principle |
| 11 (FFmpeg codec) | HIGH | FFmpeg codec support is well-established |
| 12 (File upload streaming) | HIGH | Node.js streaming is well-established |
| 13 (Composition duration) | HIGH | Core Remotion API constraint |
| 14 (Windows paths) | HIGH | Node.js cross-platform pattern |
| 15 (Whisper hallucination) | HIGH | Well-documented Whisper behavior |
