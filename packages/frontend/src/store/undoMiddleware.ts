import { create } from 'zustand'

/**
 * StateSnapshot captures the undoable parts of the subtitle store.
 * manualSplitWordIndices is stored as an Array (not Set) for clean cloning.
 */
export interface StateSnapshot {
  session: {
    words: Array<{
      word: string
      start: number
      end: number
      confidence: number
      speaker?: string
    }>
    phrases: Array<{
      words: Array<{
        word: string
        start: number
        end: number
        confidence: number
        speaker?: string
      }>
      isManualSplit: boolean
      dominantSpeaker?: string
    }>
    manualSplitWordIndices: number[] // serialized from Set<number>
  } | null
  style: Record<string, unknown>
  maxWordsPerPhrase?: number
  speakerNames: Record<string, string>
  speakerStyles: Record<string, Record<string, unknown>>
  activeAnimationPresetId?: string | null
  activeHighlightPresetId?: string | null
  phraseAnimationPresetIds?: Record<number, string>
  laneCount?: number
  phraseLaneOverrides?: Record<number, number>
}

const MAX_HISTORY = 50

interface UndoStore {
  past: StateSnapshot[]
  future: StateSnapshot[]
  canUndo: boolean
  canRedo: boolean

  /**
   * Push a snapshot onto the past stack (called before a mutating action).
   * Clears the future stack so redo is invalidated.
   */
  pushSnapshot: (snapshot: StateSnapshot) => void

  /**
   * Undo: pop from past (target state to restore), push currentSnapshot to future.
   * Returns the snapshot to restore, or null if nothing to undo.
   */
  undo: (currentSnapshot: StateSnapshot) => StateSnapshot | null

  /**
   * Redo: pop from future (target state to restore), push currentSnapshot to past.
   * Returns the snapshot to restore, or null if nothing to redo.
   */
  redo: (currentSnapshot: StateSnapshot) => StateSnapshot | null
}

export const useUndoStore = create<UndoStore>()((set, get) => ({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,

  pushSnapshot: (snapshot) => {
    set((state) => {
      // Cap at MAX_HISTORY entries (trim oldest)
      const past = [...state.past, snapshot].slice(-MAX_HISTORY)
      return { past, future: [], canUndo: past.length > 0, canRedo: false }
    })
  },

  undo: (currentSnapshot) => {
    const { past } = get()
    if (past.length === 0) return null

    // Target: the last item in past (state before last mutation)
    const target = past[past.length - 1]

    set((state) => {
      const newPast = state.past.slice(0, -1)
      // Push current into future so we can redo
      const newFuture = [...state.future, currentSnapshot]
      return {
        past: newPast,
        future: newFuture,
        canUndo: newPast.length > 0,
        canRedo: true,
      }
    })

    return target
  },

  redo: (currentSnapshot) => {
    const { future } = get()
    if (future.length === 0) return null

    // Target: the last item in future
    const target = future[future.length - 1]

    set((state) => {
      const newFuture = state.future.slice(0, -1)
      // Push current into past so we can undo again
      const newPast = [...state.past, currentSnapshot].slice(-MAX_HISTORY)
      return {
        past: newPast,
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
      }
    })

    return target
  },
}))
