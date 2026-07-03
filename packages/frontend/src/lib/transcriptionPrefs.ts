/**
 * Transcription-time preferences, persisted in localStorage so they survive
 * across sessions and are available to BOTH entry points that build phrases
 * from a fresh WhisperX transcript:
 *   1. the initial upload flow (ProjectsPage upload → auto-transcribe → setJob)
 *   2. re-transcribe (editor toolbar / project context menu → setJob)
 *
 * These preferences only affect how NEW transcriptions are grouped into
 * phrases. Saved projects load their phrases directly from the project blob
 * (loadProjectBlob never regroups), so existing projects are never re-split.
 */

const MAX_CHARS_KEY = 'eigen:max-chars-per-line'
const MAX_WORDS_KEY = 'eigen:max-words-per-line'

/** Matches the subtitleStore maxWordsPerPhrase default. */
export const DEFAULT_MAX_WORDS_PER_LINE = 5

export function loadMaxWordsPerLine(): number {
  try {
    const raw = localStorage.getItem(MAX_WORDS_KEY)
    if (raw === null) return DEFAULT_MAX_WORDS_PER_LINE
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_WORDS_PER_LINE
  } catch {
    return DEFAULT_MAX_WORDS_PER_LINE
  }
}

export function saveMaxWordsPerLine(value: number): void {
  try {
    if (!Number.isFinite(value) || value <= 0) return
    localStorage.setItem(MAX_WORDS_KEY, String(Math.round(value)))
  } catch {
    // localStorage unavailable (private mode etc.) — preference just won't persist
  }
}

/** null = no cap (matches historical behavior). */
export function loadMaxCharsPerLine(): number | null {
  try {
    const raw = localStorage.getItem(MAX_CHARS_KEY)
    if (raw === null) return null
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

export function saveMaxCharsPerLine(value: number | null): void {
  try {
    if (value === null || !Number.isFinite(value) || value <= 0) {
      localStorage.removeItem(MAX_CHARS_KEY)
    } else {
      localStorage.setItem(MAX_CHARS_KEY, String(Math.round(value)))
    }
  } catch {
    // localStorage unavailable (private mode etc.) — preference just won't persist
  }
}
