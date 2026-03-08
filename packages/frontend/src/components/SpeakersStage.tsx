import { useState } from 'react'
import type { DiarizeState } from '../hooks/useDiarize.ts'
import { useSubtitleStore } from '../store/subtitleStore.ts'
import './SpeakersStage.css'

interface SpeakersStageProps {
  jobId: string
  seekToTime: (timeSec: number) => void
  diarizeState: DiarizeState
  diarize: (jobId: string, numSpeakers?: number) => void
  numSpeakers: number | undefined
  setNumSpeakers: (n: number | undefined) => void
}

export function SpeakersStage({
  jobId,
  diarizeState,
  diarize,
  numSpeakers,
  setNumSpeakers,
}: SpeakersStageProps) {
  const session = useSubtitleStore((s) => s.session)
  const speakerNames = useSubtitleStore((s) => s.speakerNames)
  const { renameSpeaker, reassignWordSpeaker } = useSubtitleStore()

  const allSpeakers = Object.keys(speakerNames)
  const hasSpeakers = allSpeakers.length > 0

  return (
    <div className="speakers-stage">
      {/* Speaker legend */}
      {hasSpeakers && (
        <div className="speakers-stage__legend">
          {allSpeakers.map((sid) => {
            const idx = parseInt(sid.replace('SPEAKER_', ''), 10) % 8
            return (
              <span key={sid} className="speakers-stage__speaker-tag" data-speaker-index={idx}>
                <span className="speakers-stage__speaker-swatch" />
                <input
                  className="speakers-stage__speaker-name-input"
                  value={speakerNames[sid] ?? sid}
                  onChange={(e) => renameSpeaker(sid, e.target.value)}
                />
              </span>
            )
          })}
        </div>
      )}

      {/* Diarize controls */}
      <div className="speakers-stage__diarize-controls">
        <label className="speakers-stage__speakers-label">
          Speakers
          <input
            type="number"
            className="speakers-stage__speakers-input"
            min={1}
            max={20}
            placeholder="Auto"
            value={numSpeakers ?? ''}
            onChange={(e) => setNumSpeakers(e.target.value ? Number(e.target.value) : undefined)}
          />
        </label>
        <button
          className="speakers-stage__diarize-btn"
          onClick={() => diarize(jobId, numSpeakers)}
          disabled={diarizeState.status === 'diarizing'}
        >
          {diarizeState.status === 'diarizing'
            ? `Detecting speakers... ${diarizeState.progress}%`
            : diarizeState.status === 'done'
              ? 'Re-detect speakers'
              : 'Detect speakers'}
        </button>
        {diarizeState.status === 'failed' && diarizeState.error && (
          <p className="speakers-stage__diarize-error">{diarizeState.error}</p>
        )}
      </div>

      {/* Phrase speaker assignment list */}
      {session && hasSpeakers ? (
        <div className="speakers-stage__phrase-list">
          {session.phrases.map((phrase, phraseIndex) => {
            const speakerIdx = phrase.dominantSpeaker
              ? parseInt(phrase.dominantSpeaker.replace('SPEAKER_', ''), 10) % 8
              : undefined
            const phraseText = phrase.words.map((w) => w.word).join(' ')
            const speakerDisplay = phrase.dominantSpeaker
              ? (speakerNames[phrase.dominantSpeaker] ?? phrase.dominantSpeaker)
              : null

            // Global word offset for reassignment (first word in this phrase)
            const globalOffset = session.phrases
              .slice(0, phraseIndex)
              .reduce((sum, p) => sum + p.words.length, 0)
            const firstWordIndex = globalOffset

            return (
              <div
                key={phraseIndex}
                className="speakers-stage__phrase-row"
                data-speaker-index={speakerIdx}
              >
                {speakerDisplay && (
                  <SpeakerBadge
                    speakerId={phrase.dominantSpeaker!}
                    displayName={speakerDisplay}
                    allSpeakers={allSpeakers}
                    speakerNames={speakerNames}
                    onReassign={(newSpeakerId) => {
                      // Reassign all words in this phrase
                      for (let i = 0; i < phrase.words.length; i++) {
                        reassignWordSpeaker(firstWordIndex + i, newSpeakerId)
                      }
                    }}
                  />
                )}
                <span className="speakers-stage__phrase-text">{phraseText}</span>
              </div>
            )
          })}
        </div>
      ) : session && !hasSpeakers ? (
        <div className="speakers-stage__empty">
          <p className="speakers-stage__empty-msg">
            Run speaker detection to see speaker assignments.
          </p>
        </div>
      ) : null}
    </div>
  )
}

// ---- Internal speaker badge with dropdown ----

interface SpeakerBadgeProps {
  speakerId: string
  displayName: string
  allSpeakers: string[]
  speakerNames: Record<string, string>
  onReassign: (speakerId: string) => void
}

function SpeakerBadge({ speakerId, displayName, allSpeakers, speakerNames, onReassign }: SpeakerBadgeProps) {
  const [open, setOpen] = useState(false)
  const speakerIdx = parseInt(speakerId.replace('SPEAKER_', ''), 10) % 8

  return (
    <span className="speakers-stage__speaker-badge" data-speaker-index={speakerIdx}>
      <button
        className="speakers-stage__badge-btn"
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        {displayName} ▾
      </button>
      {open && (
        <div className="speakers-stage__dropdown">
          {allSpeakers.map((sid) => {
            const idx = parseInt(sid.replace('SPEAKER_', ''), 10) % 8
            return (
              <button
                key={sid}
                className={`speakers-stage__dropdown-option${sid === speakerId ? ' speakers-stage__dropdown-option--active' : ''}`}
                data-speaker-index={idx}
                type="button"
                onClick={() => {
                  onReassign(sid)
                  setOpen(false)
                }}
              >
                {speakerNames[sid] ?? sid}
              </button>
            )
          })}
        </div>
      )}
    </span>
  )
}
