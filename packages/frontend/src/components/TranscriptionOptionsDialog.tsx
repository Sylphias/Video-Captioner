import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_MAX_WORDS_PER_LINE,
  loadMaxCharsPerLine,
  loadMaxWordsPerLine,
  saveMaxCharsPerLine,
  saveMaxWordsPerLine,
} from '../lib/transcriptionPrefs.ts'
import { parseSrt, type SrtCue } from '../lib/srtAlignment.ts'
import './TranscriptionOptionsDialog.css'

export interface TranscriptionOptions {
  maxWordsPerLine: number
  maxCharsPerLine: number | null
  /** Parsed SRT cues when the user chose "use SRT instead of transcribing". */
  srtCues?: SrtCue[] | null
}

interface TranscriptionOptionsDialogProps {
  title: string
  confirmLabel: string
  /**
   * Prefill overrides. When re-transcribing an open session, pass the
   * session's own caps so the dialog reflects what the session actually
   * uses; omitted fields fall back to the last-used localStorage prefs.
   */
  initialWords?: number
  initialChars?: number | null
  /**
   * Called after the chosen values have been persisted to localStorage
   * (transcriptionPrefs). setJob reads the prefs when it builds phrases, so
   * most callers can ignore the options argument.
   */
  onConfirm: (options: TranscriptionOptions) => void
  onCancel: () => void
  /**
   * Show the "use an SRT file instead of transcribing" picker. Only offered
   * for fresh uploads — re-transcribe always runs WhisperX.
   */
  allowSrt?: boolean
}

/**
 * Small modal shown before a transcription starts (initial upload or
 * re-transcribe). Asks for the two phrase-grouping caps:
 *   - Max words per line (also seeds the session's maxWordsPerPhrase)
 *   - Max characters per line (blank = no cap)
 * Characters take priority over words: if a line reaches the character cap
 * first, remaining words wrap to the next caption line.
 *
 * Enter confirms, Escape cancels. Values are prefilled from the last-used
 * preferences and persisted on confirm.
 */
export function TranscriptionOptionsDialog({
  title,
  confirmLabel,
  initialWords,
  initialChars,
  onConfirm,
  onCancel,
  allowSrt,
}: TranscriptionOptionsDialogProps) {
  const [words, setWords] = useState(() => String(initialWords ?? loadMaxWordsPerLine()))
  const [chars, setChars] = useState(() => {
    const c = initialChars !== undefined ? initialChars : loadMaxCharsPerLine()
    return c === null ? '' : String(c)
  })
  const [srtCues, setSrtCues] = useState<SrtCue[] | null>(null)
  const [srtFileName, setSrtFileName] = useState<string | null>(null)
  const [srtError, setSrtError] = useState<string | null>(null)
  const wordsInputRef = useRef<HTMLInputElement>(null)
  const srtInputRef = useRef<HTMLInputElement>(null)

  const handleSrtFile = async (file: File) => {
    try {
      const cues = parseSrt(await file.text())
      if (cues.length === 0) {
        setSrtCues(null)
        setSrtFileName(null)
        setSrtError('Could not parse any cues from that file.')
        return
      }
      setSrtCues(cues)
      setSrtFileName(file.name)
      setSrtError(null)
    } catch {
      setSrtCues(null)
      setSrtFileName(null)
      setSrtError('Could not read that file.')
    }
  }

  const clearSrt = () => {
    setSrtCues(null)
    setSrtFileName(null)
    setSrtError(null)
    if (srtInputRef.current) srtInputRef.current.value = ''
  }

  useEffect(() => {
    wordsInputRef.current?.focus()
    wordsInputRef.current?.select()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const w = parseInt(words, 10)
    const maxWordsPerLine =
      Number.isFinite(w) && w > 0 ? Math.min(Math.round(w), 30) : DEFAULT_MAX_WORDS_PER_LINE
    const c = chars.trim() === '' ? NaN : Number(chars)
    const maxCharsPerLine = Number.isFinite(c) && c > 0 ? Math.round(c) : null

    saveMaxWordsPerLine(maxWordsPerLine)
    saveMaxCharsPerLine(maxCharsPerLine)
    onConfirm({ maxWordsPerLine, maxCharsPerLine, srtCues })
  }

  return (
    <div className="transcription-options-backdrop" onClick={onCancel}>
      <form
        className="transcription-options-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="transcription-options-dialog__header">
          <h3>{title}</h3>
        </div>
        <div className="transcription-options-dialog__body">
          <label className="transcription-options-dialog__field">
            <span>Max words per line</span>
            <input
              ref={wordsInputRef}
              type="number"
              min={1}
              max={30}
              value={words}
              onChange={(e) => setWords(e.target.value)}
            />
          </label>
          <label className="transcription-options-dialog__field">
            <span>Max characters per line</span>
            <input
              type="number"
              min={8}
              max={200}
              placeholder="Off"
              value={chars}
              onChange={(e) => setChars(e.target.value)}
            />
          </label>
          <p className="transcription-options-dialog__hint">
            Characters take priority: if a line reaches the character limit first,
            the remaining words wrap to the next caption. Leave characters blank
            for no limit.
          </p>
          {allowSrt && (
            <div className="transcription-options-dialog__srt">
              <input
                ref={srtInputRef}
                type="file"
                accept=".srt"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleSrtFile(file)
                }}
              />
              {srtCues === null ? (
                <button
                  type="button"
                  className="transcription-options-dialog__btn transcription-options-dialog__btn--secondary"
                  onClick={() => srtInputRef.current?.click()}
                >
                  Use SRT file instead of transcribing…
                </button>
              ) : (
                <div className="transcription-options-dialog__srt-selected">
                  <span className="transcription-options-dialog__srt-name">
                    {srtFileName} ({srtCues.length} cues)
                  </span>
                  <button
                    type="button"
                    className="transcription-options-dialog__srt-clear"
                    onClick={clearSrt}
                    title="Remove SRT — transcribe with WhisperX instead"
                  >
                    ✕
                  </button>
                </div>
              )}
              {srtError && (
                <p className="transcription-options-dialog__srt-error">{srtError}</p>
              )}
              {srtCues !== null && (
                <p className="transcription-options-dialog__hint">
                  Transcription will be skipped. Words get evenly spread timings
                  within each cue, and no speaker labels are assigned.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="transcription-options-dialog__footer">
          <button
            type="button"
            className="transcription-options-dialog__btn transcription-options-dialog__btn--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="transcription-options-dialog__btn transcription-options-dialog__btn--primary"
          >
            {srtCues !== null ? 'Upload with SRT' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
