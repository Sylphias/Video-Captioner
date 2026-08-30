import { describe, it, expect } from 'vitest'
import { parseSrt, alignSrtToWhisper, srtToTranscript } from './srtAlignment.ts'
import type { SessionPhrase } from './grouping.ts'

// -----------------------------------------------------------------------
// parseSrt tests
// -----------------------------------------------------------------------

describe('parseSrt', () => {
  it('parses standard SRT content (3 cues)', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
Hello world

2
00:00:04,000 --> 00:00:06,000
Second line

3
00:00:07,500 --> 00:00:09,200
Third cue here
`
    const cues = parseSrt(srt)
    expect(cues).toHaveLength(3)
    expect(cues[0].startSec).toBeCloseTo(1.0)
    expect(cues[0].endSec).toBeCloseTo(3.0)
    expect(cues[0].text).toBe('Hello world')
    expect(cues[1].startSec).toBeCloseTo(4.0)
    expect(cues[1].endSec).toBeCloseTo(6.0)
    expect(cues[1].text).toBe('Second line')
    expect(cues[2].startSec).toBeCloseTo(7.5)
    expect(cues[2].endSec).toBeCloseTo(9.2)
    expect(cues[2].text).toBe('Third cue here')
  })

  it('strips HTML tags from cue text', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
<b>Bold text</b>
`
    const cues = parseSrt(srt)
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Bold text')
  })

  it('strips nested HTML tags', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
<i><b>Nested tags</b></i>
`
    const cues = parseSrt(srt)
    expect(cues[0].text).toBe('Nested tags')
  })

  it('joins multiline text with spaces', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
line one
line two
`
    const cues = parseSrt(srt)
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('line one line two')
  })

  it('skips cues with empty text after HTML stripping', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
<b></b>

2
00:00:04,000 --> 00:00:06,000
Valid text
`
    const cues = parseSrt(srt)
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Valid text')
  })

  it('skips cues with whitespace-only text after stripping', () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000


2
00:00:04,000 --> 00:00:06,000
Real text
`
    const cues = parseSrt(srt)
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('Real text')
  })

  it('returns empty array for empty input', () => {
    expect(parseSrt('')).toHaveLength(0)
  })

  it('returns empty array for whitespace-only input', () => {
    expect(parseSrt('   \n\n  ')).toHaveLength(0)
  })
})

// -----------------------------------------------------------------------
// alignSrtToWhisper tests
// -----------------------------------------------------------------------

function makePhrase(start: number, end: number, words: string[], speaker?: string): SessionPhrase {
  const wordDur = (end - start) / words.length
  return {
    isManualSplit: false,
    dominantSpeaker: speaker,
    words: words.map((w, i) => ({
      word: w,
      start: start + i * wordDur,
      end: start + (i + 1) * wordDur,
      confidence: 0.9,
      speaker,
    })),
  }
}

describe('alignSrtToWhisper', () => {
  it('matches SRT cue to the phrase with the highest time overlap', () => {
    const phrases: SessionPhrase[] = [
      makePhrase(0, 2, ['Hello', 'world']),
      makePhrase(3, 5, ['how', 'are', 'you']),
    ]
    const cues = [{ startSec: 0.5, endSec: 2.5, text: 'Hello world updated' }]
    const result = alignSrtToWhisper(cues, phrases)
    expect(result).toHaveLength(1)
    expect(result[0].phraseIndex).toBe(0)
    expect(result[0].srtText).toBe('Hello world updated')
  })

  it('skips SRT cues with zero overlap against all phrases', () => {
    const phrases: SessionPhrase[] = [
      makePhrase(0, 2, ['Hello', 'world']),
    ]
    // Cue is entirely outside the phrase's time range
    const cues = [{ startSec: 10, endSec: 12, text: 'No overlap at all' }]
    const result = alignSrtToWhisper(cues, phrases)
    expect(result).toHaveLength(0)
  })

  it('returns replacement words with proportional timing', () => {
    const phrases: SessionPhrase[] = [
      makePhrase(0, 4, ['original', 'words']),
    ]
    const cues = [{ startSec: 0, endSec: 4, text: 'four evenly spaced words' }]
    const result = alignSrtToWhisper(cues, phrases)
    expect(result).toHaveLength(1)
    const words = result[0].replacementWords
    expect(words).toHaveLength(4)
    // Each word should span 1 second (4s / 4 words)
    expect(words[0].start).toBeCloseTo(0)
    expect(words[0].end).toBeCloseTo(1)
    expect(words[1].start).toBeCloseTo(1)
    expect(words[1].end).toBeCloseTo(2)
    expect(words[3].end).toBeCloseTo(4)
  })

  it('preserves speaker label from phrase.dominantSpeaker', () => {
    const phrases: SessionPhrase[] = [
      makePhrase(0, 3, ['hello', 'there'], 'SPEAKER_00'),
    ]
    const cues = [{ startSec: 0, endSec: 3, text: 'greetings everyone here' }]
    const result = alignSrtToWhisper(cues, phrases)
    expect(result).toHaveLength(1)
    for (const word of result[0].replacementWords) {
      expect(word.speaker).toBe('SPEAKER_00')
    }
  })

  it('sets confidence to 1.0 on all replacement words', () => {
    const phrases: SessionPhrase[] = [
      makePhrase(0, 2, ['foo', 'bar']),
    ]
    const cues = [{ startSec: 0, endSec: 2, text: 'replacement text here' }]
    const result = alignSrtToWhisper(cues, phrases)
    for (const word of result[0].replacementWords) {
      expect(word.confidence).toBe(1.0)
    }
  })

  it('enforces minimum word duration of 0.01s', () => {
    // Phrase with 1000 words squeezed into 0.01s would give 0.00001s each
    // We simulate it by checking with a very short phrase + many SRT words
    const phrases: SessionPhrase[] = [
      makePhrase(0, 0.001, ['a']),
    ]
    const cues = [{ startSec: 0, endSec: 0.001, text: 'one two three four five' }]
    const result = alignSrtToWhisper(cues, phrases)
    if (result.length > 0) {
      for (const word of result[0].replacementWords) {
        // minimum duration is 0.01s; use toBeCloseTo to handle IEEE 754 edge cases
        expect(word.end - word.start).toBeGreaterThanOrEqual(0.01 - 1e-10)
      }
    }
  })

  it('skips identical text matches — no diff needed', () => {
    const phrases: SessionPhrase[] = [
      makePhrase(0, 2, ['Hello', 'world']),
    ]
    // Text exactly matches whisper phrase text
    const cues = [{ startSec: 0, endSec: 2, text: 'Hello world' }]
    const result = alignSrtToWhisper(cues, phrases)
    expect(result).toHaveLength(0)
  })

  it('each phrase matched by at most one SRT cue (first-come-first-served)', () => {
    const phrases: SessionPhrase[] = [
      makePhrase(0, 4, ['hello', 'world']),
    ]
    // Two cues that both overlap the same phrase
    const cues = [
      { startSec: 0, endSec: 2, text: 'first match' },
      { startSec: 2, endSec: 4, text: 'second match should be ignored' },
    ]
    const result = alignSrtToWhisper(cues, phrases)
    // Only one result for the phrase (the one with higher overlap wins)
    expect(result.length).toBeLessThanOrEqual(1)
  })

  it('returns results sorted by phraseIndex ascending', () => {
    const phrases: SessionPhrase[] = [
      makePhrase(0, 2, ['first', 'phrase']),
      makePhrase(3, 5, ['second', 'phrase']),
      makePhrase(6, 8, ['third', 'phrase']),
    ]
    // Provide cues in reverse order to test sorting
    const cues = [
      { startSec: 6, endSec: 8, text: 'third replacement' },
      { startSec: 0, endSec: 2, text: 'first replacement' },
    ]
    const result = alignSrtToWhisper(cues, phrases)
    expect(result.length).toBe(2)
    expect(result[0].phraseIndex).toBeLessThan(result[1].phraseIndex)
  })

  it('populates whisperText with the original phrase text', () => {
    const phrases: SessionPhrase[] = [
      makePhrase(0, 2, ['original', 'text']),
    ]
    const cues = [{ startSec: 0, endSec: 2, text: 'replacement text' }]
    const result = alignSrtToWhisper(cues, phrases)
    expect(result[0].whisperText).toBe('original text')
  })

  it('returns empty array when phrases list is empty', () => {
    const cues = [{ startSec: 0, endSec: 2, text: 'some text' }]
    expect(alignSrtToWhisper(cues, [])).toHaveLength(0)
  })

  it('returns empty array when cues list is empty', () => {
    const phrases: SessionPhrase[] = [makePhrase(0, 2, ['foo', 'bar'])]
    expect(alignSrtToWhisper([], phrases)).toHaveLength(0)
  })

  it('auto-detects and corrects large SRT time offset (e.g. DaVinci Resolve 01:00:00 start)', () => {
    // SRT starts at 3600s (01:00:00), Whisper starts at 0s
    const cues = [{ startSec: 3600, endSec: 3602, text: 'corrected text' }]
    const phrases: SessionPhrase[] = [makePhrase(0, 2, ['original', 'text'])]
    const result = alignSrtToWhisper(cues, phrases)
    expect(result).toHaveLength(1)
    expect(result[0].srtText).toBe('corrected text')
    expect(result[0].replacementWords[0].start).toBeCloseTo(0, 1)
  })
})

// -----------------------------------------------------------------------
// srtToTranscript tests
// -----------------------------------------------------------------------

describe('srtToTranscript', () => {
  const cues = [
    { startSec: 1.0, endSec: 3.0, text: 'Hello brave new world' },
    { startSec: 4.0, endSec: 6.0, text: 'Second line' },
  ]

  it('builds a flat word list with evenly distributed timings per cue', () => {
    const { transcript } = srtToTranscript(cues)
    expect(transcript.words).toHaveLength(6)
    expect(transcript.words.map((w) => w.word)).toEqual([
      'Hello', 'brave', 'new', 'world', 'Second', 'line',
    ])
    // First cue: 2s / 4 words = 0.5s each, starting at 1.0
    expect(transcript.words[0].start).toBeCloseTo(1.0)
    expect(transcript.words[0].end).toBeCloseTo(1.5)
    expect(transcript.words[3].start).toBeCloseTo(2.5)
    expect(transcript.words[3].end).toBeCloseTo(3.0)
    // Second cue: 2s / 2 words = 1s each, starting at 4.0
    expect(transcript.words[4].start).toBeCloseTo(4.0)
    expect(transcript.words[5].end).toBeCloseTo(6.0)
  })

  it('assigns confidence 1.0 and no speaker', () => {
    const { transcript } = srtToTranscript(cues)
    for (const w of transcript.words) {
      expect(w.confidence).toBe(1.0)
      expect(w.speaker).toBeUndefined()
    }
  })

  it('returns cue break indices at the start of every cue after the first', () => {
    const { cueBreakIndices } = srtToTranscript(cues)
    expect([...cueBreakIndices]).toEqual([4])
  })

  it('sorts out-of-order cues by start time', () => {
    const { transcript } = srtToTranscript([cues[1], cues[0]])
    expect(transcript.words[0].word).toBe('Hello')
    expect(transcript.words[4].word).toBe('Second')
  })

  it('skips cues whose text yields no words and returns empty for no cues', () => {
    const { transcript, cueBreakIndices } = srtToTranscript([
      { startSec: 0, endSec: 1, text: '   ' },
      { startSec: 2, endSec: 3, text: 'Only cue' },
    ])
    expect(transcript.words.map((w) => w.word)).toEqual(['Only', 'cue'])
    expect(cueBreakIndices.size).toBe(0)

    const empty = srtToTranscript([])
    expect(empty.transcript.words).toHaveLength(0)
  })
})
