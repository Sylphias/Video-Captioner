import type { TranscriptWord } from '@eigen/shared-types'

export const PHRASE_GAP_SEC = 0.3
export const MAX_WORDS_PER_PHRASE = 8

/**
 * SessionWord: editable copy of TranscriptWord. Same shape — kept as a
 * distinct type for clarity and future extension.
 */
export interface SessionWord {
  word: string
  start: number
  end: number
  confidence: number
  speaker?: string
}

/**
 * SessionPhrase: a group of SessionWords with metadata about whether the
 * boundary was created by the user (manual split) or by the auto-grouping
 * algorithm.
 */
export interface SessionPhrase {
  words: SessionWord[]
  isManualSplit: boolean
  dominantSpeaker?: string
  lingerDuration?: number  // per-phrase linger in seconds; overrides global style.lingerDuration when set
  styleOverride?: Record<string, unknown>  // phrase-level style override, applied on top of speaker styles
}

/**
 * Compute the dominant speaker for a phrase by majority word count.
 * In case of a tie, the first word's speaker wins.
 */
export function computeDominantSpeaker(words: SessionWord[]): string | undefined {
  const counts: Record<string, number> = {}
  for (const w of words) {
    if (w.speaker) counts[w.speaker] = (counts[w.speaker] ?? 0) + 1
  }
  const speakers = Object.keys(counts)
  if (speakers.length === 0) return undefined
  // Tie-break: speaker with highest count wins; if tied, first word's speaker wins
  return speakers.reduce((a, b) => counts[a] >= counts[b] ? a : b)
}

/** Returns true if the word text ends with sentence-ending punctuation. */
export function endsWithPunctuation(word: string): boolean {
  return /[.?!]$/.test(word)
}

/**
 * Auto-group words into subtitle-sized phrases. Splits on:
 * 1. Silence gaps > PHRASE_GAP_SEC (0.3s)
 * 2. Sentence-ending punctuation (. ? !)
 * 3. Max word count per phrase (MAX_WORDS_PER_PHRASE = 8)
 *
 * Returns an array of word arrays — each inner array is one phrase's words.
 */
export function groupIntoPhrases(words: TranscriptWord[], maxWordsPerPhrase = MAX_WORDS_PER_PHRASE): TranscriptWord[][] {
  if (words.length === 0) return []

  const phrases: TranscriptWord[][] = []
  let currentPhrase: TranscriptWord[] = [words[0]]

  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end
    const prevEndsPunctuation = endsWithPunctuation(words[i - 1].word)
    const atMaxWords = currentPhrase.length >= maxWordsPerPhrase

    if (gap > PHRASE_GAP_SEC || prevEndsPunctuation || atMaxWords) {
      phrases.push(currentPhrase)
      currentPhrase = [words[i]]
    } else {
      currentPhrase.push(words[i])
    }
  }
  phrases.push(currentPhrase)

  return phrases
}

/**
 * Build SessionPhrase[] from a flat list of SessionWords and a set of
 * global word indices where the user has forced a split.
 *
 * Algorithm:
 * 1. Run groupIntoPhrases(words) to get auto-groups.
 * 2. Flatten the auto-groups to get a canonical ordering.
 * 3. Rebuild phrase array, honoring manual splits:
 *    - An auto split boundary is always honored.
 *    - A manual split at globalIndex forces a new phrase at that position,
 *      even if auto-grouping would not split there.
 * 4. Mark phrases that start at a manual split with isManualSplit: true.
 */
export function buildSessionPhrases(
  words: SessionWord[],
  manualSplitWordIndices: Set<number>,
  maxWordsPerPhrase = MAX_WORDS_PER_PHRASE,
): SessionPhrase[] {
  if (words.length === 0) return []

  const autoGroups = groupIntoPhrases(words, maxWordsPerPhrase)

  // Collect auto-split boundary global indices (start of each group except the first)
  const autoSplitBoundaries = new Set<number>()
  let offset = 0
  for (let g = 0; g < autoGroups.length; g++) {
    if (g > 0) autoSplitBoundaries.add(offset)
    offset += autoGroups[g].length
  }

  // Build phrases respecting both auto and manual splits
  const result: SessionPhrase[] = []
  let current: SessionWord[] = []
  let isManualSplit = false

  for (let i = 0; i < words.length; i++) {
    const isSplitPoint = i > 0 && (autoSplitBoundaries.has(i) || manualSplitWordIndices.has(i))

    if (isSplitPoint) {
      result.push({ words: current, isManualSplit, dominantSpeaker: computeDominantSpeaker(current) })
      current = []
      isManualSplit = manualSplitWordIndices.has(i)
    }

    current.push(words[i])
  }

  if (current.length > 0) {
    result.push({ words: current, isManualSplit, dominantSpeaker: computeDominantSpeaker(current) })
  }

  return result
}
