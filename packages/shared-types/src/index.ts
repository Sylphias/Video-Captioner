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
  styleOverride?: Record<string, unknown>  // phrase-level style override, applied on top of speaker styles
  animationPresetId?: string  // per-phrase animation preset override (resolved to full AnimationPreset at serialization boundary)
}

// Animation scope: phrase-level (whole phrase animates together) or word-level (each word animates independently)
export type AnimationScope = 'phrase' | 'word'

// Enter/exit animation types
export type EnterExitType = 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'
  | 'pop' | 'bounce' | 'fly-in' | 'shrink' | 'typewriter' | 'letter-by-letter' | 'word-cascade' | 'blur-reveal'

// Active (hold) animation types — loops while phrase is on screen
export type ActiveType = 'none' | 'jiggle' | 'wave' | 'pulse' | 'bounce'

// Easing options — maps to Remotion Easing functions
export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  | 'ease-in-cubic' | 'ease-out-cubic' | 'ease-in-out-cubic'
  | 'bounce' | 'elastic' | 'back' | 'spring'

// Per-phase configuration for enter or exit
export interface AnimationPhaseConfig {
  type: EnterExitType
  durationSec: number         // e.g. 0.3
  easing: EasingType
  params: Record<string, number>  // type-specific params (slideOffsetFraction, staggerFrames, etc.)
}

// Active phase configuration
export interface ActivePhaseConfig {
  type: ActiveType
  cycleDurationSec: number    // duration of one loop cycle
  intensity: number           // 0-1 amplitude/strength multiplier
}

// The full animation preset — stored in SQLite, applied in composition
export interface AnimationPreset {
  id: string
  name: string
  isBuiltin: boolean
  scope: AnimationScope
  enter: AnimationPhaseConfig
  active: ActivePhaseConfig
  exit: AnimationPhaseConfig & { mirrorEnter: boolean }  // exit can mirror enter by default
  createdAt: number
  updatedAt: number
}
