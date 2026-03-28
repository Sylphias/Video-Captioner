import { useState, useRef, useCallback } from 'react'
import { parseSrt, alignSrtToWhisper } from '../lib/srtAlignment.ts'
import type { AlignedPhrase } from '../lib/srtAlignment.ts'
import { useSubtitleStore } from '../store/subtitleStore.ts'
import { buildSessionPhrases } from '../lib/grouping.ts'

export interface SrtImportState {
  status: 'idle' | 'parsed' | 'failed'
  alignedPhrases: AlignedPhrase[]
  error: string | null
}

const INITIAL_STATE: SrtImportState = {
  status: 'idle',
  alignedPhrases: [],
  error: null,
}

export function useSrtImport() {
  const [state, setState] = useState<SrtImportState>(INITIAL_STATE)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setState(INITIAL_STATE)
    // Clear file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const importFile = useCallback(
    async (file: File) => {
      try {
        // D-12: re-import starts fresh — reset first
        reset()

        const content = await file.text()
        const cues = parseSrt(content)

        if (cues.length === 0) {
          setState({
            status: 'failed',
            alignedPhrases: [],
            error: 'Could not parse SRT file. Check that the file is valid SRT format.',
          })
          return
        }

        // D-12: align against original Whisper timestamps, not current session
        const store = useSubtitleStore.getState()
        if (!store.original || !store.session) {
          setState({
            status: 'failed',
            alignedPhrases: [],
            error: 'Alignment failed. Make sure a transcript exists before importing.',
          })
          return
        }

        // Build phrases from original words to align against
        const originalSessionWords = store.original.words.map((w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence,
          speaker: w.speaker,
        }))
        const originalPhrases = buildSessionPhrases(
          originalSessionWords,
          new Set<number>(),
          store.maxWordsPerPhrase,
        )

        const aligned = alignSrtToWhisper(cues, originalPhrases)

        if (aligned.length === 0) {
          setState({ status: 'parsed', alignedPhrases: [], error: null })
          return
        }

        setState({ status: 'parsed', alignedPhrases: aligned, error: null })
      } catch (err) {
        setState({ status: 'failed', alignedPhrases: [], error: String(err) })
      }
    },
    [reset],
  )

  const acceptPhrase = useCallback(
    (alignedIndex: number) => {
      const aligned = state.alignedPhrases[alignedIndex]
      if (!aligned) return

      const store = useSubtitleStore.getState()
      if (!store.session) return

      // Find the current phrase that best matches the aligned phrase's time range
      // (phrase indices may have shifted from previous accepts)
      let bestPhraseIndex = 0
      let bestOverlap = 0
      for (let p = 0; p < store.session.phrases.length; p++) {
        const ph = store.session.phrases[p]
        if (ph.words.length === 0) continue
        const phStart = ph.words[0].start
        const phEnd = ph.words[ph.words.length - 1].end
        const aStart = aligned.replacementWords[0]?.start ?? 0
        const aEnd = aligned.replacementWords[aligned.replacementWords.length - 1]?.end ?? 0
        const overlap = Math.max(0, Math.min(phEnd, aEnd) - Math.max(phStart, aStart))
        if (overlap > bestOverlap) {
          bestOverlap = overlap
          bestPhraseIndex = p
        }
      }

      store.applySrtPhrase(bestPhraseIndex, aligned.replacementWords)

      // Remove accepted phrase from pending list
      setState((prev) => ({
        ...prev,
        alignedPhrases: prev.alignedPhrases.filter((_, i) => i !== alignedIndex),
      }))
    },
    [state.alignedPhrases],
  )

  const rejectPhrase = useCallback((alignedIndex: number) => {
    // Simply remove from pending list — no store mutation
    setState((prev) => ({
      ...prev,
      alignedPhrases: prev.alignedPhrases.filter((_, i) => i !== alignedIndex),
    }))
  }, [])

  return { state, fileInputRef, importFile, reset, acceptPhrase, rejectPhrase }
}
