export type JobStatus = 'uploading' | 'normalizing' | 'ready' | 'failed'

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
  error?: string
  createdAt: number        // Date.now()
}
