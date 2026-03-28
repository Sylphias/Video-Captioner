import { useState, useEffect, useRef } from 'react'
import './BulkActionsToolbar.css'

interface BulkActionsToolbarProps {
  count: number
  speakerIds: string[]
  speakerNames: Record<string, string>
  onMerge: () => void
  onDelete: () => void
  onReassignSpeaker: (speakerId: string) => void
}

export function BulkActionsToolbar({
  count,
  speakerIds,
  speakerNames,
  onMerge,
  onDelete,
  onReassignSpeaker,
}: BulkActionsToolbarProps) {
  const [showSpeakers, setShowSpeakers] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showSpeakers) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowSpeakers(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSpeakers])

  return (
    <div className="bulk-actions-toolbar">
      <span className="bulk-actions-toolbar__count">{count} selected</span>
      <span className="bulk-actions-toolbar__separator" />
      <button
        type="button"
        className="bulk-actions-toolbar__btn"
        onClick={onMerge}
        disabled={count < 2}
        title="Merge selected phrases (Ctrl+M)"
      >
        Merge Phrases
      </button>
      <button
        type="button"
        className="bulk-actions-toolbar__btn bulk-actions-toolbar__btn--destructive"
        onClick={onDelete}
        title="Delete selected phrases (Del)"
      >
        Delete Phrases
      </button>
      {speakerIds.length > 0 && (
        <div className="bulk-actions-toolbar__dropdown-wrapper" ref={dropdownRef}>
          <button
            type="button"
            className="bulk-actions-toolbar__btn"
            onClick={() => setShowSpeakers(prev => !prev)}
            title="Reassign selected phrases to a speaker"
          >
            Reassign Speaker &#9662;
          </button>
          {showSpeakers && (
            <ul className="bulk-actions-toolbar__speaker-list">
              {speakerIds.map(speakerId => (
                <li key={speakerId}>
                  <button
                    type="button"
                    className="bulk-actions-toolbar__speaker-item"
                    onClick={() => {
                      onReassignSpeaker(speakerId)
                      setShowSpeakers(false)
                    }}
                  >
                    {speakerNames[speakerId] ?? speakerId}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <span className="bulk-actions-toolbar__hint">Ctrl+M merge&nbsp;&nbsp;&middot;&nbsp;&nbsp;Del delete</span>
    </div>
  )
}
