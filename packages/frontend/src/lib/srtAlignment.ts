import SrtParser from 'srt-parser-2'
import type { SessionWord, SessionPhrase } from './grouping.ts'

// Re-export for use in hooks and components
export type { SessionWord }

/**
 * A parsed SRT cue with numeric start/end times in seconds.
 */
export interface SrtCue {
  startSec: number
  endSec: number
  text: string
}

/**
 * A phrase that has a difference between the Whisper transcript and the SRT file.
 * Contains the replacement words with proportionally distributed timestamps.
 */
export interface AlignedPhrase {
  phraseIndex: number
  whisperText: string
  srtText: string
  replacementWords: SessionWord[]
}

/**
 * Parse raw SRT file content into an array of SrtCues.
 *
 * - Strips HTML tags (e.g. <b>, <i>, <font ...>)
 * - Joins multiline text with spaces
 * - Skips cues where the cleaned text has no word characters
 */
export function parseSrt(rawContent: string): SrtCue[] {
  if (!rawContent || !rawContent.trim()) return []

  const parser = new SrtParser()
  let entries: { startSeconds: number; endSeconds: number; text: string }[]

  try {
    entries = parser.fromSrt(rawContent)
  } catch {
    return []
  }

  const cues: SrtCue[] = []

  for (const entry of entries) {
    // Strip HTML tags
    const stripped = entry.text.replace(/<[^>]+>/g, '')
    // Join multiline text with spaces
    const joined = stripped.replace(/\n/g, ' ').trim()
    // Skip cues with no word characters
    if (!/\w/.test(joined)) continue

    cues.push({
      startSec: entry.startSeconds,
      endSec: entry.endSeconds,
      text: joined,
    })
  }

  return cues
}

/**
 * Distribute timing evenly across the provided SRT words within a phrase's time window.
 *
 * - Enforces a minimum word duration of 0.01s (Pitfall 5)
 * - Preserves speaker label from the source phrase
 */
function distributeTimings(
  srtWords: string[],
  phraseStart: number,
  phraseEnd: number,
  speaker?: string,
): SessionWord[] {
  const n = srtWords.length
  const duration = phraseEnd - phraseStart
  const rawPerWord = duration / n
  const perWord = Math.max(rawPerWord, 0.01)

  return srtWords.map((word, i) => {
    // Derive start from phraseStart to avoid cumulative drift
    const start = phraseStart + i * perWord
    // Derive end as start + perWord so (end - start) equals perWord exactly
    const end = start + perWord
    return {
      word,
      start,
      end,
      confidence: 1.0,
      speaker,
    }
  })
}

/**
 * Align SRT cues to Whisper phrases by time overlap.
 *
 * Two-stage algorithm:
 *
 * Stage 1 — For each SRT cue, find the Whisper phrase with the highest time overlap.
 *   - Phrase range: [first word start, last word end]
 *   - Overlap: Math.max(0, Math.min(cueEnd, phraseEnd) - Math.max(cueStart, phraseStart))
 *   - Skip cues with zero overlap against all phrases (D-11)
 *   - Each phrase may be matched by at most one SRT cue (first-come-first-served;
 *     if two cues fight for the same phrase, the one with higher overlap fraction wins)
 *
 * Stage 2 — For each matched pair, produce AlignedPhrase with replacement words via
 *   distributeTimings. Skip pairs where the texts are identical (no diff needed).
 *
 * Returns results sorted by phraseIndex ascending.
 */
export function alignSrtToWhisper(cues: SrtCue[], phrases: SessionPhrase[]): AlignedPhrase[] {
  if (cues.length === 0 || phrases.length === 0) return []

  // Map from phraseIndex -> best matched cue (winner so far)
  const phraseToMatch = new Map<number, { cue: SrtCue; overlapFraction: number }>()

  for (const cue of cues) {
    const cueDuration = cue.endSec - cue.startSec
    if (cueDuration <= 0) continue

    let bestPhraseIndex = -1
    let bestOverlap = 0

    for (let p = 0; p < phrases.length; p++) {
      const phrase = phrases[p]
      if (phrase.words.length === 0) continue

      const phraseStart = phrase.words[0].start
      const phraseEnd = phrase.words[phrase.words.length - 1].end

      const overlap = Math.max(0, Math.min(cue.endSec, phraseEnd) - Math.max(cue.startSec, phraseStart))
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        bestPhraseIndex = p
      }
    }

    // Skip cues with zero overlap against all phrases (D-11)
    if (bestPhraseIndex === -1 || bestOverlap === 0) continue

    const overlapFraction = bestOverlap / cueDuration

    // First-come-first-served: challenge existing match for the same phrase
    const existing = phraseToMatch.get(bestPhraseIndex)
    if (!existing || overlapFraction > existing.overlapFraction) {
      phraseToMatch.set(bestPhraseIndex, { cue, overlapFraction })
    }
  }

  // Stage 2: Produce AlignedPhrase for each matched pair
  const results: AlignedPhrase[] = []

  for (const [phraseIndex, { cue }] of phraseToMatch.entries()) {
    const phrase = phrases[phraseIndex]
    if (phrase.words.length === 0) continue

    const phraseStart = phrase.words[0].start
    const phraseEnd = phrase.words[phrase.words.length - 1].end

    const whisperText = phrase.words.map((w) => w.word).join(' ')
    const srtText = cue.text

    // Skip identical matches — no diff needed
    if (whisperText === srtText) continue

    const srtWords = srtText.split(/\s+/).filter(Boolean)
    if (srtWords.length === 0) continue

    const replacementWords = distributeTimings(
      srtWords,
      phraseStart,
      phraseEnd,
      phrase.dominantSpeaker,
    )

    results.push({
      phraseIndex,
      whisperText,
      srtText,
      replacementWords,
    })
  }

  // Sort by phraseIndex ascending
  results.sort((a, b) => a.phraseIndex - b.phraseIndex)

  return results
}
