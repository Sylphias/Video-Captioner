import { describe, it, expect, beforeEach } from 'vitest'
import { useSubtitleStore } from './subtitleStore.ts'
import { useUndoStore } from './undoMiddleware.ts'
import type { Transcript, VideoMetadata } from '@eigen/shared-types'

// -------------------------------------------------------------------------
// Helper: build a mock Transcript with 20 words, 4 words per phrase.
// Words are spaced at 0.5s each so auto-grouping won't split within phrases.
// Speakers: SPEAKER_00 for words 0-11, SPEAKER_01 for words 12-19.
// -------------------------------------------------------------------------
function buildMockTranscript(): Transcript {
  const words = Array.from({ length: 20 }, (_, i) => ({
    word: `word${i}`,
    start: i * 0.5,
    end: (i + 1) * 0.5,
    confidence: 0.9,
    speaker: i < 12 ? 'SPEAKER_00' : 'SPEAKER_01',
  }))
  return { words, language: 'en' }
}

const MOCK_VIDEO_METADATA: VideoMetadata = {
  duration: 10,
  fps: 30,
  width: 1920,
  height: 1080,
  codec: 'h264',
}

/**
 * Set up a 5-phrase session by:
 * 1. Loading the job (auto-grouping produces 3 phrases: [8,8,4])
 * 2. Using store.splitPhrase() to manually create 5 phrases of 4 words each
 *    by splitting at word boundaries 4, 8, 12, 16.
 *
 * After setup:
 *   phrase[0] = words 0-3 (word0..word3)
 *   phrase[1] = words 4-7 (word4..word7)
 *   phrase[2] = words 8-11 (word8..word11)
 *   phrase[3] = words 12-15 (word12..word15)
 *   phrase[4] = words 16-19 (word16..word19)
 */
function setupSession(): void {
  const store = useSubtitleStore.getState()
  store.setJob('test-job', buildMockTranscript(), MOCK_VIDEO_METADATA)

  // After setJob, auto-grouping gives [8,8,4] (max 8 words per phrase, no gaps).
  // We need 5 phrases of 4 words each. Use splitPhrase to reach that layout.
  // Split phrase[0] at word index 4 within phrase (splitBeforeWordIndex=4) -> [0-3] and [4-7]
  useSubtitleStore.getState().splitPhrase(0, 4)
  // Now phrases: [0-3], [4-7], [8-15], [16-19]... wait, [8-15] is 8 words still
  // Split the phrase that now contains words 8-15 (it's at index 2 after above split)
  useSubtitleStore.getState().splitPhrase(2, 4)
  // Now phrases: [0-3], [4-7], [8-11], [12-15], [16-19] = 5 phrases of 4 words each

  // Reset undo store so tests start clean after setup
  useUndoStore.setState({ past: [], future: [], canUndo: false, canRedo: false })
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

describe('subtitleStore bulk actions', () => {
  beforeEach(() => {
    // Reset both stores before each test
    useSubtitleStore.setState({
      jobId: null,
      original: null,
      videoMetadata: null,
      session: null,
      speakerNames: {},
      speakerStyles: {},
      activeAnimationPresetId: null,
      phraseAnimationPresetIds: {},
    })
    useUndoStore.setState({ past: [], future: [], canUndo: false, canRedo: false })
    setupSession()
  })

  // -----------------------------------------------------------------------
  // mergePhrases
  // -----------------------------------------------------------------------

  describe('mergePhrases', () => {
    it('mergePhrases([0,1,2]) on a 5-phrase session produces 3 phrases with correct words', () => {
      const store = useSubtitleStore.getState()
      store.mergePhrases([0, 1, 2])

      const { phrases } = useSubtitleStore.getState().session!
      expect(phrases).toHaveLength(3)
      // First phrase has words 0-11 (12 words from original phrases 0,1,2)
      expect(phrases[0].words).toHaveLength(12)
      expect(phrases[0].words[0].word).toBe('word0')
      expect(phrases[0].words[11].word).toBe('word11')
    })

    it('mergePhrases([0,2]) non-contiguous: produces 4 phrases; merged phrase has words from 0+2', () => {
      const store = useSubtitleStore.getState()
      store.mergePhrases([0, 2])

      const { phrases } = useSubtitleStore.getState().session!
      // Original: 5 phrases. Merge indices 0 and 2 → words from phrase0 (4) + phrase2 (4) = 8 words
      // Resulting phrases: [merged(0+2), phrase1, phrase3, phrase4] = 4 phrases
      expect(phrases).toHaveLength(4)
      expect(phrases[0].words).toHaveLength(8)
      // Words from phrase0 (word0-3) and phrase2 (word8-11)
      expect(phrases[0].words[0].word).toBe('word0')
      expect(phrases[0].words[4].word).toBe('word8')
      // Original phrase1 (words 4-7) is now at index 1 and untouched
      expect(phrases[1].words[0].word).toBe('word4')
      expect(phrases[1].words).toHaveLength(4)
    })

    it('mergePhrases with < 2 indices is a no-op (no state change, no undo push)', () => {
      const initialPhraseCount = useSubtitleStore.getState().session!.phrases.length
      useSubtitleStore.getState().mergePhrases([0])
      expect(useSubtitleStore.getState().session!.phrases).toHaveLength(initialPhraseCount)
      expect(useUndoStore.getState().past).toHaveLength(0)
    })

    it('mergePhrases pushes exactly 1 undo snapshot', () => {
      useSubtitleStore.getState().mergePhrases([0, 1])
      expect(useUndoStore.getState().past).toHaveLength(1)
    })

    it('mergePhrases sets dominantSpeaker via computeDominantSpeaker on merged words', () => {
      // Merge phrases 0,1,2 — all have SPEAKER_00 (words 0-11)
      useSubtitleStore.getState().mergePhrases([0, 1, 2])
      const { phrases } = useSubtitleStore.getState().session!
      expect(phrases[0].dominantSpeaker).toBe('SPEAKER_00')
    })
  })

  // -----------------------------------------------------------------------
  // deletePhrases
  // -----------------------------------------------------------------------

  describe('deletePhrases', () => {
    it('deletePhrases([1,3]) on a 5-phrase session produces 3 phrases', () => {
      useSubtitleStore.getState().deletePhrases([1, 3])
      const { phrases } = useSubtitleStore.getState().session!
      expect(phrases).toHaveLength(3)
    })

    it('deletePhrases refuses to delete all phrases — at least one remains', () => {
      // Try to delete all 5 phrases — should be a no-op or keep at least one
      useSubtitleStore.getState().deletePhrases([0, 1, 2, 3, 4])
      const { phrases, words } = useSubtitleStore.getState().session!
      expect(phrases.length).toBeGreaterThanOrEqual(1)
      expect(words.length).toBeGreaterThan(0)
    })

    it('deletePhrases pushes exactly 1 undo snapshot', () => {
      useSubtitleStore.getState().deletePhrases([1, 3])
      expect(useUndoStore.getState().past).toHaveLength(1)
    })

    it('deletePhrases adjusts manualSplitWordIndices correctly', () => {
      // After setup, there are manual splits. Deleting phrase[1] (words 4-7) should shift
      // any manual split indices > 7 down by 4.
      useSubtitleStore.getState().deletePhrases([1])
      const { words, manualSplitWordIndices } = useSubtitleStore.getState().session!
      // Total words should be 16 (20 - 4)
      expect(words).toHaveLength(16)
      // All manual split indices should be within bounds
      for (const idx of manualSplitWordIndices) {
        expect(idx).toBeLessThan(words.length)
        expect(idx).toBeGreaterThanOrEqual(0)
      }
    })
  })

  // -----------------------------------------------------------------------
  // duplicatePhrase
  // -----------------------------------------------------------------------

  describe('duplicatePhrase', () => {
    it('duplicatePhrase(1) on a 5-phrase session produces 6 phrases; index 2 is clone of original index 1', () => {
      useSubtitleStore.getState().duplicatePhrase(1)
      const { phrases } = useSubtitleStore.getState().session!
      expect(phrases).toHaveLength(6)
      // The duplicate is at index 2 — should have the same words as original phrase[1]
      const original = phrases[1]
      const clone = phrases[2]
      expect(clone.words).toHaveLength(original.words.length)
      expect(clone.words[0].word).toBe(original.words[0].word)
      expect(clone.words[0].start).toBe(original.words[0].start)
    })
  })

  // -----------------------------------------------------------------------
  // movePhraseUp
  // -----------------------------------------------------------------------

  describe('movePhraseUp', () => {
    it('movePhraseUp(2) swaps phrases at index 2 and 1', () => {
      const before = useSubtitleStore.getState().session!.phrases
      const phrase1Before = before[1].words[0].word
      const phrase2Before = before[2].words[0].word

      useSubtitleStore.getState().movePhraseUp(2)

      const after = useSubtitleStore.getState().session!.phrases
      expect(after[1].words[0].word).toBe(phrase2Before)
      expect(after[2].words[0].word).toBe(phrase1Before)
    })

    it('movePhraseUp(0) is a no-op', () => {
      const before = useSubtitleStore.getState().session!.phrases.map(p => p.words[0].word)
      useSubtitleStore.getState().movePhraseUp(0)
      const after = useSubtitleStore.getState().session!.phrases.map(p => p.words[0].word)
      expect(after).toEqual(before)
      // No undo pushed for no-op
      expect(useUndoStore.getState().past).toHaveLength(0)
    })
  })

  // -----------------------------------------------------------------------
  // movePhraseDown
  // -----------------------------------------------------------------------

  describe('movePhraseDown', () => {
    it('movePhraseDown(0) swaps phrases at index 0 and 1', () => {
      const before = useSubtitleStore.getState().session!.phrases
      const phrase0Before = before[0].words[0].word
      const phrase1Before = before[1].words[0].word

      useSubtitleStore.getState().movePhraseDown(0)

      const after = useSubtitleStore.getState().session!.phrases
      expect(after[0].words[0].word).toBe(phrase1Before)
      expect(after[1].words[0].word).toBe(phrase0Before)
    })

    it('movePhraseDown on last index is a no-op', () => {
      const phrases = useSubtitleStore.getState().session!.phrases
      const lastIdx = phrases.length - 1
      const before = phrases.map(p => p.words[0].word)
      useSubtitleStore.getState().movePhraseDown(lastIdx)
      const after = useSubtitleStore.getState().session!.phrases.map(p => p.words[0].word)
      expect(after).toEqual(before)
      // No undo pushed for no-op
      expect(useUndoStore.getState().past).toHaveLength(0)
    })
  })
})
