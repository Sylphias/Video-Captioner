import { useState } from 'react'
import { loadMaxCharsPerLine, saveMaxCharsPerLine } from '../lib/transcriptionPrefs.ts'
import './MaxCharsPerLineInput.css'

/**
 * Transcription option: cap on characters per caption line. Applies when the
 * next transcription's words are grouped into phrases (setJob). Blank = no
 * cap = historical behavior. Rendered on the projects page (covers the
 * initial upload → auto-transcribe flow) and next to the editor's
 * Re-transcribe button.
 */
export function MaxCharsPerLineInput() {
  const [value, setValue] = useState<number | null>(() => loadMaxCharsPerLine())

  return (
    <label
      className="max-chars-input"
      title="Cap caption line length for new transcriptions. Blank = no limit. Does not re-split existing captions."
    >
      Max chars/line
      <input
        type="number"
        min={8}
        max={200}
        placeholder="Off"
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value
          const n = raw === '' ? null : Number(raw)
          const normalized = n !== null && Number.isFinite(n) && n > 0 ? Math.round(n) : null
          setValue(normalized)
          saveMaxCharsPerLine(normalized)
        }}
      />
    </label>
  )
}
