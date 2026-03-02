import { create } from 'zustand'
import type { Transcript, VideoMetadata } from '@eigen/shared-types'
import type { StyleProps } from '@eigen/remotion-composition'
import {
  type SessionWord,
  type SessionPhrase,
  buildSessionPhrases,
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

  // Actions
  setJob: (jobId: string, transcript: Transcript, videoMetadata: VideoMetadata) => void
  updateWord: (wordIndex: number, patch: Partial<Pick<SessionWord, 'word' | 'start' | 'end'>>) => void
  splitPhrase: (phraseIndex: number, splitBeforeWordIndex: number) => void
  mergePhrase: (phraseIndex: number) => void
  resetSession: () => void
  setStyle: (partial: Partial<StyleProps>) => void
  reset: () => void
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

  setJob: (jobId, transcript, videoMetadata) => {
    const words: SessionWord[] = transcript.words.map((w) => ({ ...w }))
    const phrases = buildSessionPhrases(words, new Set())
    set({
      jobId,
      original: transcript,
      videoMetadata,
      session: { words, phrases, manualSplitWordIndices: new Set() },
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

  resetSession: () => {
    set((state) => {
      if (!state.original) return state
      const words: SessionWord[] = state.original.words.map((w) => ({ ...w }))
      const phrases = buildSessionPhrases(words, new Set())
      return { session: { words, phrases, manualSplitWordIndices: new Set() } }
    })
  },

  setStyle: (partial) => set((state) => ({ style: { ...state.style, ...partial } })),

  reset: () => set({ jobId: null, original: null, videoMetadata: null, session: null, style: DEFAULT_STYLE }),
}))
