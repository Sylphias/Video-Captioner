# Phase 10: SRT Import and Text Correction - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can import an SRT file (e.g. from DaVinci Resolve) and align it with WhisperX word-level timestamps to get accurate text with precise per-word timing. The SRT provides corrected text; Whisper provides word-level timing. This phase adds the import flow, alignment logic, and a review UI for accepting/rejecting changes.

</domain>

<decisions>
## Implementation Decisions

### Import Flow
- **D-01:** SRT import happens AFTER transcription — user must have a Whisper transcript with word timestamps first
- **D-02:** Import button lives in the text editing view (not the top toolbar)
- **D-03:** File picker button (standard file dialog) — no drag-and-drop

### Alignment Strategy
- **D-04:** Timestamp matching — match SRT cue timestamps to Whisper phrases by time overlap, then word-align within each matched segment
- **D-05:** Proportional time split — when SRT has more/fewer words than Whisper for a segment, distribute timing evenly across SRT words within the matched time range
- **D-06:** Frontend-only — SRT parsing and alignment run entirely in the browser. No backend/Python dependency needed.

### Review & Adjustment UX
- **D-07:** Side-by-side diff view — Left: Whisper text, Right: SRT text, differences highlighted inline
- **D-08:** Per-phrase accept/reject — each phrase row has buttons to cherry-pick which SRT corrections to apply
- **D-09:** Standard undo — uses existing undo/redo system in the store, each accepted phrase is an undo step

### Conflict Handling
- **D-10:** Preserve speaker labels — SRT only changes text, speaker assignments from diarization are kept
- **D-11:** Only align overlapping time regions — Whisper-only regions keep original text, SRT-only regions are ignored
- **D-12:** Re-import replaces previous — each SRT import starts fresh against original Whisper timestamps

### Claude's Discretion
- SRT parsing library choice (or hand-rolled parser)
- Exact diff highlighting algorithm/colors
- Layout details of the side-by-side view within the text editing area

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above.

### Existing Code
- `packages/shared-types/src/index.ts` — TranscriptWord and Transcript interfaces (target schema for aligned output)
- `packages/frontend/src/lib/grouping.ts` — Word-to-phrase grouping logic (alignment output feeds into this)
- `packages/frontend/src/components/TextEditor/TextEditor.tsx` — Existing text editing view (SRT import button + diff view integrate here)
- `packages/frontend/src/store/subtitleStore.ts` — Session state, undo system, word/phrase mutation actions
- `packages/frontend/src/hooks/useTranscribe.ts` — Pattern for async processing hooks
- `packages/frontend/src/components/UploadZone.tsx` — Existing upload pattern (reference, not reused)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `subtitleStore` undo/redo system: Already supports snapshotting state before mutations — SRT accept/reject can use the same mechanism
- `grouping.ts` `buildSessionPhrases()`: After alignment, the modified words feed through existing phrase grouping
- `TextEditor.tsx`: Current phrase-based text editing view is the integration point for the diff UI

### Established Patterns
- Zustand store with `setStyle`/`updateWord`/`updatePhraseText` pattern — new SRT actions follow the same shape
- Hooks pattern (`useTranscribe`, `useDiarize`) — `useSrtImport` would follow same convention
- Session words (`SessionWord[]`) are the editable copy — SRT alignment modifies these, not the original transcript

### Integration Points
- Text Edit View tab in SubtitlesPage — SRT import button and diff view render here
- `subtitleStore.session.words` — SRT alignment produces replacement words that get set here
- `buildSessionPhrases()` — Re-runs after word replacement to regroup phrases

</code_context>

<specifics>
## Specific Ideas

- User wants to see Whisper vs SRT text side-by-side to compare before accepting — not blind replacement
- The diff view should make it easy to spot where SRT corrected Whisper mistakes (e.g., proper nouns, technical terms)
- DaVinci Resolve is a primary SRT source — standard SRT format expected

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-srt-import-and-text-correction*
*Context gathered: 2026-03-28*
