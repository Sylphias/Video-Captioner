import { create } from 'zustand'
import type { Transcript, VideoMetadata } from '@eigen/shared-types'
import type { StyleProps, SpeakerStyleOverride } from '@eigen/remotion-composition'
import {
  type SessionWord,
  type SessionPhrase,
  buildSessionPhrases,
  computeDominantSpeaker,
} from '../lib/grouping.ts'
import { useUndoStore, type StateSnapshot } from './undoMiddleware.ts'

export type { SessionWord, SessionPhrase }

/** Style override shape for phrases — same as SpeakerStyleOverride (Partial<StyleProps>) */
export type PhraseStyleOverride = Partial<StyleProps>

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
  maxWordsPerPhrase: number             // max words per auto-grouped phrase (default 8)
  speakerNames: Record<string, string>               // maps raw speaker IDs to display names
  speakerStyles: Record<string, SpeakerStyleOverride> // per-speaker style overrides
  activeAnimationPresetId: string | null              // globally active animation preset ID
  phraseAnimationPresetIds: Record<number, string>    // maps phrase index to override preset ID
  // Actions
  setJob: (jobId: string, transcript: Transcript, videoMetadata: VideoMetadata) => void
  updateWord: (wordIndex: number, patch: Partial<Pick<SessionWord, 'word' | 'start' | 'end'>>) => void
  splitPhrase: (phraseIndex: number, splitBeforeWordIndex: number) => void
  mergePhrase: (phraseIndex: number) => void
  addWord: (phraseIndex: number) => void
  addPhrase: (afterPhraseIndex: number) => void
  deleteWord: (wordIndex: number) => void
  updatePhraseText: (phraseIndex: number, newWords: string[]) => void
  setPhraseLinger: (phraseIndex: number, lingerSec: number) => void
  resetSession: () => void
  setStyle: (partial: Partial<StyleProps>) => void
  setMaxWordsPerPhrase: (n: number) => void
  setSpeakerStyle: (speakerId: string, override: SpeakerStyleOverride) => void
  clearSpeakerStyle: (speakerId: string) => void
  reset: () => void
  renameSpeaker: (speakerId: string, displayName: string) => void
  reassignWordSpeaker: (wordIndex: number, speakerId: string) => void
  reassignPhraseSpeaker: (phraseIndex: number, speakerId: string) => void
  deleteSpeaker: (speakerId: string, reassignTo: string) => void
  deletePhrase: (phraseIndex: number) => void
  addPhraseAtTime: (timeSec: number, speakerId: string) => void
  shiftPhrase: (phraseIndex: number, deltaSec: number) => void
  shiftAllWords: (deltaSec: number) => void
  applyWordShift: (baselineWords: SessionWord[], deltaSec: number) => void
  setPhraseStyle: (phraseIndex: number, override: PhraseStyleOverride) => void
  clearPhraseStyle: (phraseIndex: number) => void
  setActiveAnimationPresetId: (id: string | null) => void
  setPhraseAnimationPresetId: (phraseIndex: number, presetId: string | null) => void
  applySrtPhrase: (phraseIndex: number, replacementWords: SessionWord[]) => void
  mergePhrases: (indices: number[]) => void
  deletePhrases: (indices: number[]) => void
  duplicatePhrase: (phraseIndex: number) => void
  movePhraseUp: (phraseIndex: number) => void
  movePhraseDown: (phraseIndex: number) => void
}

const DEFAULT_STYLE: StyleProps = {
  highlightColor: '#FFFF00',
  baseColor: '#FFFFFF',
  fontSize: 48,
  fontFamily: 'Inter',
  fontWeight: 700,
  strokeColor: '#000000',
  strokeWidth: 2,
  shadowColor: '#000000',
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  shadowBlur: 4,
  verticalPosition: 80,
  lingerDuration: 1.0,
}

/**
 * Capture the current store state as an undo snapshot.
 * Uses structuredClone for deep-copy; Set is serialized to Array.
 */
function captureSnapshot(state: {
  session: SubtitleStore['session']
  style: StyleProps
  maxWordsPerPhrase: number
  speakerNames: Record<string, string>
  speakerStyles: Record<string, SpeakerStyleOverride>
  activeAnimationPresetId: string | null
  phraseAnimationPresetIds: Record<number, string>
}): StateSnapshot {
  return {
    session: state.session
      ? {
          words: structuredClone(state.session.words),
          phrases: structuredClone(state.session.phrases),
          manualSplitWordIndices: Array.from(state.session.manualSplitWordIndices),
        }
      : null,
    style: structuredClone(state.style) as unknown as Record<string, unknown>,
    maxWordsPerPhrase: state.maxWordsPerPhrase,
    speakerNames: { ...state.speakerNames },
    speakerStyles: structuredClone(state.speakerStyles) as Record<string, Record<string, unknown>>,
    activeAnimationPresetId: state.activeAnimationPresetId,
    phraseAnimationPresetIds: { ...state.phraseAnimationPresetIds },
  }
}

/**
 * Push a snapshot to the undo store before a user-mutating action.
 * Call this inside the set() callback to capture the CURRENT state.
 */
function pushUndo(state: {
  session: SubtitleStore['session']
  style: StyleProps
  maxWordsPerPhrase: number
  speakerNames: Record<string, string>
  speakerStyles: Record<string, SpeakerStyleOverride>
  activeAnimationPresetId: string | null
  phraseAnimationPresetIds: Record<number, string>
}): void {
  useUndoStore.getState().pushSnapshot(captureSnapshot(state))
}

/**
 * Restore a StateSnapshot back into the subtitle store.
 * Called by undo() and redo() in SubtitlesPage.
 */
export function restoreSnapshot(snapshot: StateSnapshot): void {
  useSubtitleStore.setState((state) => {
    if (!snapshot.session) {
      return { session: null }
    }

    // Re-hydrate Set from serialized Array
    const manualSplitWordIndices = new Set<number>(snapshot.session.manualSplitWordIndices)

    return {
      session: {
        words: structuredClone(snapshot.session.words) as SessionWord[],
        phrases: structuredClone(snapshot.session.phrases) as SessionPhrase[],
        manualSplitWordIndices,
      },
      style: structuredClone(snapshot.style) as unknown as StyleProps,
      maxWordsPerPhrase: snapshot.maxWordsPerPhrase ?? 8,
      speakerNames: { ...snapshot.speakerNames },
      speakerStyles: structuredClone(snapshot.speakerStyles) as unknown as Record<string, SpeakerStyleOverride>,
      activeAnimationPresetId: snapshot.activeAnimationPresetId ?? null,
      phraseAnimationPresetIds: snapshot.phraseAnimationPresetIds ?? {},
    }
  })
}

export const useSubtitleStore = create<SubtitleStore>()((set, get) => ({
  jobId: null,
  original: null,
  videoMetadata: null,
  session: null,
  style: DEFAULT_STYLE,
  maxWordsPerPhrase: 8,
  speakerNames: {},
  speakerStyles: {},
  activeAnimationPresetId: null,
  phraseAnimationPresetIds: {},

  setJob: (jobId, transcript, videoMetadata) => {
    const words: SessionWord[] = transcript.words.map((w) => ({ ...w }))
    const phrases = buildSessionPhrases(words, new Set(), get().maxWordsPerPhrase)
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

      // Push undo snapshot before mutating
      pushUndo(state)

      const words = state.session.words.map((w, i) =>
        i === wordIndex ? { ...w, ...patch } : w
      )

      // Only recompute phrase boundaries when timestamps change.
      // Text-only edits update the word in-place in existing phrases to avoid
      // clobbering manual splits (Pitfall #2 in research).
      const rebuildPhrases = 'start' in patch || 'end' in patch

      let phrases: SessionPhrase[]
      if (rebuildPhrases) {
        phrases = buildSessionPhrases(words, state.session.manualSplitWordIndices, state.maxWordsPerPhrase)
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

      // Push undo snapshot before mutating
      pushUndo(state)

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

      // Push undo snapshot before mutating
      pushUndo(state)

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

      // Push undo snapshot before mutating
      pushUndo(state)

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

      // Ensure the next phrase boundary is preserved — without this, the
      // auto-grouper may merge the new word into the next phrase (gap ≈ 0).
      if (phraseIndex < state.session.phrases.length - 1) {
        manualSplitWordIndices.add(globalIdx + 1)
      }

      const phrases = buildSessionPhrases(words, manualSplitWordIndices, state.maxWordsPerPhrase)
      return { session: { words, phrases, manualSplitWordIndices } }
    })
  },

  addPhrase: (afterPhraseIndex) => {
    set((state) => {
      if (!state.session) return state

      // Push undo snapshot before mutating
      pushUndo(state)

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

      const phrases = buildSessionPhrases(words, manualSplitWordIndices, state.maxWordsPerPhrase)
      return { session: { words, phrases, manualSplitWordIndices } }
    })
  },

  deleteWord: (wordIndex) => {
    set((state) => {
      if (!state.session) return state
      if (wordIndex < 0 || wordIndex >= state.session.words.length) return state
      // Don't allow deleting the last word entirely
      if (state.session.words.length <= 1) return state

      // Push undo snapshot before mutating
      pushUndo(state)

      const words = state.session.words.filter((_, i) => i !== wordIndex)

      // Shift manual split indices
      const manualSplitWordIndices = new Set<number>()
      for (const idx of state.session.manualSplitWordIndices) {
        if (idx === wordIndex) continue // remove split at deleted word
        manualSplitWordIndices.add(idx > wordIndex ? idx - 1 : idx)
      }

      const phrases = buildSessionPhrases(words, manualSplitWordIndices, state.maxWordsPerPhrase)
      return { session: { words, phrases, manualSplitWordIndices } }
    })
  },

  updatePhraseText: (phraseIndex, newWords) => {
    set((state) => {
      if (!state.session) return state
      const phrase = state.session.phrases[phraseIndex]
      if (!phrase || phrase.words.length === 0) return state

      // Push undo snapshot before mutating
      pushUndo(state)

      const oldWords = phrase.words
      const phraseStart = oldWords[0].start
      const phraseEnd = oldWords[oldWords.length - 1].end
      const phraseDuration = phraseEnd - phraseStart

      // Compute global offset of this phrase's first word
      let globalOffset = 0
      for (let i = 0; i < phraseIndex; i++) {
        globalOffset += state.session.phrases[i].words.length
      }

      const newWordCount = newWords.length
      const oldWordCount = oldWords.length

      // Build updated SessionWords: distribute timestamps evenly across the phrase window
      let updatedPhraseWords: SessionWord[]

      if (newWordCount === oldWordCount) {
        // Same word count: update text only, keep original timestamps
        updatedPhraseWords = oldWords.map((w, i) => ({
          ...w,
          word: newWords[i],
        }))
      } else {
        // Different word count: redistribute timestamps evenly
        const step = phraseDuration / newWordCount
        updatedPhraseWords = newWords.map((text, i) => ({
          word: text,
          start: phraseStart + i * step,
          end: phraseStart + (i + 1) * step,
          confidence: 1,
          speaker: oldWords[0].speaker, // inherit speaker from first word
        }))
      }

      // Replace the words in the flat words array
      const words = [...state.session.words]
      words.splice(globalOffset, oldWordCount, ...updatedPhraseWords)

      // Adjust manual split indices for word count change
      const delta = newWordCount - oldWordCount
      const manualSplitWordIndices = new Set<number>()
      for (const idx of state.session.manualSplitWordIndices) {
        if (idx >= globalOffset && idx < globalOffset + oldWordCount) {
          // This split is inside the edited phrase — remove it (phrase structure may change)
          continue
        }
        if (idx >= globalOffset + oldWordCount) {
          // This split is after the edited phrase — shift by delta
          manualSplitWordIndices.add(idx + delta)
        } else {
          manualSplitWordIndices.add(idx)
        }
      }

      // Preserve the phrase boundary at the start of this phrase (if it was manual)
      if (phrase.isManualSplit && phraseIndex > 0) {
        manualSplitWordIndices.add(globalOffset)
      }

      const phrases = buildSessionPhrases(words, manualSplitWordIndices, state.maxWordsPerPhrase)
      return { session: { words, phrases, manualSplitWordIndices } }
    })
  },

  applySrtPhrase: (phraseIndex, replacementWords) =>
    set((state) => {
      if (!state.session) return state
      pushUndo(state)

      const phrase = state.session.phrases[phraseIndex]
      if (!phrase) return state

      // Find the global index of the first word in this phrase
      let firstGlobalIdx = 0
      for (let p = 0; p < phraseIndex; p++) {
        firstGlobalIdx += state.session.phrases[p].words.length
      }
      const phraseWordCount = phrase.words.length

      const newWords = [
        ...state.session.words.slice(0, firstGlobalIdx),
        ...replacementWords,
        ...state.session.words.slice(firstGlobalIdx + phraseWordCount),
      ]

      // Adjust manual split indices: shift indices after the replacement zone
      const delta = replacementWords.length - phraseWordCount
      const newManualSplits = new Set<number>()
      for (const idx of state.session.manualSplitWordIndices) {
        if (idx < firstGlobalIdx) {
          newManualSplits.add(idx)
        } else if (idx >= firstGlobalIdx + phraseWordCount) {
          newManualSplits.add(idx + delta)
        }
        // manual splits inside the replaced range are dropped
      }

      const phrases = buildSessionPhrases(newWords, newManualSplits, state.maxWordsPerPhrase)
      return { session: { ...state.session, words: newWords, phrases, manualSplitWordIndices: newManualSplits } }
    }),

  setPhraseLinger: (phraseIndex, lingerSec) => {
    set((state) => {
      if (!state.session) return state
      const phrase = state.session.phrases[phraseIndex]
      if (!phrase) return state

      // Push undo snapshot before mutating
      pushUndo(state)

      const phrases = state.session.phrases.map((p, i) =>
        i === phraseIndex ? { ...p, lingerDuration: lingerSec } : p
      )
      return { session: { ...state.session, phrases } }
    })
  },

  resetSession: () => {
    set((state) => {
      if (!state.original) return state
      const words: SessionWord[] = state.original.words.map((w) => ({ ...w }))
      const phrases = buildSessionPhrases(words, new Set(), state.maxWordsPerPhrase)
      // Re-initialize speakerNames from original transcript
      const uniqueSpeakers = new Set<string>()
      for (const w of words) { if (w.speaker) uniqueSpeakers.add(w.speaker) }
      const speakerNames: Record<string, string> = {}
      for (const s of uniqueSpeakers) { speakerNames[s] = s }
      return { session: { words, phrases, manualSplitWordIndices: new Set() }, speakerNames }
    })
  },

  setStyle: (partial) => {
    set((state) => {
      pushUndo(state)
      return { style: { ...state.style, ...partial } }
    })
  },

  setMaxWordsPerPhrase: (n) => {
    set((state) => {
      if (!state.session) return state
      pushUndo(state)
      const phrases = buildSessionPhrases(state.session.words, state.session.manualSplitWordIndices, n)
      return {
        maxWordsPerPhrase: n,
        session: { ...state.session, phrases },
      }
    })
  },

  setSpeakerStyle: (speakerId, override) => {
    set((state) => {
      pushUndo(state)
      return {
        speakerStyles: {
          ...state.speakerStyles,
          [speakerId]: { ...state.speakerStyles[speakerId], ...override },
        }
      }
    })
  },

  clearSpeakerStyle: (speakerId) => {
    set((state) => {
      pushUndo(state)
      const speakerStyles = { ...state.speakerStyles }
      delete speakerStyles[speakerId]
      return { speakerStyles }
    })
  },

  reset: () => set({ jobId: null, original: null, videoMetadata: null, session: null, style: DEFAULT_STYLE, maxWordsPerPhrase: 8, speakerNames: {}, speakerStyles: {}, activeAnimationPresetId: null, phraseAnimationPresetIds: {} }),

  renameSpeaker: (speakerId, displayName) => {
    set((state) => {
      pushUndo(state)
      return {
        speakerNames: { ...state.speakerNames, [speakerId]: displayName }
      }
    })
  },

  reassignWordSpeaker: (wordIndex, speakerId) => {
    set((state) => {
      if (!state.session) return state
      const word = state.session.words[wordIndex]
      if (!word) return state

      // Push undo snapshot before mutating
      pushUndo(state)

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

  reassignPhraseSpeaker: (phraseIndex, speakerId) => {
    set((state) => {
      if (!state.session) return state
      const phrase = state.session.phrases[phraseIndex]
      if (!phrase) return state

      pushUndo(state)

      // Compute global word offset for this phrase
      let globalOffset = 0
      for (let i = 0; i < phraseIndex; i++) {
        globalOffset += state.session.phrases[i].words.length
      }

      // Update all words in this phrase in the flat words array
      const words = state.session.words.map((w, i) =>
        i >= globalOffset && i < globalOffset + phrase.words.length
          ? { ...w, speaker: speakerId }
          : w
      )

      // Update phrases: only the target phrase changes
      const phrases = state.session.phrases.map((p, i) => {
        if (i !== phraseIndex) return p
        const updatedWords = p.words.map((pw) => ({ ...pw, speaker: speakerId }))
        return { ...p, words: updatedWords, dominantSpeaker: speakerId }
      })

      // Ensure the new speaker is in speakerNames
      const speakerNames = state.speakerNames[speakerId]
        ? state.speakerNames
        : { ...state.speakerNames, [speakerId]: speakerId }

      return { session: { ...state.session, words, phrases }, speakerNames }
    })
  },

  deleteSpeaker: (speakerId, reassignTo) => {
    set((state) => {
      if (!state.session) return state

      pushUndo(state)

      // Reassign all words from deleted speaker to target speaker
      const words = state.session.words.map((w) =>
        w.speaker === speakerId ? { ...w, speaker: reassignTo } : w
      )

      // Rebuild phrases with updated speakers
      const phrases = buildSessionPhrases(words, state.session.manualSplitWordIndices, state.maxWordsPerPhrase)

      // Remove deleted speaker from speakerNames and speakerStyles
      const speakerNames = { ...state.speakerNames }
      delete speakerNames[speakerId]
      // Ensure reassignTo is in speakerNames
      if (!speakerNames[reassignTo]) speakerNames[reassignTo] = reassignTo

      const speakerStyles = { ...state.speakerStyles }
      delete speakerStyles[speakerId]

      return {
        session: { ...state.session, words, phrases },
        speakerNames,
        speakerStyles,
      }
    })
  },

  deletePhrase: (phraseIndex) => {
    set((state) => {
      if (!state.session) return state
      const phrase = state.session.phrases[phraseIndex]
      if (!phrase || phrase.words.length === 0) return state
      // Don't allow deleting the last phrase if it would leave no words
      if (state.session.words.length <= phrase.words.length) return state

      pushUndo(state)

      // Compute global word offset for this phrase
      let globalOffset = 0
      for (let i = 0; i < phraseIndex; i++) {
        globalOffset += state.session.phrases[i].words.length
      }

      const deleteCount = phrase.words.length
      const words = state.session.words.filter(
        (_, i) => i < globalOffset || i >= globalOffset + deleteCount
      )

      // Adjust manual split indices
      const manualSplitWordIndices = new Set<number>()
      for (const idx of state.session.manualSplitWordIndices) {
        if (idx >= globalOffset && idx < globalOffset + deleteCount) continue
        if (idx >= globalOffset + deleteCount) {
          manualSplitWordIndices.add(idx - deleteCount)
        } else {
          manualSplitWordIndices.add(idx)
        }
      }

      const phrases = buildSessionPhrases(words, manualSplitWordIndices, state.maxWordsPerPhrase)
      return { session: { words, phrases, manualSplitWordIndices } }
    })
  },

  addPhraseAtTime: (timeSec, speakerId) => {
    set((state) => {
      if (!state.session) return state

      pushUndo(state)

      const DURATION = 0.5
      const newWord: SessionWord = {
        word: '...',
        start: timeSec,
        end: timeSec + DURATION,
        confidence: 1,
        speaker: speakerId,
      }

      // Find insertion point in sorted words array (by start time)
      let insertIdx = 0
      for (let i = 0; i < state.session.words.length; i++) {
        if (state.session.words[i].start <= timeSec) {
          insertIdx = i + 1
        } else {
          break
        }
      }

      // Cap end time to not overlap with the next word
      if (insertIdx < state.session.words.length) {
        newWord.end = Math.min(newWord.end, state.session.words[insertIdx].start)
      }

      const words = [...state.session.words]
      words.splice(insertIdx, 0, newWord)

      // Shift manual split indices and add splits to isolate the new phrase
      const manualSplitWordIndices = new Set<number>()
      for (const idx of state.session.manualSplitWordIndices) {
        manualSplitWordIndices.add(idx >= insertIdx ? idx + 1 : idx)
      }
      // Force phrase boundary before the new word
      if (insertIdx > 0) manualSplitWordIndices.add(insertIdx)
      // Force phrase boundary after the new word
      if (insertIdx < words.length - 1) manualSplitWordIndices.add(insertIdx + 1)

      const phrases = buildSessionPhrases(words, manualSplitWordIndices, state.maxWordsPerPhrase)
      return { session: { words, phrases, manualSplitWordIndices } }
    })
  },

  shiftPhrase: (phraseIndex, deltaSec) => {
    set((state) => {
      if (!state.session) return state
      const phrase = state.session.phrases[phraseIndex]
      if (!phrase || phrase.words.length === 0) return state

      // Compute global word offset
      let globalOffset = 0
      for (let i = 0; i < phraseIndex; i++) {
        globalOffset += state.session.phrases[i].words.length
      }
      const wordCount = phrase.words.length

      // Clamp delta: phrase start can't go below 0
      const phraseStart = phrase.words[0].start
      const clampedDelta = Math.max(-phraseStart, deltaSec)

      // Clamp: can't overlap with previous phrase's last word
      let minStart = 0
      if (globalOffset > 0) {
        minStart = state.session.words[globalOffset - 1].end
      }
      const finalDelta = Math.max(minStart - phraseStart, clampedDelta)

      // Clamp: can't overlap with next phrase's first word
      const lastIdx = globalOffset + wordCount - 1
      if (lastIdx < state.session.words.length - 1) {
        const nextStart = state.session.words[lastIdx + 1].start
        const phraseEnd = phrase.words[wordCount - 1].end
        const maxDelta = nextStart - phraseEnd
        if (finalDelta > maxDelta) return state // would overlap
      }

      if (Math.abs(finalDelta) < 0.001) return state

      pushUndo(state)

      // Shift all words in this phrase
      const words = state.session.words.map((w, i) =>
        i >= globalOffset && i < globalOffset + wordCount
          ? { ...w, start: w.start + finalDelta, end: w.end + finalDelta }
          : w
      )

      // Rebuild phrases (timestamps changed)
      const phrases = buildSessionPhrases(words, state.session.manualSplitWordIndices, state.maxWordsPerPhrase)
      return { session: { ...state.session, words, phrases } }
    })
  },

  shiftAllWords: (deltaSec) => {
    set((state) => {
      if (!state.session || state.session.words.length === 0) return state

      // Clamp delta so no word's start goes below 0
      const earliestStart = Math.min(...state.session.words.map((w) => w.start))
      const clampedDelta = Math.max(deltaSec, -earliestStart)

      if (Math.abs(clampedDelta) < 0.001) return state

      pushUndo(state)

      const words = state.session.words.map((w) => ({
        ...w,
        start: w.start + clampedDelta,
        end: w.end + clampedDelta,
      }))

      const phrases = buildSessionPhrases(words, state.session.manualSplitWordIndices, state.maxWordsPerPhrase)
      return { session: { ...state.session, words, phrases } }
    })
  },

  applyWordShift: (baselineWords, deltaSec) => {
    set((state) => {
      if (!state.session) return state

      const earliestStart = Math.min(...baselineWords.map((w) => w.start))
      const clampedDelta = Math.max(deltaSec, -earliestStart)

      const words = baselineWords.map((w) => ({
        ...w,
        start: w.start + clampedDelta,
        end: w.end + clampedDelta,
      }))

      const phrases = buildSessionPhrases(words, state.session.manualSplitWordIndices, state.maxWordsPerPhrase)
      return { session: { ...state.session, words, phrases } }
    })
  },

  setPhraseStyle: (phraseIndex, override) => {
    set((state) => {
      if (!state.session) return state
      const phrase = state.session.phrases[phraseIndex]
      if (!phrase) return state

      pushUndo(state)

      const phrases = state.session.phrases.map((p, i) =>
        i === phraseIndex
          ? { ...p, styleOverride: { ...(p.styleOverride as PhraseStyleOverride | undefined), ...override } }
          : p
      )
      return { session: { ...state.session, phrases } }
    })
  },

  clearPhraseStyle: (phraseIndex) => {
    set((state) => {
      if (!state.session) return state

      pushUndo(state)

      const phrases = state.session.phrases.map((p, i) =>
        i === phraseIndex ? { ...p, styleOverride: undefined } : p
      )
      return { session: { ...state.session, phrases } }
    })
  },

  setActiveAnimationPresetId: (id) => {
    set((state) => {
      pushUndo(state)
      return { activeAnimationPresetId: id }
    })
  },

  setPhraseAnimationPresetId: (phraseIndex, presetId) => {
    set((state) => {
      pushUndo(state)
      const phraseAnimationPresetIds = { ...state.phraseAnimationPresetIds }
      if (presetId === null) {
        delete phraseAnimationPresetIds[phraseIndex]
      } else {
        phraseAnimationPresetIds[phraseIndex] = presetId
      }
      return { phraseAnimationPresetIds }
    })
  },

  /**
   * Merge multiple phrases (by index) into a single phrase placed at the
   * position of the lowest selected index. Non-selected phrases are preserved
   * in their original order. Pushes exactly one undo snapshot.
   */
  mergePhrases: (indices) => {
    set((state) => {
      if (!state.session) return state
      if (indices.length < 2) return state // no-op, no undo push

      pushUndo(state)

      const phrases = state.session.phrases
      // Sort and deduplicate indices
      const sorted = [...new Set(indices)].sort((a, b) => a - b)

      // Collect all words from selected phrases in order
      const mergedWords = sorted.flatMap((i) => phrases[i]?.words ?? [])

      // Build merged phrase at sorted[0]
      const mergedPhrase: SessionPhrase = {
        words: mergedWords,
        isManualSplit: phrases[sorted[0]].isManualSplit,
        dominantSpeaker: computeDominantSpeaker(mergedWords),
      }

      // Build new phrases: replace sorted[0] with merged, remove all other selected indices
      const newPhrases: SessionPhrase[] = []
      for (let i = 0; i < phrases.length; i++) {
        if (i === sorted[0]) {
          newPhrases.push(mergedPhrase)
        } else if (!sorted.includes(i)) {
          newPhrases.push(phrases[i])
        }
        // i in sorted but !== sorted[0] → dropped (merged into first)
      }

      // Rebuild flat words array from new phrases
      const newWords = newPhrases.flatMap((p) => p.words)

      // Rebuild manualSplitWordIndices from scratch based on new phrase boundaries
      // Mark the start of each phrase (except the first) as a potential manual split
      // only if it was originally a manual split
      const newManualSplitWordIndices = new Set<number>()
      let offset = 0
      for (let i = 0; i < newPhrases.length; i++) {
        if (i > 0 && newPhrases[i].isManualSplit) {
          newManualSplitWordIndices.add(offset)
        }
        offset += newPhrases[i].words.length
      }

      return {
        session: {
          ...state.session,
          words: newWords,
          phrases: newPhrases,
          manualSplitWordIndices: newManualSplitWordIndices,
        },
      }
    })
  },

  /**
   * Delete multiple phrases by index. Refuses to delete all phrases.
   * Pushes exactly one undo snapshot.
   */
  deletePhrases: (indices) => {
    set((state) => {
      if (!state.session) return state
      if (indices.length === 0) return state

      const phrases = state.session.phrases
      const sorted = [...new Set(indices)].sort((a, b) => a - b)

      // Calculate how many words would remain
      const wordsToDelete = sorted.reduce((acc, i) => acc + (phrases[i]?.words.length ?? 0), 0)
      const wordsRemaining = state.session.words.length - wordsToDelete
      if (wordsRemaining <= 0) {
        // Refuse to delete all phrases — keep at least one
        return state
      }

      pushUndo(state)

      // Build new flat words array by excluding words in deleted phrases
      // Compute global offsets for each phrase
      const phraseOffsets: number[] = []
      let off = 0
      for (const p of phrases) {
        phraseOffsets.push(off)
        off += p.words.length
      }

      // Build a Set of global word indices to exclude
      const excludedWordIndices = new Set<number>()
      for (const idx of sorted) {
        const phraseStart = phraseOffsets[idx] ?? 0
        const phraseLen = phrases[idx]?.words.length ?? 0
        for (let k = 0; k < phraseLen; k++) {
          excludedWordIndices.add(phraseStart + k)
        }
      }

      const newWords = state.session.words.filter((_, i) => !excludedWordIndices.has(i))

      // Build a mapping from old global index to new global index for manual splits
      const newManualSplitWordIndices = new Set<number>()
      const indexMap = new Map<number, number>()
      let newIdx = 0
      for (let i = 0; i < state.session.words.length; i++) {
        if (!excludedWordIndices.has(i)) {
          indexMap.set(i, newIdx)
          newIdx++
        }
      }

      for (const splitIdx of state.session.manualSplitWordIndices) {
        if (excludedWordIndices.has(splitIdx)) continue // split at a deleted word, remove
        const mapped = indexMap.get(splitIdx)
        if (mapped !== undefined && mapped > 0) {
          newManualSplitWordIndices.add(mapped)
        }
      }

      const newPhrases = buildSessionPhrases(newWords, newManualSplitWordIndices, state.maxWordsPerPhrase)
      return {
        session: {
          ...state.session,
          words: newWords,
          phrases: newPhrases,
          manualSplitWordIndices: newManualSplitWordIndices,
        },
      }
    })
  },

  /**
   * Duplicate a phrase by index, inserting the clone immediately after the source.
   * Pushes one undo snapshot.
   */
  duplicatePhrase: (phraseIndex) => {
    set((state) => {
      if (!state.session) return state
      const phrase = state.session.phrases[phraseIndex]
      if (!phrase) return state

      pushUndo(state)

      // Clone the phrase directly to preserve phrase structure
      const clonedPhrase: SessionPhrase = {
        words: structuredClone(phrase.words),
        isManualSplit: true, // clone is always a manual boundary
        dominantSpeaker: phrase.dominantSpeaker,
        lingerDuration: phrase.lingerDuration,
        styleOverride: phrase.styleOverride ? structuredClone(phrase.styleOverride) : undefined,
      }

      // Insert clone after the source phrase
      const newPhrases = [...state.session.phrases]
      newPhrases.splice(phraseIndex + 1, 0, clonedPhrase)

      // Rebuild flat words from new phrases
      const newWords = newPhrases.flatMap((p) => p.words)

      // Rebuild manualSplitWordIndices from phrase boundaries
      const newManualSplitWordIndices = new Set<number>()
      let offset = 0
      for (let i = 0; i < newPhrases.length; i++) {
        if (i > 0 && newPhrases[i].isManualSplit) {
          newManualSplitWordIndices.add(offset)
        }
        offset += newPhrases[i].words.length
      }

      return { session: { ...state.session, words: newWords, phrases: newPhrases, manualSplitWordIndices: newManualSplitWordIndices } }
    })
  },

  /**
   * Move a phrase one position up (swap with predecessor).
   * No-op if phraseIndex === 0. Pushes one undo snapshot (unless no-op).
   * Directly swaps in the phrases array to preserve phrase structure.
   */
  movePhraseUp: (phraseIndex) => {
    set((state) => {
      if (!state.session) return state
      if (phraseIndex <= 0) return state // no-op

      pushUndo(state)

      const phrases = [...state.session.phrases]
      // Swap phrases[phraseIndex] and phrases[phraseIndex - 1]
      const temp = phrases[phraseIndex - 1]
      phrases[phraseIndex - 1] = phrases[phraseIndex]
      phrases[phraseIndex] = temp

      const newWords = phrases.flatMap((p) => p.words)

      // Rebuild manualSplitWordIndices from phrase boundaries
      const newManualSplitWordIndices = new Set<number>()
      let offset = 0
      for (let i = 0; i < phrases.length; i++) {
        if (i > 0 && phrases[i].isManualSplit) {
          newManualSplitWordIndices.add(offset)
        }
        offset += phrases[i].words.length
      }

      return { session: { ...state.session, words: newWords, phrases, manualSplitWordIndices: newManualSplitWordIndices } }
    })
  },

  /**
   * Move a phrase one position down (swap with successor).
   * No-op if phraseIndex is the last phrase. Pushes one undo snapshot (unless no-op).
   * Directly swaps in the phrases array to preserve phrase structure.
   */
  movePhraseDown: (phraseIndex) => {
    set((state) => {
      if (!state.session) return state
      if (phraseIndex >= state.session.phrases.length - 1) return state // no-op

      pushUndo(state)

      const phrases = [...state.session.phrases]
      // Swap phrases[phraseIndex] and phrases[phraseIndex + 1]
      const temp = phrases[phraseIndex]
      phrases[phraseIndex] = phrases[phraseIndex + 1]
      phrases[phraseIndex + 1] = temp

      const newWords = phrases.flatMap((p) => p.words)

      // Rebuild manualSplitWordIndices from phrase boundaries
      const newManualSplitWordIndices = new Set<number>()
      let offset = 0
      for (let i = 0; i < phrases.length; i++) {
        if (i > 0 && phrases[i].isManualSplit) {
          newManualSplitWordIndices.add(offset)
        }
        offset += phrases[i].words.length
      }

      return { session: { ...state.session, words: newWords, phrases, manualSplitWordIndices: newManualSplitWordIndices } }
    })
  },
}))
