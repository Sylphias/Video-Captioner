import { useCurrentFrame, useVideoConfig } from 'remotion'
import type { TranscriptWord } from '@eigen/shared-types'
import type { StyleProps } from './types'

const PHRASE_GAP_SEC = 0.3
const MAX_WORDS_PER_PHRASE = 8

/**
 * Binary search: find the index of the last word whose start <= currentTimeSec.
 * Karaoke UX: the most recently started word stays highlighted even during
 * intra-phrase gaps (brief silences between words). This prevents flickering.
 */
export function findActiveWordIndex(words: TranscriptWord[], currentTimeSec: number): number {
  if (words.length === 0) return -1

  let lo = 0
  let hi = words.length - 1
  let result = -1

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (words[mid].start <= currentTimeSec) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  return result
}

/** Returns true if the word text ends with sentence-ending punctuation. */
function endsWithPunctuation(word: string): boolean {
  return /[.?!]$/.test(word)
}

/**
 * Group words into subtitle-sized phrases. Splits on:
 * 1. Silence gaps > PHRASE_GAP_SEC (0.3s)
 * 2. Sentence-ending punctuation (. ? !)
 * 3. Max word count per phrase
 */
export function groupIntoPhrases(words: TranscriptWord[]): TranscriptWord[][] {
  if (words.length === 0) return []

  const phrases: TranscriptWord[][] = []
  let currentPhrase: TranscriptWord[] = [words[0]]

  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end
    const prevEndsPunctuation = endsWithPunctuation(words[i - 1].word)
    const atMaxWords = currentPhrase.length >= MAX_WORDS_PER_PHRASE

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

interface SubtitleOverlayProps {
  words: TranscriptWord[]
  style: StyleProps
}

export function SubtitleOverlay({ words, style }: SubtitleOverlayProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const currentTimeSec = frame / fps
  const phrases = groupIntoPhrases(words)

  // Find the active phrase: one where current time falls within the phrase window.
  // Keep phrase visible for 0.5s after last word ends for readability.
  const LINGER_SEC = 0.5
  const activePhrase = phrases.find((phrase) => {
    const phraseStart = phrase[0].start
    const phraseEnd = phrase[phrase.length - 1].end + LINGER_SEC
    return currentTimeSec >= phraseStart && currentTimeSec <= phraseEnd
  }) ?? null

  if (activePhrase === null) {
    return null
  }

  const activeWordIndex = findActiveWordIndex(activePhrase, currentTimeSec)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '10%',
        left: '5%',
        right: '5%',
        textAlign: 'center',
        fontSize: style.fontSize,
        fontFamily: style.fontFamily,
        lineHeight: 1.4,
      }}
    >
      {activePhrase.map((word, i) => (
        <span
          key={`${word.start}-${i}`}
          style={{
            color: i === activeWordIndex ? style.highlightColor : style.baseColor,
            marginRight: '0.25em',
            textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.9)',
          }}
        >
          {word.word}
        </span>
      ))}
    </div>
  )
}
