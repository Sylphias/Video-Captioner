import type { Transcript, VideoMetadata } from '@eigen/shared-types'
import type { StyleProps, SpeakerStyleOverride } from '@eigen/remotion-composition'
import { useSubtitleStore, type SessionWord, type SessionPhrase } from '../store/subtitleStore.ts'
import { useUndoStore } from '../store/undoMiddleware.ts'

/**
 * Extended store state type — includes fields that are added in phase 13 store updates.
 * Using an intersection type here allows this module to compile even if some fields
 * haven't been added to the store interface yet (they will be present at runtime once
 * the full store update lands).
 */
type FullSubtitleState = ReturnType<typeof useSubtitleStore.getState> & {
  activeHighlightPresetId: string | null
  laneCount: number
  laneLocks: Record<number, boolean>
  phraseLaneOverrides: Record<number, number>
}

/**
 * Full project state blob — serialized to JSON for backend persistence.
 * Extends the StateSnapshot shape with fields needed for full project reload.
 */
export interface ProjectStateBlob {
  // Session editing state (matches captureSnapshot shape)
  session: {
    words: SessionWord[]
    phrases: SessionPhrase[]
    manualSplitWordIndices: number[]  // serialized from Set<number>
  } | null
  // Style state
  style: Record<string, unknown>
  maxWordsPerPhrase: number
  speakerNames: Record<string, string>
  speakerStyles: Record<string, Record<string, unknown>>
  activeAnimationPresetId: string | null
  activeHighlightPresetId: string | null
  phraseAnimationPresetIds: Record<number, string>
  // Lane state
  laneCount: number
  laneLocks: Record<number, boolean>
  phraseLaneOverrides: Record<number, number>
  // Extra fields not in StateSnapshot (needed for full reload)
  jobId: string
  original: Transcript | null
  videoMetadata: VideoMetadata | null
}

/**
 * Serialize current store state into a ProjectStateBlob.
 * Returns null if session is not loaded (pre-transcription state — skip save).
 */
export function buildStateBlob(): ProjectStateBlob | null {
  const state = useSubtitleStore.getState() as FullSubtitleState
  if (!state.session || !state.jobId) return null

  return {
    session: {
      words: structuredClone(state.session.words),
      phrases: structuredClone(state.session.phrases),
      manualSplitWordIndices: Array.from(state.session.manualSplitWordIndices),
    },
    style: structuredClone(state.style) as unknown as Record<string, unknown>,
    maxWordsPerPhrase: state.maxWordsPerPhrase,
    speakerNames: { ...state.speakerNames },
    speakerStyles: structuredClone(state.speakerStyles) as Record<string, Record<string, unknown>>,
    activeAnimationPresetId: state.activeAnimationPresetId,
    activeHighlightPresetId: state.activeHighlightPresetId ?? null,
    phraseAnimationPresetIds: { ...state.phraseAnimationPresetIds },
    laneCount: state.laneCount ?? 2,
    laneLocks: { ...(state.laneLocks ?? {}) },
    phraseLaneOverrides: { ...(state.phraseLaneOverrides ?? {}) },
    jobId: state.jobId,
    original: state.original,
    videoMetadata: state.videoMetadata,
  }
}

/**
 * Load a ProjectStateBlob into the Zustand store.
 * IMPORTANT: Does NOT call setJob/buildSessionPhrases — phrases from blob are used directly.
 * Clears undo/redo history per D-06.
 */
export function loadProjectBlob(blob: ProjectStateBlob): void {
  useSubtitleStore.setState({
    jobId: blob.jobId,
    original: blob.original,
    videoMetadata: blob.videoMetadata,
    session: blob.session
      ? {
          words: structuredClone(blob.session.words) as SessionWord[],
          phrases: structuredClone(blob.session.phrases) as SessionPhrase[],
          manualSplitWordIndices: new Set<number>(blob.session.manualSplitWordIndices),
        }
      : null,
    style: structuredClone(blob.style) as unknown as StyleProps,
    maxWordsPerPhrase: blob.maxWordsPerPhrase ?? 5,
    speakerNames: { ...blob.speakerNames },
    speakerStyles: structuredClone(blob.speakerStyles) as unknown as Record<string, SpeakerStyleOverride>,
    activeAnimationPresetId: blob.activeAnimationPresetId ?? null,
    phraseAnimationPresetIds: blob.phraseAnimationPresetIds ?? {},
    // Lane fields — applied via state merge; will be no-ops if store doesn't have them yet
    ...(blob.laneCount !== undefined ? { laneCount: blob.laneCount } : {}),
    ...(blob.laneLocks !== undefined ? { laneLocks: blob.laneLocks } : {}),
    ...(blob.phraseLaneOverrides !== undefined ? { phraseLaneOverrides: blob.phraseLaneOverrides } : {}),
    ...(blob.activeHighlightPresetId !== undefined ? { activeHighlightPresetId: blob.activeHighlightPresetId } : {}),
  })

  // D-06: fresh undo stack on load — clear both past and future
  const undoState = useUndoStore.getState()
  undoState.past.length = 0
  undoState.future.length = 0
  useUndoStore.setState({ canUndo: false, canRedo: false })
}
