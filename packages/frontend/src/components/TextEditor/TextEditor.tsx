import { useCallback, useRef } from 'react'
import { useSubtitleStore } from '../../store/subtitleStore.ts'
import './TextEditor.css'

interface TextEditorProps {
  seekToTime: (timeSec: number) => void
  onEditPhrase?: (phraseIndex: number) => void
}

export function TextEditor({ seekToTime, onEditPhrase }: TextEditorProps) {
  const session = useSubtitleStore((s) => s.session)
  const speakerNames = useSubtitleStore((s) => s.speakerNames)
  const { splitPhrase, mergePhrase, addPhrase, updatePhraseText } = useSubtitleStore()

  // Ref map to track contentEditable divs by phraseIndex
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const setLineRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) {
      lineRefs.current.set(idx, el)
    } else {
      lineRefs.current.delete(idx)
    }
  }, [])

  const handleSeek = useCallback((phraseIndex: number) => {
    if (!session) return
    const phrase = session.phrases[phraseIndex]
    if (phrase && phrase.words.length > 0) {
      seekToTime(phrase.words[0].start)
    }
    if (onEditPhrase) onEditPhrase(phraseIndex)
  }, [session, seekToTime, onEditPhrase])

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

    // After store update, the component will re-render with the new phrase text.
    // Sync the DOM to match (avoids stale innerText after React re-render)
    // This is handled by React re-render.
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
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)

      const el = lineRefs.current.get(phraseIndex)
      if (!el) return

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
            // Place cursor at end
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

  if (!session || session.phrases.length === 0) {
    return (
      <div className="text-editor text-editor--empty">
        <p className="text-editor__empty-msg">No transcript loaded.</p>
      </div>
    )
  }

  const hasSpeakers = Object.keys(speakerNames).length > 0

  return (
    <div className="text-editor">
      {session.phrases.map((phrase, phraseIndex) => {
        const phraseText = phrase.words.map((w) => w.word).join(' ')
        const speakerIdx = phrase.dominantSpeaker
          ? parseInt(phrase.dominantSpeaker.replace('SPEAKER_', ''), 10) % 8
          : undefined

        return (
          <div key={phraseIndex} className="text-editor__line">
            {/* Line number — click to seek */}
            <button
              type="button"
              className="text-editor__line-number"
              onClick={() => handleSeek(phraseIndex)}
              title={`Seek to line ${phraseIndex + 1}`}
            >
              {phraseIndex + 1}
            </button>

            {/* Speaker indicator dot (only when speakers detected) */}
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

            {/* Editable phrase text */}
            <div
              ref={(el) => setLineRef(phraseIndex, el)}
              className="text-editor__line-content"
              contentEditable
              suppressContentEditableWarning
              onBlur={() => handleBlur(phraseIndex)}
              onKeyDown={(e) => handleKeyDown(e, phraseIndex)}
              data-phrase-index={phraseIndex}
            >
              {phraseText}
            </div>
          </div>
        )
      })}

      {/* Add line button */}
      <button
        type="button"
        className="text-editor__add-line-btn"
        onClick={() => addPhrase(session.phrases.length - 1)}
      >
        + Add line
      </button>
    </div>
  )
}
