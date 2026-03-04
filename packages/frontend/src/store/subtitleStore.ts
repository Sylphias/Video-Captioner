import { create } from 'zustand'
import type { Transcript, VideoMetadata } from '@eigen/shared-types'
import type { StyleProps } from '@eigen/remotion-composition'
import {
  type SessionWord,
  type SessionPhrase,
  buildSessionPhrases,
  computeDominantSpeaker,
} from '../lib/grouping.ts'

export type { SessionWord, SessionPhrase }

interface SubtitleStore {
  jobId: string | null
  original: Transcript | null          // immutable Whisper output
  videoMetadata: VideoMetadata | null
  session: {
    words: SessionWord[]               // editable copy of original.words
    phrases: SessionPhrase[]           // computed from words + manual splits
    manualSplitWordIndices: Set<number> // global word indices where user forced splits
  } | null
  style: StyleProps
  speakerNames: Record<string, string> // maps raw speaker IDs to display names

  // Actions
  setJob: (jobId: string, transcript: Transcript, videoMetadata: VideoMetadata) => void
  updateWord: (wordIndex: number, patch: Partial<Pick<SessionWord, 'word' | 'start' | 'end'>>) => void
  splitPhrase: (phraseIndex: number, splitBeforeWordIndex: number) => void
  mergePhrase: (phraseIndex: number) => void
  addWord: (phraseIndex: number) => void
  addPhrase: (afterPhraseIndex: number) => void
  deleteWord: (wordIndex: number) => void
  resetSession: () => void
  setStyle: (partial: Partial<StyleProps>) => void
  reset: () => void
  renameSpeaker: (speakerId: string, displayName: string) => void
  reassignWordSpeaker: (wordIndex: number, speakerId: string) => void
}

const DEFAULT_STYLE: StyleProps = {
  highlightColor: '#FFFF00',
  baseColor: '#FFFFFF',
  fontSize: 48,
  fontFamily: 'Arial, sans-serif',
}

export const useSubtitleStore = create<SubtitleStore>()((set, get) => ({
  jobId: null,
  original: null,
  videoMetadata: null,
  session: null,
  style: DEFAULT_STYLE,
  speakerNames: {},

  setJob: (jobId, transcript, videoMetadata) => {
    const words: SessionWord[] = transcript.words.map((w) => ({ ...w }))
    const phrases = buildSessionPhrases(words, new Set())
    // Initialize speakerNames from unique speakers found in words
    const uniqueSpeakers = new Set<string>()
    for (const w of words) { if (w.speaker) uniqueSpeakers.add(w.speaker) }
    const speakerNames: Record<string, string> = {}
    for (const s of uniqueSpeakers) { speakerNames[s] = s } // default display name = raw ID
    set({
      jobId,
      original: transcript,
      videoMetadata,
      session: { words, phrases, manualSplitWordIndices: new Set() },
      speakerNames,
    })
  },

  updateWord: (wordIndex, patch) => {
    set((state) => {
      if (!state.session) return state

      const word = state.session.words[wordIndex]
      if (!word) return state

      // Timestamp validation
      if ('start' in patch) {
        if (patch.start! >= word.end) return state
        if (wordIndex > 0 && patch.start! < state.session.words[wordIndex - 1].end) return state
      }
      if ('end' in patch) {
        if (patch.end! <= word.start) return state
        if (wordIndex < state.session.words.length - 1 && patch.end! > state.session.words[wordIndex + 1].start) return state
      }

      const words = state.session.words.map((w, i) =>
        i === wordIndex ? { ...w, ...patch } : w
      )

      // Only recompute phrase boundaries when timestamps change.
      // Text-only edits update the word in-place in existing phrases to avoid
      // clobbering manual splits (Pitfall #2 in research).
      const rebuildPhrases = 'start' in patch || 'end' in patch

      let phrases: SessionPhrase[]
      if (rebuildPhrases) {
        phrases = buildSessionPhrases(words, state.session.manualSplitWordIndices)
      } else {
        // Text edit: update the word text within the existing phrase structure
        // by finding it by its position match (start/end are unchanged)
        const updatedWord = words[wordIndex]
        phrases = state.session.phrases.map((p) => ({
          ...p,
          words: p.words.map((pw) =>
            pw.start === updatedWord.start && pw.end === updatedWord.end
              ? { ...pw, word: updatedWord.word }
              : pw
          ),
        }))
      }

      return { session: { ...state.session, words, phrases } }
    })
  },

  splitPhrase: (phraseIndex, splitBeforeWordIndex) => {
    set((state) => {
      if (!state.session) return state
      const phrases = [...state.session.phrases]
      const target = phrases[phraseIndex]
      if (!target || splitBeforeWordIndex <= 0 || splitBeforeWordIndex >= target.words.length) {
        return state // invalid split
      }
      const left: SessionPhrase = { words: target.words.slice(0, splitBeforeWordIndex), isManualSplit: false }
      const right: SessionPhrase = { words: target.words.slice(splitBeforeWordIndex), isManualSplit: true }
      phrases.splice(phraseIndex, 1, left, right)

      // Compute the global word index of the split point
      let globalSplitIdx = 0
      for (let i = 0; i < phraseIndex; i++) {
        globalSplitIdx += state.session.phrases[i].words.length
      }
      globalSplitIdx += splitBeforeWordIndex

      const manualSplitWordIndices = new Set(state.session.manualSplitWordIndices)
      manualSplitWordIndices.add(globalSplitIdx)
      return { session: { ...state.session, phrases, manualSplitWordIndices } }
    })
  },

  mergePhrase: (phraseIndex) => {
    set((state) => {
      if (!state.session) return state
      const phrases = [...state.session.phrases]
      if (phraseIndex >= phrases.length - 1) return state // nothing to merge into

      const merged: SessionPhrase = {
        words: [...phrases[phraseIndex].words, ...phrases[phraseIndex + 1].words],
        isManualSplit: phrases[phraseIndex].isManualSplit,
      }

      // Compute the global word index at the boundary between phraseIndex and phraseIndex+1
      let splitWordIdx = 0
      for (let i = 0; i <= phraseIndex; i++) {
        splitWordIdx += state.session.phrases[i].words.length
      }

      const manualSplitWordIndices = new Set(state.session.manualSplitWordIndices)
      manualSplitWordIndices.delete(splitWordIdx)
      phrases.splice(phraseIndex, 2, merged)
      return { session: { ...state.session, phrases, manualSplitWordIndices } }
    })
  },

  addWord: (phraseIndex) => {
    set((state) => {
      if (!state.session) return state
      const phrase = state.session.phrases[phraseIndex]
      if (!phrase || phrase.words.length === 0) return state

      const lastWord = phrase.words[phrase.words.length - 1]
      const DEFAULT_WORD_DURATION = 0.3

      // Find the next word's start to cap the new word's end time
      let nextWordStart = lastWord.end + DEFAULT_WORD_DURATION
      // Check if there's a next phrase with words
      if (phraseIndex < state.session.phrases.length - 1) {
        const nextPhrase = state.session.phrases[phraseIndex + 1]
        if (nextPhrase.words.length > 0) {
          nextWordStart = Math.min(nextWordStart, nextPhrase.words[0].start)
        }
      }

      const newWord: SessionWord = {
        word: '...',
        start: lastWord.end,
        end: Math.min(lastWord.end + DEFAULT_WORD_DURATION, nextWordStart),
        confidence: 1,
      }

      // Compute global index for insertion (after last word of this phrase)
      let globalIdx = 0
      for (let i = 0; i <= phraseIndex; i++) {
        globalIdx += state.session.phrases[i].words.length
      }

      const words = [...state.session.words]
      words.splice(globalIdx, 0, newWord)

      // Shift manual split indices that are >= globalIdx
      const manualSplitWordIndices = new Set<number>()
      for (const idx of state.session.manualSplitWordIndices) {
        manualSplitWordIndices.add(idx >= globalIdx ? idx + 1 : idx)
      }

      const phrases = buildSessionPhrases(words, manualSplitWordIndices)
      return { session: { words, phrases, manualSplitWordIndices } }
    })
  },

  addPhrase: (afterPhraseIndex) => {
    set((state) => {
      if (!state.session) return state
      const DEFAULT_WORD_DURATION = 0.5

      // Determine timing for the new phrase's word
      let newStart: number
      let newEnd: number
      if (state.session.phrases.length === 0) {
        newStart = 0
        newEnd = DEFAULT_WORD_DURATION
      } else {
        const prevPhrase = state.session.phrases[Math.min(afterPhraseIndex, state.session.phrases.length - 1)]
        const lastWord = prevPhrase.words[prevPhrase.words.length - 1]
        newStart = lastWord ? lastWord.end : 0

        // Cap at next phrase's first word if it exists
        let cap = newStart + DEFAULT_WORD_DURATION
        if (afterPhraseIndex + 1 < state.session.phrases.length) {
          const nextPhrase = state.session.phrases[afterPhraseIndex + 1]
          if (nextPhrase.words.length > 0) {
            cap = Math.min(cap, nextPhrase.words[0].start)
          }
        }
        newEnd = cap
      }

      const newWord: SessionWord = {
        word: '...',
        start: newStart,
        end: newEnd,
        confidence: 1,
      }

      // Compute global index: after all words in phrases up to and including afterPhraseIndex
      let globalIdx = 0
      for (let i = 0; i <= afterPhraseIndex && i < state.session.phrases.length; i++) {
        globalIdx += state.session.phrases[i].words.length
      }

      const words = [...state.session.words]
      words.splice(globalIdx, 0, newWord)

      // Shift manual split indices and add a split at the new word's position
      const manualSplitWordIndices = new Set<number>()
      for (const idx of state.session.manualSplitWordIndices) {
        manualSplitWordIndices.add(idx >= globalIdx ? idx + 1 : idx)
      }
      manualSplitWordIndices.add(globalIdx)

      const phrases = buildSessionPhrases(words, manualSplitWordIndices)
      return { session: { words, phrases, manualSplitWordIndices } }
    })
  },

  deleteWord: (wordIndex) => {
    set((state) => {
      if (!state.session) return state
      if (wordIndex < 0 || wordIndex >= state.session.words.length) return state
      // Don't allow deleting the last word entirely
      if (state.session.words.length <= 1) return state

      const words = state.session.words.filter((_, i) => i !== wordIndex)

      // Shift manual split indices
      const manualSplitWordIndices = new Set<number>()
      for (const idx of state.session.manualSplitWordIndices) {
        if (idx === wordIndex) continue // remove split at deleted word
        manualSplitWordIndices.add(idx > wordIndex ? idx - 1 : idx)
      }

      const phrases = buildSessionPhrases(words, manualSplitWordIndices)
      return { session: { words, phrases, manualSplitWordIndices } }
    })
  },

  resetSession: () => {
    set((state) => {
      if (!state.original) return state
      const words: SessionWord[] = state.original.words.map((w) => ({ ...w }))
      const phrases = buildSessionPhrases(words, new Set())
      // Re-initialize speakerNames from original transcript
      const uniqueSpeakers = new Set<string>()
      for (const w of words) { if (w.speaker) uniqueSpeakers.add(w.speaker) }
      const speakerNames: Record<string, string> = {}
      for (const s of uniqueSpeakers) { speakerNames[s] = s }
      return { session: { words, phrases, manualSplitWordIndices: new Set() }, speakerNames }
    })
  },

  setStyle: (partial) => set((state) => ({ style: { ...state.style, ...partial } })),

  reset: () => set({ jobId: null, original: null, videoMetadata: null, session: null, style: DEFAULT_STYLE, speakerNames: {} }),

  renameSpeaker: (speakerId, displayName) => {
    set((state) => ({
      speakerNames: { ...state.speakerNames, [speakerId]: displayName }
    }))
  },

  reassignWordSpeaker: (wordIndex, speakerId) => {
    set((state) => {
      if (!state.session) return state
      const word = state.session.words[wordIndex]
      if (!word) return state

      // Update the word's speaker in the flat words array
      const words = state.session.words.map((w, i) =>
        i === wordIndex ? { ...w, speaker: speakerId } : w
      )

      // Update the word's speaker within the existing phrase structure (no rebuild!)
      // and recompute dominantSpeaker for the affected phrase only
      const phrases = state.session.phrases.map((p) => {
        const phraseHasWord = p.words.some(
          (pw) => pw.start === word.start && pw.end === word.end
        )
        if (!phraseHasWord) return p
        const updatedWords = p.words.map((pw) =>
          pw.start === word.start && pw.end === word.end
            ? { ...pw, speaker: speakerId }
            : pw
        )
        return { ...p, words: updatedWords, dominantSpeaker: computeDominantSpeaker(updatedWords) }
      })

      // Ensure the new speaker is in speakerNames
      const speakerNames = state.speakerNames[speakerId]
        ? state.speakerNames
        : { ...state.speakerNames, [speakerId]: speakerId }

      return { session: { ...state.session, words, phrases }, speakerNames }
    })
  },
}))
