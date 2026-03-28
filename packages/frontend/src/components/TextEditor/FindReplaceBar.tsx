import { useState, useEffect, useRef } from 'react'
import type { SessionPhrase } from '../../lib/grouping.ts'
import { findMatches, applyReplacements, type FindReplaceMatch } from './findReplace.ts'
import './FindReplaceBar.css'

interface FindReplaceBarProps {
  phrases: SessionPhrase[]
  onReplace: (replacements: Array<{ phraseIndex: number; newWords: string[] }>) => void
  onClose: () => void
}

function highlightText(text: string, term: string): React.ReactNode {
  if (!term) return text
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? <mark key={i}>{part}</mark> : part
  )
}

export function FindReplaceBar({ phrases, onReplace, onClose }: FindReplaceBarProps) {
  const [findTerm, setFindTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [matches, setMatches] = useState<FindReplaceMatch[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const findInputRef = useRef<HTMLInputElement>(null)

  // Auto-focus the find input on mount
  useEffect(() => {
    findInputRef.current?.focus()
  }, [])

  // Debounce find/replace computation (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setMatches(findMatches(phrases, findTerm, replaceTerm))
    }, 300)
    return () => clearTimeout(timer)
  }, [findTerm, replaceTerm, phrases])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleConfirmReplace = () => {
    const replacements = applyReplacements(matches)
    onReplace(replacements)
    setShowPreview(false)
  }

  const matchCount = matches.length
  const hasFind = findTerm.length > 0

  const matchCountText = !hasFind
    ? ''
    : matchCount === 0
    ? 'No matches'
    : matchCount === 1
    ? '1 match'
    : `${matchCount} matches`

  return (
    <>
      <div className="find-replace-bar" onKeyDown={handleKeyDown}>
        <label className="find-replace-bar__label" htmlFor="find-replace-find">
          Find:
        </label>
        <input
          id="find-replace-find"
          ref={findInputRef}
          type="text"
          className="find-replace-bar__input"
          placeholder="Find\u2026"
          value={findTerm}
          onChange={(e) => setFindTerm(e.target.value)}
          autoComplete="off"
        />

        <label className="find-replace-bar__label find-replace-bar__label--replace" htmlFor="find-replace-replace">
          Replace:
        </label>
        <input
          id="find-replace-replace"
          type="text"
          className="find-replace-bar__input"
          placeholder="Replace with\u2026"
          value={replaceTerm}
          onChange={(e) => setReplaceTerm(e.target.value)}
          autoComplete="off"
        />

        {hasFind && (
          <span
            className={`find-replace-bar__count${matchCount === 0 ? ' find-replace-bar__count--no-matches' : ''}`}
          >
            {matchCountText}
          </span>
        )}

        <button
          type="button"
          className="find-replace-bar__replace-btn"
          disabled={matchCount === 0}
          onClick={() => setShowPreview(true)}
        >
          Replace All
        </button>

        <button
          type="button"
          className="find-replace-bar__close-btn"
          aria-label="Close find and replace"
          onClick={onClose}
        >
          {'\u00D7'}
        </button>
      </div>

      {showPreview && matchCount > 0 && (
        <div className="find-replace-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false) }}>
          <div className="find-replace-modal" role="dialog" aria-labelledby="find-replace-modal-title">
            <div className="find-replace-modal__header">
              <h2 id="find-replace-modal-title" className="find-replace-modal__title">
                Replace All Preview
              </h2>
              <button
                type="button"
                className="find-replace-modal__close-btn"
                aria-label="Close preview"
                onClick={() => setShowPreview(false)}
              >
                {'\u00D7'}
              </button>
            </div>

            <div className="find-replace-modal__body">
              <ul className="find-replace-modal__list">
                {matches.map((match) => (
                  <li key={match.phraseIndex} className="find-replace-modal__row">
                    <span className="find-replace-modal__line-num">{match.phraseIndex + 1}</span>
                    <span className="find-replace-match-before">
                      {highlightText(match.phraseText, findTerm)}
                    </span>
                    <span className="find-replace-modal__arrow">{'\u2192'}</span>
                    <span className="find-replace-match-after">
                      {replaceTerm ? highlightText(match.replacedText, replaceTerm) : match.replacedText}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="find-replace-modal__note">
                Note: Replacing text may redistribute word timestamps if word count changes.
              </p>
            </div>

            <div className="find-replace-modal__footer">
              <button
                type="button"
                className="find-replace-modal__btn find-replace-modal__btn--secondary"
                onClick={() => setShowPreview(false)}
              >
                Dismiss Preview
              </button>
              <button
                type="button"
                className="find-replace-modal__btn find-replace-modal__btn--primary"
                onClick={handleConfirmReplace}
              >
                Confirm Replace All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
