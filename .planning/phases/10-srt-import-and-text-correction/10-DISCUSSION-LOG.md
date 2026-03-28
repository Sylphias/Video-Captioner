# Phase 10: SRT Import and Text Correction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 10-srt-import-and-text-correction
**Areas discussed:** Import flow, Alignment strategy, Review & adjustment UX, Conflict handling

---

## Import Flow

| Option | Description | Selected |
|--------|-------------|----------|
| After transcription | User transcribes first with WhisperX, then imports SRT to replace text | ✓ |
| Alongside video upload | Drag SRT + video together on upload screen | |
| Both entry points | Available at upload and editor page | |

**User's choice:** After transcription
**Notes:** Guarantees word-level timing exists to align against.

| Option | Description | Selected |
|--------|-------------|----------|
| Top toolbar | Next to Render MP4, Global Styling buttons | |
| Re-transcribe area | Near bottom Re-transcribe button | |
| You decide | Claude picks placement | |

**User's choice:** Other — "I think it should be part of the text editing view. Maybe we can do a diff or side by side to compare"
**Notes:** User wants the import integrated into the text editing view with a comparison UI.

| Option | Description | Selected |
|--------|-------------|----------|
| File picker button | Simple button opening file dialog | ✓ |
| Drag and drop zone | Dedicated drop area in text editing view | |
| Both | File picker + drag-and-drop | |

**User's choice:** File picker button

---

## Alignment Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Timestamp matching | Match SRT cue timestamps to Whisper phrases by time overlap | ✓ |
| Text similarity matching | Fuzzy string matching (Levenshtein/diff) | |
| Hybrid: time + text | First pass timestamp, second pass text similarity | |

**User's choice:** Timestamp matching

| Option | Description | Selected |
|--------|-------------|----------|
| Proportional split | Distribute timing evenly across SRT words in matched range | ✓ |
| Best-effort word matching | Match identical words first, distribute remaining | |
| You decide | Claude picks approach | |

**User's choice:** Proportional split

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend only | Parse SRT and align in browser, no backend | ✓ |
| Backend Python script | New Python script like transcribe.py | |
| Backend TypeScript | New API endpoint in Node backend | |

**User's choice:** Frontend only

---

## Review & Adjustment UX

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side diff | Left: Whisper, Right: SRT, differences highlighted | ✓ |
| Inline diff | Single column with strikethrough/additions | |
| Preview-first | Show aligned result in video preview | |

**User's choice:** Side-by-side diff

| Option | Description | Selected |
|--------|-------------|----------|
| Per-phrase | Each phrase row has accept/reject buttons | ✓ |
| All-or-nothing | Single Accept All / Reject All | |
| Per-word | Individual word-level accept/reject | |

**User's choice:** Per-phrase

| Option | Description | Selected |
|--------|-------------|----------|
| Standard undo | Use existing undo/redo in store | ✓ |
| Bulk revert button | Dedicated revert-SRT-import button | |

**User's choice:** Standard undo

---

## Conflict Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve speakers | Keep speaker assignments, SRT only changes text | ✓ |
| Clear speakers | Remove speaker labels on SRT import | |
| You decide | Claude picks approach | |

**User's choice:** Preserve speakers

| Option | Description | Selected |
|--------|-------------|----------|
| Only align overlapping regions | Match what can be matched, ignore rest | ✓ |
| Warn and abort | Show warning if time ranges differ significantly | |
| You decide | Claude picks approach | |

**User's choice:** Only align overlapping regions

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, replaces previous | Each import starts fresh against original Whisper timestamps | ✓ |
| Yes, stacks on current | Subsequent imports diff against current text | |

**User's choice:** Yes, replaces previous

---

## Claude's Discretion

- SRT parsing library choice (or hand-rolled parser)
- Exact diff highlighting algorithm/colors
- Layout details of the side-by-side view

## Deferred Ideas

None
