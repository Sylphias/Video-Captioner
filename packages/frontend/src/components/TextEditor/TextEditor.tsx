import React, { useCallback, useRef, useState, useEffect } from 'react'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import { useSrtImport } from '../../hooks/useSrtImport.ts'
import { SrtDiffView } from './SrtDiffView.tsx'
import { BulkActionsToolbar } from './BulkActionsToolbar.tsx'
import { FindReplaceBar } from './FindReplaceBar.tsx'
import './TextEditor.css'

interface TextEditorProps {
  seekToTime: (timeSec: number) => void
  getCurrentTime?: (() => number) | null
}

const CONFIDENCE_THRESHOLD = 0.7

export function TextEditor({ seekToTime, getCurrentTime }: TextEditorProps) {
  const session = useSubtitleStore((s) => s.session)
  const speakerNames = useSubtitleStore((s) => s.speakerNames)
  const {
    splitPhrase,
    mergePhrase,
    addPhrase,
    updatePhraseText,
    mergePhrases,
    deletePhrases,
    deletePhrase,
    duplicatePhrase,
    movePhraseUp,
    movePhraseDown,
    reassignPhraseSpeaker,
    replaceAllPhraseTexts,
  } = useSubtitleStore()

  const { state: srtState, fileInputRef, importFile, reset: resetSrt, acceptPhrase, rejectPhrase } = useSrtImport()

  const handleSrtFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await importFile(file)
  }, [importFile])

  // Ref map to track contentEditable divs by phraseIndex
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const setLineRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) {
      lineRefs.current.set(idx, el)
    } else {
      lineRefs.current.delete(idx)
    }
  }, [])

  // Multi-select state (D-01, D-02)
  const [selectedPhraseIndices, setSelectedPhraseIndices] = useState<Set<number>>(new Set())
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null)
  const [confirmDeleteCount, setConfirmDeleteCount] = useState<number | null>(null)

  // Find/replace state
  const [findReplaceOpen, setFindReplaceOpen] = useState(false)

  // Active phrase tracking — follows video playback
  const [activePhraseIndex, setActivePhraseIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!getCurrentTime || !session) return
    const interval = setInterval(() => {
      const t = getCurrentTime()
      let found: number | null = null
      for (let i = 0; i < session.phrases.length; i++) {
        const p = session.phrases[i]
        if (p.words.length === 0) continue
        const start = p.words[0].start
        const end = p.words[p.words.length - 1].end
        if (t >= start && t <= end + 0.5) {
          found = i
          break
        }
      }
      setActivePhraseIndex(found)
    }, 100)
    return () => clearInterval(interval)
  }, [getCurrentTime, session])

  // Auto-scroll to active phrase
  useEffect(() => {
    if (activePhraseIndex === null) return
    const el = lineRefs.current.get(activePhraseIndex)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activePhraseIndex])

  // Drag-to-select state
  const dragSelectRef = useRef<{ startIndex: number; active: boolean } | null>(null)

  const clearSelection = useCallback(() => {
    setSelectedPhraseIndices(new Set())
    setLastClickedIndex(null)
  }, [])

  const handleSeek = useCallback((phraseIndex: number) => {
    if (!session) return
    const phrase = session.phrases[phraseIndex]
    if (phrase && phrase.words.length > 0) {
      seekToTime(phrase.words[0].start)
    }
  }, [session, seekToTime])

  const handleCheckboxClick = useCallback((e: React.MouseEvent, phraseIndex: number) => {
    e.stopPropagation()
    setSelectedPhraseIndices(prev => {
      const next = new Set(prev)
      if (next.has(phraseIndex)) {
        next.delete(phraseIndex)
      } else {
        next.add(phraseIndex)
      }
      return next
    })
    setLastClickedIndex(phraseIndex)
  }, [])

  // Gutter drag-to-select: mousedown on line number starts selection drag
  const handleGutterMouseDown = useCallback((e: React.MouseEvent, phraseIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    // Shift+click: range select from last clicked
    if (e.shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, phraseIndex)
      const end = Math.max(lastClickedIndex, phraseIndex)
      setSelectedPhraseIndices(prev => {
        const next = new Set(prev)
        for (let i = start; i <= end; i++) next.add(i)
        return next
      })
      return
    }

    setLastClickedIndex(phraseIndex)
    dragSelectRef.current = { startIndex: phraseIndex, active: false }

    // Immediately select this row
    setSelectedPhraseIndices(new Set([phraseIndex]))

    const onMove = (moveE: MouseEvent) => {
      if (!dragSelectRef.current) return
      dragSelectRef.current.active = true

      // Find which phrase row the mouse is over
      const el = document.elementFromPoint(moveE.clientX, moveE.clientY)
      const lineEl = el?.closest('.text-editor__line') as HTMLElement | null
      if (!lineEl) return
      const contentEl = lineEl.querySelector('[data-phrase-index]') as HTMLElement | null
      if (!contentEl) return
      const hoverIndex = parseInt(contentEl.dataset.phraseIndex ?? '-1', 10)
      if (hoverIndex < 0) return

      const startIdx = dragSelectRef.current.startIndex
      const rangeStart = Math.min(startIdx, hoverIndex)
      const rangeEnd = Math.max(startIdx, hoverIndex)
      const next = new Set<number>()
      for (let i = rangeStart; i <= rangeEnd; i++) next.add(i)
      setSelectedPhraseIndices(next)
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      // If no drag happened, treat as a seek click
      if (dragSelectRef.current && !dragSelectRef.current.active) {
        handleSeek(phraseIndex)
        clearSelection()
      }
      dragSelectRef.current = null
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [lastClickedIndex, handleSeek, clearSelection])

  const handleBlur = useCallback((phraseIndex: number) => {
    if (!session) return
    const el = lineRefs.current.get(phraseIndex)
    if (!el) return

    const text = el.innerText.trim()
    if (!text) return

    // Split on whitespace to get individual word tokens
    const newWords = text.split(/\s+/).filter(Boolean)
    if (newWords.length === 0) return

    updatePhraseText(phraseIndex, newWords)
  }, [session, updatePhraseText])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>, phraseIndex: number) => {
    if (!session) return

    if (e.key === 'Enter') {
      e.preventDefault()

      // Determine cursor position in the text
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)

      const el = lineRefs.current.get(phraseIndex)
      if (!el) return

      // Get text before cursor
      const preRange = document.createRange()
      preRange.selectNodeContents(el)
      preRange.setEnd(range.startContainer, range.startOffset)
      const textBeforeCursor = preRange.toString()

      // Count words before cursor
      const wordsBeforeCursor = textBeforeCursor.trim().split(/\s+/).filter(Boolean)
      const splitBeforeWordIndex = wordsBeforeCursor.length

      const phrase = session.phrases[phraseIndex]
      if (!phrase || splitBeforeWordIndex <= 0 || splitBeforeWordIndex >= phrase.words.length) {
        return // can't split at first word or at/after last word
      }

      // First save any pending text edit on the current line
      const currentText = el.innerText.trim()
      const currentWords = currentText.split(/\s+/).filter(Boolean)
      if (currentWords.length !== phrase.words.map((w) => w.word).join(' ').split(/\s+/).length) {
        updatePhraseText(phraseIndex, currentWords)
      }

      splitPhrase(phraseIndex, splitBeforeWordIndex)

      // Focus the new line (next phraseIndex) after React re-renders
      setTimeout(() => {
        const nextEl = lineRefs.current.get(phraseIndex + 1)
        if (nextEl) {
          nextEl.focus()
          // Move cursor to start of new line
          const sel = window.getSelection()
          if (sel) {
            const r = document.createRange()
            r.selectNodeContents(nextEl)
            r.collapse(true)
            sel.removeAllRanges()
            sel.addRange(r)
          }
        }
      }, 50)
    }

    if (e.key === 'Backspace') {
      const el = lineRefs.current.get(phraseIndex)
      if (!el) return

      const text = el.innerText.trim()
      const phrase = session.phrases[phraseIndex]

      // If line is empty, delete the entire phrase
      if (!text) {
        e.preventDefault()
        deletePhrase(phraseIndex)
        // Focus the previous line (or next if this was the first)
        setTimeout(() => {
          const targetIdx = phraseIndex > 0 ? phraseIndex - 1 : 0
          const targetEl = lineRefs.current.get(targetIdx)
          if (targetEl) {
            targetEl.focus()
            const sel = window.getSelection()
            if (sel) {
              const r = document.createRange()
              r.selectNodeContents(targetEl)
              r.collapse(false)
              sel.removeAllRanges()
              sel.addRange(r)
            }
          }
        }, 50)
        return
      }

      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)

      // Check if cursor is at position 0 (start of line content)
      const isAtStart =
        range.startOffset === 0 &&
        (range.startContainer === el || range.startContainer === el.firstChild)

      if (isAtStart && phraseIndex > 0) {
        e.preventDefault()
        mergePhrase(phraseIndex - 1)

        // After merge, focus the previous line and place cursor at the end of the merged-in text
        setTimeout(() => {
          const prevEl = lineRefs.current.get(phraseIndex - 1)
          if (prevEl) {
            prevEl.focus()
            const sel = window.getSelection()
            if (sel) {
              const r = document.createRange()
              r.selectNodeContents(prevEl)
              r.collapse(false)
              sel.removeAllRanges()
              sel.addRange(r)
            }
          }
        }, 50)
      }
    }
  }, [session, splitPhrase, mergePhrase, updatePhraseText])

  // Outer editor keydown handler for shortcuts (D-08)
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const inContentEditable = (e.target as HTMLElement).contentEditable === 'true'

    // Ctrl+H — toggle find/replace
    if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
      e.preventDefault()
      setFindReplaceOpen(prev => !prev)
      return
    }

    // Ctrl+A — select all phrases (not in contentEditable)
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !inContentEditable) {
      e.preventDefault()
      if (session) setSelectedPhraseIndices(new Set(session.phrases.map((_, i) => i)))
      return
    }

    // Ctrl+M — merge selected (not in contentEditable, 2+ selected)
    if ((e.ctrlKey || e.metaKey) && e.key === 'm' && !inContentEditable && selectedPhraseIndices.size >= 2) {
      e.preventDefault()
      mergePhrases([...selectedPhraseIndices])
      clearSelection()
      return
    }

    // Delete/Backspace — delete selected (not in contentEditable, 1+ selected)
    if ((e.key === 'Delete' || e.key === 'Backspace') && !inContentEditable && selectedPhraseIndices.size >= 1) {
      e.preventDefault()
      if (selectedPhraseIndices.size > 3) {
        setConfirmDeleteCount(selectedPhraseIndices.size)
      } else {
        deletePhrases([...selectedPhraseIndices])
        clearSelection()
      }
      return
    }

    // Ctrl+D — duplicate (not in contentEditable, exactly 1 selected)
    if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !inContentEditable && selectedPhraseIndices.size === 1) {
      e.preventDefault()
      duplicatePhrase([...selectedPhraseIndices][0])
      clearSelection()
      return
    }

    // Ctrl+Shift+Up — move up (not in contentEditable)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowUp' && !inContentEditable && selectedPhraseIndices.size >= 1) {
      e.preventDefault()
      const sorted = [...selectedPhraseIndices].sort((a, b) => a - b)
      if (sorted[0] > 0) {
        for (const idx of sorted) movePhraseUp(idx)
        setSelectedPhraseIndices(new Set(sorted.map(i => i - 1)))
      }
      return
    }

    // Ctrl+Shift+Down — move down (not in contentEditable)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'ArrowDown' && !inContentEditable && selectedPhraseIndices.size >= 1) {
      e.preventDefault()
      const sorted = [...selectedPhraseIndices].sort((a, b) => b - a) // reverse
      if (session && sorted[0] < session.phrases.length - 1) {
        for (const idx of sorted) movePhraseDown(idx)
        setSelectedPhraseIndices(new Set(sorted.map(i => i + 1)))
      }
      return
    }

    // ArrowUp — move to previous phrase (in contentEditable at start of line)
    if (e.key === 'ArrowUp' && inContentEditable && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const atStart = range.startOffset === 0 && (
          range.startContainer === e.target ||
          range.startContainer === (e.target as HTMLElement).firstChild ||
          (range.startContainer.parentElement && range.startContainer === range.startContainer.parentElement.firstChild && range.startOffset === 0)
        )
        if (atStart) {
          e.preventDefault()
          const currentIndex = parseInt((e.target as HTMLElement).dataset.phraseIndex ?? '-1', 10)
          const prevIndex = currentIndex - 1
          if (session && prevIndex >= 0) {
            const prevEl = lineRefs.current.get(prevIndex)
            if (prevEl) {
              prevEl.focus()
              const prevSel = window.getSelection()
              if (prevSel) {
                const r = document.createRange()
                r.selectNodeContents(prevEl)
                r.collapse(false) // to end
                prevSel.removeAllRanges()
                prevSel.addRange(r)
              }
            }
          }
        }
      }
      return
    }

    // ArrowDown — move to next phrase (in contentEditable at end of line)
    if (e.key === 'ArrowDown' && inContentEditable && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      const sel = window.getSelection()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const target = e.target as HTMLElement
        const atEnd = range.endOffset === (range.endContainer.textContent?.length ?? 0) && (
          range.endContainer === target ||
          range.endContainer === target.lastChild ||
          (range.endContainer.parentElement && range.endContainer === range.endContainer.parentElement.lastChild)
        )
        if (atEnd) {
          e.preventDefault()
          const currentIndex = parseInt(target.dataset.phraseIndex ?? '-1', 10)
          const nextIndex = currentIndex + 1
          if (session && nextIndex < session.phrases.length) {
            const nextEl = lineRefs.current.get(nextIndex)
            if (nextEl) {
              nextEl.focus()
              const nextSel = window.getSelection()
              if (nextSel) {
                const r = document.createRange()
                r.selectNodeContents(nextEl)
                r.collapse(true) // to start
                nextSel.removeAllRanges()
                nextSel.addRange(r)
              }
            }
          }
        }
      }
      return
    }

    // Tab — navigate between phrase contentEditables
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      const currentIndex = parseInt((e.target as HTMLElement).dataset.phraseIndex ?? '-1', 10)
      const nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1
      if (session && nextIndex >= 0 && nextIndex < session.phrases.length) {
        const nextEl = lineRefs.current.get(nextIndex)
        if (nextEl) nextEl.focus()
      }
      return
    }

    // Escape — clear selection
    if (e.key === 'Escape') {
      clearSelection()
      setFindReplaceOpen(false)
      return
    }
  }, [session, selectedPhraseIndices, mergePhrases, deletePhrases, duplicatePhrase, movePhraseUp, movePhraseDown, clearSelection])

  if (!session || session.phrases.length === 0) {
    return (
      <div className="text-editor text-editor--empty">
        <p className="text-editor__empty-msg">No transcript loaded.</p>
      </div>
    )
  }

  const hasSpeakers = Object.keys(speakerNames).length > 0

  return (
    <div
      className="text-editor"
      onKeyDown={handleEditorKeyDown}
      tabIndex={-1}
    >
      {/* Hidden file input for SRT import (D-03) */}
      <input
        type="file"
        accept=".srt"
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={handleSrtFileChange}
      />

      {/* Top action buttons */}
      {session && (
        <div className="text-editor__top-actions">
          <button
            type="button"
            className="srt-import-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Import SRT
          </button>
          <button
            type="button"
            className="text-editor__find-btn"
            onClick={() => setFindReplaceOpen(prev => !prev)}
            title="Find and Replace (Ctrl+H)"
          >
            Find &amp; Replace
          </button>
        </div>
      )}

      {/* Find/Replace bar */}
      {findReplaceOpen && session && (
        <FindReplaceBar
          phrases={session.phrases}
          onReplace={(replacements) => {
            replaceAllPhraseTexts(replacements)
            setFindReplaceOpen(false)
          }}
          onClose={() => setFindReplaceOpen(false)}
        />
      )}

      {/* Error state */}
      {srtState.status === 'failed' && srtState.error && (
        <div className="srt-import-error">
          <span>{srtState.error}</span>
          <button
            type="button"
            className="srt-import-error__dismiss"
            onClick={resetSrt}
            aria-label="Dismiss error"
          >
            {'\u00D7'}
          </button>
        </div>
      )}

      {/* SRT Diff View */}
      {srtState.status === 'parsed' && (
        <SrtDiffView
          alignedPhrases={srtState.alignedPhrases}
          onAccept={acceptPhrase}
          onReject={rejectPhrase}
          onDismiss={resetSrt}
        />
      )}

      {/* BulkActionsToolbar — visible when 2+ phrases selected */}
      {selectedPhraseIndices.size >= 2 && confirmDeleteCount === null && (
        <BulkActionsToolbar
          count={selectedPhraseIndices.size}
          speakerIds={Object.keys(speakerNames)}
          speakerNames={speakerNames}
          onMerge={() => { mergePhrases([...selectedPhraseIndices]); clearSelection() }}
          onDelete={() => {
            if (selectedPhraseIndices.size > 3) {
              setConfirmDeleteCount(selectedPhraseIndices.size)
            } else {
              deletePhrases([...selectedPhraseIndices]); clearSelection()
            }
          }}
          onReassignSpeaker={(speakerId) => {
            for (const idx of selectedPhraseIndices) reassignPhraseSpeaker(idx, speakerId)
            clearSelection()
          }}
        />
      )}

      {/* Delete confirmation inline bar */}
      {confirmDeleteCount !== null && (
        <div className="text-editor__delete-confirm">
          <span>Delete {confirmDeleteCount} phrases?</span>
          <button
            type="button"
            className="text-editor__delete-confirm-btn text-editor__delete-confirm-btn--destructive"
            onClick={() => {
              deletePhrases([...selectedPhraseIndices])
              clearSelection()
              setConfirmDeleteCount(null)
            }}
          >
            Delete {confirmDeleteCount} Phrases
          </button>
          <button
            type="button"
            className="text-editor__delete-confirm-btn"
            onClick={() => setConfirmDeleteCount(null)}
          >
            Keep Phrases
          </button>
        </div>
      )}

      {/* ---- Insert before first line ---- */}
      <button
        type="button"
        className="text-editor__insert-btn text-editor__insert-btn--first"
        onClick={(e) => { e.stopPropagation(); addPhrase(-1) }}
        title="Insert phrase before line 1"
      >
        +
      </button>

      {/* ---- Phrase list ---- */}
      {session.phrases.map((phrase, phraseIndex) => {
        const phraseText = phrase.words.map((w) => w.word).join(' ')
        const speakerIdx = phrase.dominantSpeaker
          ? parseInt(phrase.dominantSpeaker.replace('SPEAKER_', ''), 10) % 8
          : undefined
        const isSelected = selectedPhraseIndices.has(phraseIndex)
        const hasAnySelected = selectedPhraseIndices.size > 0
        const isActive = phraseIndex === activePhraseIndex

        return (
          <React.Fragment key={phraseIndex}>
          <div
            className={`text-editor__line${isSelected ? ' text-editor__line--selected' : ''}${isActive ? ' text-editor__line--active' : ''}`}
          >
            {/* Checkbox column */}
            <input
              type="checkbox"
              className="text-editor__line-checkbox"
              style={{ opacity: hasAnySelected ? 1 : 0 }}
              checked={isSelected}
              onChange={() => {}}
              onClick={(e) => handleCheckboxClick(e, phraseIndex)}
              aria-label={`Select phrase ${phraseIndex + 1}`}
            />

            {/* Line number gutter — drag to select rows */}
            <button
              type="button"
              className="text-editor__line-number"
              onClick={(e) => { e.stopPropagation() }}
              onMouseDown={(e) => handleGutterMouseDown(e, phraseIndex)}
              title={`Drag to select · Click to seek`}
            >
              {phraseIndex + 1}
            </button>

            {/* Speaker indicator dot */}
            {hasSpeakers && (
              <span
                className="text-editor__speaker-indicator"
                data-speaker-index={speakerIdx}
                title={
                  phrase.dominantSpeaker
                    ? speakerNames[phrase.dominantSpeaker] ?? phrase.dominantSpeaker
                    : undefined
                }
              />
            )}

            {/* Editable phrase text with confidence underlines */}
            <div
              key={phraseText}
              ref={(el) => setLineRef(phraseIndex, el)}
              className="text-editor__line-content"
              contentEditable
              suppressContentEditableWarning
              onBlur={() => handleBlur(phraseIndex)}
              onKeyDown={(e) => handleKeyDown(e, phraseIndex)}
              data-phrase-index={phraseIndex}
            >
              {phrase.words.map((word, wi) => {
                const isLow = word.confidence < CONFIDENCE_THRESHOLD
                return (
                  <span
                    key={wi}
                    className={isLow ? 'text-editor__word--low-confidence' : undefined}
                    title={isLow ? `Confidence: ${Math.round(word.confidence * 100)}%` : undefined}
                  >
                    {word.word}{wi < phrase.words.length - 1 ? ' ' : ''}
                  </span>
                )
              })}
            </div>

            {/* Delete phrase button */}
            <button
              type="button"
              className="text-editor__delete-btn"
              onClick={(e) => { e.stopPropagation(); deletePhrase(phraseIndex) }}
              title={`Delete line ${phraseIndex + 1}`}
              aria-label={`Delete phrase ${phraseIndex + 1}`}
            >
              {'\u00D7'}
            </button>
          </div>

          {/* Insert line after this phrase */}
          <button
            type="button"
            className="text-editor__insert-btn"
            onClick={(e) => { e.stopPropagation(); addPhrase(phraseIndex) }}
            title={`Insert phrase after line ${phraseIndex + 1}`}
          >
            +
          </button>
          </React.Fragment>
        )
      })}
    </div>
  )
}
