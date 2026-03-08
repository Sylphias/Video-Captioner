export type JobStatus = 'uploading' | 'normalizing' | 'ready' | 'transcribing' | 'transcribed' | 'diarizing' | 'rendering' | 'rendered' | 'failed'

export interface VideoMetadata {
  duration: number     // seconds
  fps: number
  width: number
  height: number
  codec: string
}

export interface Job {
  id: string
  status: JobStatus
  progress: number         // 0-100
  originalFilename?: string
  metadata?: VideoMetadata
  thumbnailPath?: string
  transcriptPath?: string  // absolute path to transcript.json (internal only — not sent to client)
  outputPath?: string      // absolute path to output.mp4 (internal only — not sent to client)
  error?: string
  createdAt: number        // Date.now()
}

export interface TranscriptWord {
  word: string
  start: number    // seconds
  end: number      // seconds
  confidence: number  // 0.0-1.0
  speaker?: string    // e.g. "SPEAKER_00", "SPEAKER_01" — undefined if diarization not run
}

export interface Transcript {
  language: string
  words: TranscriptWord[]
}

export interface TranscriptPhrase {
  words: TranscriptWord[]
  dominantSpeaker?: string  // e.g. "SPEAKER_00" — set by diarization, optional
  lingerDuration?: number   // per-phrase linger in seconds; overrides global style.lingerDuration when set
}
