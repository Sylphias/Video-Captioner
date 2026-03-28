import { describe, it, expect } from 'vitest'
import { findMatches, applyReplacements } from './findReplace.ts'
import type { SessionPhrase } from '../../lib/grouping.ts'

function makePhrase(words: string[]): SessionPhrase {
  return {
    words: words.map((w, i) => ({
      word: w,
      start: i * 0.5,
      end: (i + 1) * 0.5,
      confidence: 1,
    })),
    isManualSplit: false,
  }
}

const phrases: SessionPhrase[] = [
  makePhrase(['the', 'cat']),       // index 0 — "the cat"
  makePhrase(['in', 'there']),      // index 1 — "in there"
  makePhrase(['no', 'match']),      // index 2 — "no match"
]

describe('findMatches', () => {
  it('returns matches for substring (case-insensitive)', () => {
    const matches = findMatches(phrases, 'the', 'a')
    expect(matches).toHaveLength(2)
    expect(matches[0].phraseIndex).toBe(0)
    expect(matches[1].phraseIndex).toBe(1)
  })

  it('returns empty array for empty findTerm', () => {
    const matches = findMatches(phrases, '', 'x')
    expect(matches).toHaveLength(0)
  })

  it('returns empty array when no phrases match', () => {
    const matches = findMatches(phrases, 'zebra', 'x')
    expect(matches).toHaveLength(0)
  })

  it('returns correct phraseText and replacedText for each match', () => {
    const matches = findMatches(phrases, 'the', 'a')
    expect(matches[0].phraseText).toBe('the cat')
    expect(matches[0].replacedText).toBe('a cat')
    expect(matches[1].phraseText).toBe('in there')
    expect(matches[1].replacedText).toBe('in are')
  })

  it('replaces all occurrences within a single phrase', () => {
    const thePhrase = [makePhrase(['the', 'the'])]
    const matches = findMatches(thePhrase, 'the', 'a')
    expect(matches).toHaveLength(1)
    expect(matches[0].replacedText).toBe('a a')
  })

  it('is case-insensitive in matching', () => {
    const mixedCase = [makePhrase(['The', 'Cat']), makePhrase(['THE', 'one'])]
    const matches = findMatches(mixedCase, 'the', 'a')
    expect(matches).toHaveLength(2)
  })

  it('is case-insensitive when findTerm has uppercase', () => {
    const lowerCase = [makePhrase(['the', 'cat'])]
    const matches = findMatches(lowerCase, 'THE', 'a')
    expect(matches).toHaveLength(1)
  })
})

describe('applyReplacements', () => {
  it('returns phraseIndex and newWords array for each match', () => {
    const matches = findMatches(phrases, 'the', 'a')
    const replacements = applyReplacements(matches)
    expect(replacements).toHaveLength(2)
    expect(replacements[0].phraseIndex).toBe(0)
    expect(replacements[0].newWords).toEqual(['a', 'cat'])
    expect(replacements[1].phraseIndex).toBe(1)
    expect(replacements[1].newWords).toEqual(['in', 'are'])
  })

  it('returns empty array for empty matches', () => {
    const replacements = applyReplacements([])
    expect(replacements).toHaveLength(0)
  })
})
