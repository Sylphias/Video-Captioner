import { spawn } from 'node:child_process'

const FFMPEG = 'ffmpeg'

/**
 * Extract a thumbnail JPEG from a video at the 1-second mark.
 * Uses -ss before -i for fast input seeking.
 *
 * @param inputPath - Path to the source video file
 * @param outputPath - Path to the output .jpg file
 */
export function extractThumbnail(
  inputPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-ss', '1',           // seek to 1 second BEFORE input for fast seeking
      '-i', inputPath,
      '-vframes', '1',      // extract exactly 1 frame
      '-q:v', '2',          // high quality JPEG (scale 2–31, 2 is best)
      '-y',                 // overwrite without asking
      outputPath,
    ]

    const proc = spawn(FFMPEG, args)
    let stderr = ''

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`FFmpeg thumbnail extraction failed (exit ${code}): ${stderr.slice(-500)}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg for thumbnail: ${err.message}`))
    })
  })
}
