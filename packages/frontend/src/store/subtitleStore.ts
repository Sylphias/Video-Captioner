import { create } from 'zustand'
import type { Transcript, VideoMetadata } from '@eigen/shared-types'
import { getFontFamily, type StyleProps, type SpeakerStyleOverride } from '@eigen/remotion-composition'
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
  maxWordsPerPhrase: number             // max words per auto-grouped phrase (default 5)
  speakerNames: Record<string, string>               // maps raw speaker IDs to display names
  speakerStyles: Record<string, SpeakerStyleOverride> // per-speaker style overrides
  activeAnimationPresetId: string | null              // globally active animation preset ID (Entry/Exit/Hold)
  activeHighlightPresetId: string | null             // globally active highlight preset ID
  phraseAnimationPresetIds: Record<number, string>    // maps phrase index to override preset ID
  laneCount: number                                   // number of available lanes (min 1)
  laneLocks: Record<number, boolean>                   // per-lane lock state (locked lanes don't move when others are dragged)
  phraseLaneOverrides: Record<number, number>         // phrase index → forced lane number
  additionalSpeakerCount: number                       // extra custom speaker rows (0–10)
  speakerHighlightDisabled: Record<string, boolean>    // per-speaker highlight disable
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
  setActiveHighlightPresetId: (id: string | null) => void
  setPhraseAnimationPresetId: (phraseIndex: number, presetId: string | null) => void
  setLaneCount: (count: number) => void
  setPhraseLane: (phraseIndex: number, laneNumber: number | null) => void
  clearAllLaneOverrides: () => void
  applySrtPhrase: (phraseIndex: number, replacementWords: SessionWord[]) => void
  mergePhrases: (indices: number[]) => void
  deletePhrases: (indices: number[]) => void
  duplicatePhrase: (phraseIndex: number) => void
  movePhraseUp: (phraseIndex: number) => void
  movePhraseDown: (phraseIndex: number) => void
  replaceAllPhraseTexts: (replacements: Array<{ phraseIndex: number; newWords: string[] }>) => void
  setAdditionalSpeakerCount: (count: number) => void
  setPhraseHighlightDisabled: (phraseIndex: number, disabled: boolean) => void
  setSpeakerHighlightDisabled: (speakerId: string, disabled: boolean) => void
}

const DEFAULT_STYLE: StyleProps = {
  highlightColor: '#FFFF00',
  baseColor: '#FFFFFF',
  fontSize: 90,
  fontFamily: getFontFamily('LilitaOne'),
  fontWeight: 700,
  strokeColor: '#000000',
  strokeWidth: 2,
  shadowColor: '#000000',
  shadowOffsetX: 0,
  shadowOffsetY: 2,
  shadowBlur: 4,
  letterSpacing: 0,
  wordSpacing: 0,
  verticalPosition: 80,
  lingerDuration: 1.0,
  laneGap: 8,
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
  activeHighlightPresetId: string | null
  phraseAnimationPresetIds: Record<number, string>
  laneCount: number
  phraseLaneOverrides: Record<number, number>
  additionalSpeakerCount: number
  speakerHighlightDisabled: Record<string, boolean>
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
    activeHighlightPresetId: state.activeHighlightPresetId,
    phraseAnimationPresetIds: { ...state.phraseAnimationPresetIds },
    laneCount: state.laneCount,
    phraseLaneOverrides: { ...state.phraseLaneOverrides },
    additionalSpeakerCount: state.additionalSpeakerCount,
    speakerHighlightDisabled: { ...state.speakerHighlightDisabled },
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
  activeHighlightPresetId: string | null
  phraseAnimationPresetIds: Record<number, string>
  laneCount: number
  phraseLaneOverrides: Record<number, number>
  additionalSpeakerCount: number
  speakerHighlightDisabled: Record<string, boolean>
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
      maxWordsPerPhrase: snapshot.maxWordsPerPhrase ?? 5,
      speakerNames: { ...snapshot.speakerNames },
      speakerStyles: structuredClone(snapshot.speakerStyles) as unknown as Record<string, SpeakerStyleOverride>,
      activeAnimationPresetId: snapshot.activeAnimationPresetId ?? null,
      activeHighlightPresetId: snapshot.activeHighlightPresetId ?? null,
      phraseAnimationPresetIds: snapshot.phraseAnimationPresetIds ?? {},
      laneCount: snapshot.laneCount ?? 2,
      phraseLaneOverrides: snapshot.phraseLaneOverrides ?? {},
      additionalSpeakerCount: snapshot.additionalSpeakerCount ?? 0,
      speakerHighlightDisabled: snapshot.speakerHighlightDisabled ?? {},
    }
  })
}

export const useSubtitleStore = create<SubtitleStore>()((set, get) => ({
  jobId: null,
  original: null,
  videoMetadata: null,
  session: null,
  style: DEFAULT_STYLE,
  maxWordsPerPhrase: 5,
  speakerNames: {},
  speakerStyles: {},
  activeAnimationPresetId: null,
  activeHighlightPresetId: null,
  phraseAnimationPresetIds: {},
  laneCount: 2,
  laneLocks: {},
  phraseLaneOverrides: {},
  additionalSpeakerCount: 0,
  speakerHighlightDisabled: {},

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

      // Timestamp validation (basic sanity)
      if ('start' in patch && patch.start! >= (patch.end ?? word.end)) return state
      if ('end' in patch && patch.end! <= (patch.start ?? word.start)) return state

      // Push undo snapshot before mutating
      pushUndo(state)

      const words = [...state.session.words]

      // Apply the patch to the target word
      words[wordIndex] = { ...word, ...patch }

      // Cascade: push neighbors to prevent overlap (same speaker only)
      // Different speakers can overlap (simultaneous speech)
      if ('end' in patch && wordIndex < words.length - 1) {
        const next = words[wordIndex + 1]
        if (patch.end! > next.start && next.speaker === word.speaker) {
          words[wordIndex + 1] = { ...next, start: patch.end! }
        }
      }
      if ('start' in patch && wordIndex > 0) {
        const prev = words[wordIndex - 1]
        if (patch.start! < prev.end && prev.speaker === word.speaker) {
          words[wordIndex - 1] = { ...prev, end: patch.start! }
        }
      }

      // Update the word in-place within its existing phrase structure.
      // Never call buildSessionPhrases here — it runs auto-grouping which
      // reshuffles phrase boundaries based on gaps/punctuation.
      // Find which phrase contains this word by global offset and update it.
      let remaining = wordIndex
      const phrases = state.session.phrases.map((p) => {
        if (remaining < 0 || remaining >= p.words.length) {
          remaining -= p.words.length
          return p
        }
        // This phrase contains the updated word
        const updatedWords = p.words.map((pw, wi) => {
          if (wi === remaining) return words[wordIndex]
          // Also update cascaded neighbor within the same phrase
          const globalIdx = wordIndex - remaining + wi
          return words[globalIdx]
        })
        remaining = -1 // mark as found
        return { ...p, words: updatedWords }
      })

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
        word: '',
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
      } else if (afterPhraseIndex < 0) {
        // Inserting before the first phrase
        const firstPhrase = state.session.phrases[0]
        const firstWord = firstPhrase.words[0]
        newEnd = firstWord ? firstWord.start : DEFAULT_WORD_DURATION
        newStart = Math.max(0, newEnd - DEFAULT_WORD_DURATION)
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

      // Inherit speaker from the previous phrase
      const prevPhrase = afterPhraseIndex >= 0 && afterPhraseIndex < state.session.phrases.length
        ? state.session.phrases[afterPhraseIndex]
        : null
      const prevSpeaker = prevPhrase?.dominantSpeaker ?? prevPhrase?.words[0]?.speaker

      const newWord: SessionWord = {
        word: '',
        start: newStart,
        end: newEnd,
        confidence: 1,
        ...(prevSpeaker ? { speaker: prevSpeaker } : {}),
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
          // This split is inside the edited phrase — remove it
          continue
        }
        if (idx >= globalOffset + oldWordCount) {
          manualSplitWordIndices.add(idx + delta)
        } else {
          manualSplitWordIndices.add(idx)
        }
      }

      // Preserve the phrase boundary at the start of this phrase (if it was manual)
      if (phrase.isManualSplit && phraseIndex > 0) {
        manualSplitWordIndices.add(globalOffset)
      }

      // Update only the target phrase in-place — don't rebuild all phrases
      // (rebuilding runs auto-grouping which can reshuffle phrase boundaries)
      const updatedPhrase: SessionPhrase = {
        ...phrase,
        words: updatedPhraseWords,
        dominantSpeaker: computeDominantSpeaker(updatedPhraseWords),
      }
      const phrases = [...state.session.phrases]
      phrases[phraseIndex] = updatedPhrase

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

  reset: () => set({ jobId: null, original: null, videoMetadata: null, session: null, style: DEFAULT_STYLE, maxWordsPerPhrase: 5, speakerNames: {}, speakerStyles: {}, activeAnimationPresetId: null, activeHighlightPresetId: null, phraseAnimationPresetIds: {}, laneCount: 2, phraseLaneOverrides: {} }),

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
      if (!phrase) return state

      // Empty phrase (no words): just remove it from the phrases array
      if (phrase.words.length === 0) {
        pushUndo(state)
        const phrases = [...state.session.phrases]
        phrases.splice(phraseIndex, 1)
        return { session: { ...state.session, phrases } }
      }

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

      // Remove phrase in-place — don't rebuild all phrases via buildSessionPhrases
      // (rebuilding runs auto-grouping which can reshuffle phrase boundaries
      // and race with deferred blur updates from the text editor)
      const phrases = [...state.session.phrases]
      phrases.splice(phraseIndex, 1)
      return { session: { words, phrases, manualSplitWordIndices } }
    })
  },

  addPhraseAtTime: (timeSec, speakerId) => {
    set((state) => {
      if (!state.session) return state

      pushUndo(state)

      const DURATION = 0.5
      const newWord: SessionWord = {
        word: '',
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

      // Clamp delta: phrase start can't go below 0
      const phraseStart = phrase.words[0].start
      const finalDelta = Math.max(-phraseStart, deltaSec)

      if (Math.abs(finalDelta) < 0.001) return state

      pushUndo(state)

      // Extract phrase word groups with their manual-split flags and speaker
      const groups: { words: SessionWord[]; isManualSplit: boolean; isMoved: boolean; speaker?: string }[] = []
      for (let pi = 0; pi < state.session.phrases.length; pi++) {
        const p = state.session.phrases[pi]
        groups.push({ words: p.words.map(w => ({ ...w })), isManualSplit: p.isManualSplit, isMoved: pi === phraseIndex, speaker: p.dominantSpeaker })
      }

      // Shift the moved phrase's words
      const movedGroup = groups[phraseIndex]
      for (const w of movedGroup.words) {
        w.start += finalDelta
        w.end += finalDelta
      }

      // Sort phrase groups by their first word's start time (chronological reorder)
      groups.sort((a, b) => {
        if (a.words.length === 0) return 1
        if (b.words.length === 0) return -1
        return a.words[0].start - b.words[0].start
      })

      // Snap moved phrase if it overlaps a neighbor
      const movedIdx = groups.indexOf(movedGroup)
      const movedDuration = movedGroup.words[movedGroup.words.length - 1].end - movedGroup.words[0].start

      // Check overlap with previous same-speaker phrase — snap to its end
      // Different speakers can overlap (simultaneous speech)
      if (movedIdx > 0) {
        for (let pi = movedIdx - 1; pi >= 0; pi--) {
          const prev = groups[pi]
          if (prev.words.length === 0) continue
          if (prev.speaker !== movedGroup.speaker) continue
          const prevEnd = prev.words[prev.words.length - 1].end
          const movedStart = movedGroup.words[0].start
          if (movedStart < prevEnd) {
            const snap = prevEnd - movedStart
            for (const w of movedGroup.words) {
              w.start += snap
              w.end += snap
            }
          }
          break
        }
      }

      // Check overlap with next same-speaker phrase — snap to its front
      if (movedIdx < groups.length - 1) {
        for (let pi = movedIdx + 1; pi < groups.length; pi++) {
          const next = groups[pi]
          if (next.words.length === 0) continue
          if (next.speaker !== movedGroup.speaker) continue
          const nextStart = next.words[0].start
          const movedEnd = movedGroup.words[movedGroup.words.length - 1].end
          if (movedEnd > nextStart) {
            const snapStart = Math.max(0, nextStart - movedDuration)
            const shift = snapStart - movedGroup.words[0].start
            for (const w of movedGroup.words) {
              w.start += shift
              w.end += shift
            }
          }
          break
        }
      }

      // Flatten back into words array and rebuild phrases directly from groups
      // (don't use buildSessionPhrases — auto-grouping reshuffles boundaries)
      const words: SessionWord[] = []
      const manualSplitWordIndices = new Set<number>()
      const phrases: SessionPhrase[] = []
      for (const group of groups) {
        if (group.isManualSplit && words.length > 0) {
          manualSplitWordIndices.add(words.length)
        }
        words.push(...group.words)
        if (group.words.length > 0) {
          phrases.push({
            words: group.words,
            isManualSplit: group.isManualSplit,
            dominantSpeaker: group.speaker,
          })
        }
      }

      return { session: { ...state.session, words, phrases, manualSplitWordIndices } }
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

  setActiveHighlightPresetId: (id) => {
    set((state) => {
      pushUndo(state)
      return { activeHighlightPresetId: id }
    })
  },

  setLaneCount: (count) => {
    set((state) => {
      pushUndo(state)
      return { laneCount: Math.max(1, count) }
    })
  },

  setPhraseLane: (phraseIndex, laneNumber) => {
    set((state) => {
      pushUndo(state)
      const phraseLaneOverrides = { ...state.phraseLaneOverrides }
      if (laneNumber === null) {
        delete phraseLaneOverrides[phraseIndex]
      } else {
        phraseLaneOverrides[phraseIndex] = laneNumber
      }
      return { phraseLaneOverrides }
    })
  },

  clearAllLaneOverrides: () => {
    set((state) => {
      pushUndo(state)
      return { phraseLaneOverrides: {} }
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

      // Remove phrases in-place (reverse order to preserve indices)
      const newPhrases = [...state.session.phrases]
      for (let i = sorted.length - 1; i >= 0; i--) {
        newPhrases.splice(sorted[i], 1)
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

  replaceAllPhraseTexts: (replacements) => {
    set((state) => {
      if (!state.session || replacements.length === 0) return state

      // Single undo snapshot for all replacements — user presses Ctrl+Z once to undo all
      pushUndo(state)

      // Process replacements: for each replacement, apply updatePhraseText logic inline
      // without pushing additional undo snapshots (RESEARCH.md Anti-Patterns)
      let { words, manualSplitWordIndices } = state.session

      // Process replacements in reverse order of phraseIndex to keep global indices stable
      const sorted = [...replacements].sort((a, b) => b.phraseIndex - a.phraseIndex)

      // We need to recompute phrases after each replacement since global indices shift
      // Use buildSessionPhrases to track current phrase boundaries
      let phrases = [...state.session.phrases]

      for (const { phraseIndex, newWords } of sorted) {
        const phrase = phrases[phraseIndex]
        if (!phrase || phrase.words.length === 0) continue

        const oldWords = phrase.words
        const phraseStart = oldWords[0].start
        const phraseEnd = oldWords[oldWords.length - 1].end
        const phraseDuration = phraseEnd - phraseStart

        // Compute global offset of this phrase's first word in current words array
        let globalOffset = 0
        for (let i = 0; i < phraseIndex; i++) {
          globalOffset += phrases[i].words.length
        }

        const newWordCount = newWords.length
        const oldWordCount = oldWords.length

        let updatedPhraseWords: SessionWord[]
        if (newWordCount === oldWordCount) {
          updatedPhraseWords = oldWords.map((w, i) => ({ ...w, word: newWords[i] }))
        } else {
          const step = phraseDuration / newWordCount
          updatedPhraseWords = newWords.map((text, i) => ({
            word: text,
            start: phraseStart + i * step,
            end: phraseStart + (i + 1) * step,
            confidence: 1,
            speaker: oldWords[0].speaker,
          }))
        }

        // Replace in flat words array
        const wordsArr = [...words]
        wordsArr.splice(globalOffset, oldWordCount, ...updatedPhraseWords)
        words = wordsArr as SessionWord[]

        // Adjust manual split indices
        const delta = newWordCount - oldWordCount
        const newManualSplits = new Set<number>()
        for (const idx of manualSplitWordIndices) {
          if (idx >= globalOffset && idx < globalOffset + oldWordCount) {
            continue // split inside edited phrase — drop
          }
          if (idx >= globalOffset + oldWordCount) {
            newManualSplits.add(idx + delta)
          } else {
            newManualSplits.add(idx)
          }
        }
        if (phrase.isManualSplit && phraseIndex > 0) {
          newManualSplits.add(globalOffset)
        }
        manualSplitWordIndices = newManualSplits

        // Update phrase in local phrases array to keep globalOffset computation accurate
        phrases = phrases.map((p, i) =>
          i === phraseIndex ? { ...p, words: updatedPhraseWords } : p
        )
      }

      const rebuiltPhrases = buildSessionPhrases(words as SessionWord[], manualSplitWordIndices, state.maxWordsPerPhrase)
      return { session: { words: words as SessionWord[], phrases: rebuiltPhrases, manualSplitWordIndices } }
    })
  },

  setAdditionalSpeakerCount: (count) => {
    set((state) => {
      const clamped = Math.max(0, Math.min(10, count))
      const prev = state.additionalSpeakerCount

      if (clamped === prev) return state
      pushUndo(state)

      const speakerNames = { ...state.speakerNames }

      if (clamped > prev) {
        // Add new custom speaker slots
        for (let i = prev + 1; i <= clamped; i++) {
          const id = `CUSTOM_${i}`
          if (!speakerNames[id]) {
            speakerNames[id] = `FX ${i}`
          }
        }
      } else {
        // Remove custom speaker slots from the top
        for (let i = prev; i > clamped; i--) {
          const id = `CUSTOM_${i}`
          // Reassign orphaned phrases to first remaining speaker
          const firstSpeaker = Object.keys(speakerNames).find(k => k !== id) ?? ''
          if (state.session && firstSpeaker) {
            for (const phrase of state.session.phrases) {
              if (phrase.dominantSpeaker === id) {
                for (const w of phrase.words) {
                  if (w.speaker === id) w.speaker = firstSpeaker
                }
                phrase.dominantSpeaker = firstSpeaker
              }
            }
          }
          delete speakerNames[id]
        }
      }

      return { additionalSpeakerCount: clamped, speakerNames }
    })
  },

  setPhraseHighlightDisabled: (phraseIndex, disabled) => {
    set((state) => {
      if (!state.session) return state
      const phrase = state.session.phrases[phraseIndex]
      if (!phrase) return state

      pushUndo(state)

      const phrases = state.session.phrases.map((p, i) =>
        i === phraseIndex ? { ...p, highlightDisabled: disabled || undefined } : p
      )

      return { session: { ...state.session, phrases } }
    })
  },

  setSpeakerHighlightDisabled: (speakerId, disabled) => {
    set((state) => {
      pushUndo(state)
      const speakerHighlightDisabled = { ...state.speakerHighlightDisabled }
      if (disabled) {
        speakerHighlightDisabled[speakerId] = true
      } else {
        delete speakerHighlightDisabled[speakerId]
      }
      return { speakerHighlightDisabled }
    })
  },
}))
