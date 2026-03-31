import { spawn } from 'node:child_process'

const FFMPEG = 'ffmpeg'

// Module-level cache: keyed by jobId -> Float32Array of 2000 amplitude samples (0.0-1.0)
const waveformCache = new Map<string, Float32Array>()

/**
 * Extract audio waveform amplitude data from a video file using FFmpeg.
 *
 * Extracts mono PCM at 8kHz (sufficient for visual waveform), then downsamples
 * to ~2000 points using peak amplitude bucketing. Caches result by jobId.
 *
 * @param jobId    - Cache key (to avoid re-extracting per request)
 * @param videoPath - Absolute path to the normalized .mp4 file
 * @returns Float32Array of 2000 peak amplitude values, normalized 0.0–1.0
 */
export async function extractWaveform(jobId: string, videoPath: string): Promise<Float32Array> {
  // Return cached result if already extracted
  const cached = waveformCache.get(jobId)
  if (cached) return cached

  const samples = await extractRawSamples(videoPath)
  const downsampled = downsampleToPeaks(samples, 2000)

  waveformCache.set(jobId, downsampled)
  return downsampled
}

/**
 * Run FFmpeg to extract mono 8kHz raw f32le PCM from the video audio track.
 * Returns a Float32Array of all raw samples.
 */
function extractRawSamples(videoPath: string): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-af', [
        'highpass=f=100',      // cut below 100Hz (rumble, wind, AC hum)
        'lowpass=f=3000',      // cut above 3kHz (hiss, high-frequency noise)
        'dynaudnorm=p=0.9',   // normalize dynamics so speech peaks stand out
      ].join(','),
      '-ac', '1',          // mono
      '-ar', '8000',       // 8kHz sample rate — enough for visual waveform
      '-f', 'f32le',       // raw 32-bit float little-endian
      '-acodec', 'pcm_f32le',
      'pipe:1',            // output to stdout
    ]

    const proc = spawn(FFMPEG, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    const chunks: Buffer[] = []
    let stderr = ''

    proc.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (code === 0 || chunks.length > 0) {
        // Combine all chunks into a single Buffer, then view as Float32Array
        const combined = Buffer.concat(chunks)
        const floats = new Float32Array(combined.buffer, combined.byteOffset, Math.floor(combined.byteLength / 4))
        resolve(floats)
      } else {
        reject(new Error(`FFmpeg waveform extraction failed (exit ${code}): ${stderr.slice(-300)}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn FFmpeg for waveform: ${err.message}`))
    })
  })
}

/**
 * Downsample raw PCM samples to `targetPoints` data points using peak
 * amplitude bucketing. Each bucket takes the max absolute value.
 * Output is normalized to 0.0–1.0.
 */
function downsampleToPeaks(samples: Float32Array, targetPoints: number): Float32Array {
  const result = new Float32Array(targetPoints)

  if (samples.length === 0) return result

  const bucketSize = samples.length / targetPoints
  let globalMax = 0

  // First pass: compute peaks per bucket + find global max for normalization
  const peaks = new Float32Array(targetPoints)
  for (let i = 0; i < targetPoints; i++) {
    const start = Math.floor(i * bucketSize)
    const end = Math.min(Math.floor((i + 1) * bucketSize), samples.length)
    let bucketMax = 0
    for (let j = start; j < end; j++) {
      const abs = Math.abs(samples[j])
      if (abs > bucketMax) bucketMax = abs
    }
    peaks[i] = bucketMax
    if (bucketMax > globalMax) globalMax = bucketMax
  }

  // Second pass: normalize to 0.0–1.0
  if (globalMax > 0) {
    for (let i = 0; i < targetPoints; i++) {
      result[i] = peaks[i] / globalMax
    }
  }

  return result
}
