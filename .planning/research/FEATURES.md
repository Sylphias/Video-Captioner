# Feature Landscape

**Domain:** Video subtitle generation with word-level highlighting
**Project:** Eigen Video Editor — Dynamic Subtitle Generator
**Researched:** 2026-02-25
**Confidence:** MEDIUM — Based on training knowledge of the ecosystem (Whisper, Remotion, Kapwing, Submagic, CapCut auto-captions, RunwayML, Descript, Adobe Premiere captions). WebSearch/WebFetch unavailable during this research session; claims based on well-established patterns in the domain.

---

## Table Stakes

Features users expect from a subtitle generation tool. Missing any of these makes the product feel unfinished or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Automatic transcription from video/audio | Core value prop — manual transcription is the pain point being solved | Low-Med | Whisper handles this; the UX around it (progress indication, error handling) adds complexity |
| Word-level timestamps | Required for any highlight-sync; industry standard since Whisper popularized it | Med | Whisper with `--word_timestamps` flag; faster-whisper also supports it; this is the technical foundation everything else depends on |
| Live preview before render | Users need to see styling before committing to a slow render pass | Med-High | Remotion's `<Player>` component in the browser handles this; requires keeping Remotion composition in sync with config state |
| Editable transcript | Transcription is never 100% accurate; users must be able to fix errors | Med | Text editor with inline timestamp display; editing must update word timings or at minimum flag words as manually edited |
| Final video render with burned-in subtitles | The deliverable — must produce a downloadable video file | Med | Remotion server-side rendering (`renderMedia`); ffmpeg is the underlying engine |
| Subtitle positioning control | Position affects readability depending on subject framing | Low | Top/middle/bottom presets suffice for v1; pixel-drag is differentiating |
| Font customization (family, size, color) | Users have brand/aesthetic preferences; plain white text is insufficient | Low | CSS-driven in Remotion; a small preset list is enough |
| Highlight color selection | The highlight color is the visual centerpiece of word-highlight subtitles | Low | Simple color picker |
| Word grouping into phrases | Individual words flashing one at a time is too rapid; groups of 3-8 words is the norm | Med | Auto-grouping by silence gaps; the threshold tuning is non-trivial |
| Progress feedback during transcription | Transcription of 30-min video can take minutes; users need feedback | Low | Backend streaming or polling endpoint; essential for perceived performance |
| Download rendered video | The actual output delivery | Low | Standard file download; format should default to MP4/H.264 |

---

## Differentiators

Features that set this tool apart from the standard "auto-caption" experience. Not universally expected, but high value when present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Progressive-reveal mode (words appear as spoken) | Distinct visual style popular in educational/explainer content; most tools only do karaoke | Med | Requires rendering logic where words have opacity/transform animations keyed to their timestamp; Remotion's `useCurrentFrame` + `interpolate` make this clean |
| Karaoke mode (all words visible, current highlighted) | Popular for music-style content; users choose mode per video | Med | Simpler render logic than progressive-reveal; highlight color transitions on current word |
| Manual word grouping override | Auto-grouping is imperfect; power users want exact control over phrase breaks | High | Drag-to-split or click-to-break UI on top of the transcript; this is where most of the frontend complexity lives |
| Silence-based auto word grouping | Smarter than naive fixed-window grouping; produces more natural phrases | Med | Requires silence detection from the audio waveform or leveraging Whisper's word-gap timing data (gaps between word end and next word start) |
| Text stroke / outline customization | Improves legibility on busy video backgrounds; not all tools expose this | Low | CSS `text-shadow` or SVG stroke in Remotion; minor UI surface area |
| Both karaoke AND progressive-reveal in same tool | Users typically have to choose a specialized tool for each; having both in one workflow is rare | Low (given both are already planned) | The per-video mode selection UX is trivial if both renderers exist |
| Self-hosted / offline operation | Privacy-sensitive content; no API key management; no usage costs | High (infra) | Already the architecture; the differentiator is real but the complexity is in deployment and cross-platform compatibility |
| GPU-accelerated transcription on local hardware | Faster than CPU Whisper; avoids cloud latency | Med | faster-whisper with CTranslate2 handles CUDA (Windows) and MPS/CPU (M4 Mac); requires per-platform setup |
| Live Remotion preview (not scrubbed screenshot) | True video playback preview rather than a static frame capture | Med-High | Remotion `<Player>` in browser; requires frontend to send current config to the Remotion composition in real time |
| Inline timestamp editor | Edit text AND adjust word timing in the same UI surface | High | Very few tools expose timing adjustment; requires a custom editor component with time inputs per word |

---

## Anti-Features

Features to deliberately NOT build in v1. Each has a stated reason and a better alternative.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| SRT/VTT/ASS subtitle file export | Adds a separate consumer workflow (NLE import) that competes with the render path; scope creep | Render burned-in video; add subtitle export only if explicitly requested after v1 ships |
| Multi-user / auth / accounts | Zero users beyond the single owner; auth adds weeks of complexity for no value | Single-user local tool; no auth at all |
| Cloud deployment / hosting | Cost, complexity, privacy tradeoffs; runs fine on local hardware | Run locally only |
| Mobile / responsive UI | Video editing requires desktop screen real estate; mobile subtitle editing is a different UX problem | Desktop browser only |
| Real-time / live transcription | Requires streaming ASR architecture; accuracy is worse; not needed for recorded video | Batch transcription after upload; optimize for accuracy over latency |
| Multi-language auto-detection | Adds model complexity and testing surface; single-language use case is well-served by Whisper defaults | Let Whisper auto-detect language (it already does this); don't build explicit language UI |
| Speaker diarization | Who said what is irrelevant when burned-in subtitles always show current speaker's words | Skip unless future "interview mode" is added |
| Subtitle translation | Machine translation quality is inconsistent; adds a second AI system with its own error modes | Out of scope; translators can edit the transcript manually if needed |
| Video editing (trim, cut, splice) | Completely different tool category; subtitle tool users are not expecting NLE features | Subtitle generation only; keep the scope narrow |
| Custom animation presets beyond karaoke/progressive | Fancy pop-in effects, emoji reactions, etc. are a distraction from accuracy and workflow | Two well-executed modes beat five half-baked ones |
| Waveform scrubber for timing edits | Useful but massive implementation effort; overkill for a single-user tool | Numeric timestamp inputs in the transcript editor are sufficient |
| Batch processing multiple videos | Adds queue management, job persistence, UI complexity | Single video workflow; user re-uploads for each video |

---

## Feature Dependencies

```
Whisper transcription (word-level timestamps)
  └── Transcript editor (depends on word data model)
        └── Word grouping — auto silence-based (depends on word timing gaps)
              └── Word grouping — manual override (depends on auto groups as starting state)
                    ├── Karaoke renderer (depends on grouped word data)
                    │     └── Live preview (depends on renderer + Remotion Player)
                    │           └── Final render / download (depends on renderer)
                    └── Progressive-reveal renderer (depends on grouped word data)
                          └── Live preview (depends on renderer + Remotion Player)
                                └── Final render / download (depends on renderer)

Style config (font, color, stroke, position)
  ├── Karaoke renderer (consumed by renderer)
  ├── Progressive-reveal renderer (consumed by renderer)
  └── Live preview (must reflect style changes in real time)
```

**Critical path:** Transcription → word data model → grouping → one renderer → live preview → render output. Everything else is parallelizable or addable later.

---

## MVP Recommendation

The smallest working product that delivers genuine value:

**Prioritize (v1 must-haves):**
1. Upload video → Whisper transcription with word-level timestamps
2. Editable transcript (text corrections; timing is read-only in v1)
3. Auto word grouping by silence gaps (manual override is v1.5)
4. Karaoke-style renderer (simpler than progressive-reveal; ship it first)
5. Basic style config: font size, highlight color, position (top/bottom)
6. Live Remotion preview
7. Final render + MP4 download

**Defer (v1.5 or later):**
- Progressive-reveal mode (second renderer; add after karaoke is solid)
- Manual word grouping override (complex UI; auto-grouping covers 80% of cases)
- Inline timestamp editing (low user demand; text corrections suffice)
- Text stroke customization (nice to have; add to style panel later)
- Drag-to-position subtitle placement (preset top/middle/bottom is sufficient for v1)
- Font family selection (single well-chosen default is fine for v1)

**Why this order:**
- Karaoke before progressive-reveal because it has simpler render logic (no opacity animation); lets you validate the Remotion composition architecture before adding animation complexity.
- Auto-grouping before manual-override because the override UI is complex and depends on having auto-grouping working as the baseline state.
- Text editing before timestamp editing because transcript accuracy (word text) is the primary pain point; users rarely need millisecond precision in timing.

---

## Sources

- Training knowledge of Whisper (OpenAI, faster-whisper), Remotion, Kapwing, Submagic, CapCut auto-captions, Descript, RunwayML, Adobe Premiere auto-captions — confidence MEDIUM (well-established ecosystem patterns, but not verified against current docs in this session)
- Project context from `.planning/PROJECT.md` — HIGH confidence (authoritative source for project requirements)
- WebSearch and WebFetch were unavailable during this research session. Findings reflect domain knowledge current to August 2025 training cutoff. The video subtitle tool ecosystem moves fast; verify competitor feature sets against current tools before roadmap finalization.
