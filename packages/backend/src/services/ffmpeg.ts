import { spawn, execFileSync } from 'node:child_process'
import type { VideoMetadata } from '@eigen/shared-types'

const FFMPEG = '/opt/homebrew/bin/ffmpeg'
const FFPROBE = '/opt/homebrew/bin/ffprobe'

// Verify FFmpeg binaries exist at module load time
try {
  execFileSync('which', ['ffmpeg'], { stdio: 'ignore' })
} catch {
  const msg = 'FFmpeg not found. Install with: brew install ffmpeg'
  console.error(msg)
  throw new Error(msg)
}

/**
 * Normalize a video file to CFR H.264 + AAC .mp4.
 * Uses -progress pipe:1 for machine-readable progress output on stdout.
 *
 * @param inputPath - Path to the source video file
 * @param outputPath - Path to the output .mp4 file
 * @param onProgress - Optional callback receiving progress 0–100
 * @param durationMs - Optional total duration in milliseconds for progress calculation
 */
export function normalizeVideo(
  inputPath: string,
  outputPath: string,
  onProgress?: (percent: number) => void,
  durationMs?: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-r', '30',              // force 30fps CFR
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-progress', 'pipe:1',   // machine-readable progress on stdout
      '-y',                    // overwrite without asking
      outputPath,
    ]

    const proc = spawn(FFMPEG, args)
    let stderr = ''
    let stdoutBuf = ''

    // Parse progress from stdout (FFmpeg -progress pipe:1 format)
    proc.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString()
      const lines = stdoutBuf.split('\n')
      stdoutBuf = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('out_time_ms=') && durationMs && onProgress) {
          const outTimeMs = parseInt(line.split('=')[1], 10)
          if (!isNaN(outTimeMs) && durationMs > 0) {
            const percent = Math.min(100, Math.round((outTimeMs / durationMs) * 100 / 1000))
            onProgress(percent)
          }
        }
      }
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        if (onProgress) onProgress(100)
        resolve()
      } else {
        reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-500)}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`))
    })
  })
}

/**
 * Probe a video file and extract metadata using FFprobe.
 * Returns duration, fps, width, height, and codec.
 */
export function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath,
    ]

    const proc = spawn(FFPROBE, args)
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`FFprobe failed (exit ${code}): ${stderr.slice(-500)}`))
      }

      try {
        const data = JSON.parse(stdout) as {
          streams: Array<{
            codec_type: string
            codec_name: string
            r_frame_rate: string
            width: number
            height: number
          }>
          format: { duration: string }
        }

        const videoStream = data.streams.find((s) => s.codec_type === 'video')
        if (!videoStream) {
          return reject(new Error('FFprobe: no video stream found'))
        }

        // Parse "num/den" frame rate fraction
        const [fpNum, fpDen] = videoStream.r_frame_rate.split('/').map(Number)
        const fps = fpDen && fpDen > 0 ? Math.round(fpNum / fpDen) : fpNum

        resolve({
          duration: parseFloat(data.format.duration),
          fps,
          width: videoStream.width,
          height: videoStream.height,
          codec: videoStream.codec_name,
        })
      } catch (parseErr) {
        reject(new Error(`FFprobe: failed to parse output: ${String(parseErr)}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn FFprobe: ${err.message}`))
    })
  })
}
