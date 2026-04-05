import { parentPort, workerData } from 'node:worker_threads'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { createServer } from 'node:net'
import { spawn } from 'node:child_process'
import { readdir, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import type { SubtitleCompositionProps } from '@eigen/remotion-composition'

interface RenderWorkerData {
  bundleLocation: string
  outputPath: string
  compositionId: string
  inputProps: SubtitleCompositionProps
  durationInFrames: number
  fps: number
  width: number
  height: number
  jobDir: string
}

const {
  bundleLocation,
  outputPath,
  compositionId,
  inputProps,
  durationInFrames,
  fps,
  width,
  height,
  jobDir,
} = workerData as RenderWorkerData

// Find an available port manually to avoid Remotion's port scanning issue
function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, () => {
      const port = (srv.address() as { port: number }).port
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

/** Find the original uploaded video file in the job directory (original.*) */
async function findOriginalVideo(): Promise<string | null> {
  const files = await readdir(jobDir)
  const original = files.find((f) => f.startsWith('original.'))
  return original ? path.join(jobDir, original) : null
}

/** Replace audio in rendered video with audio from the original upload */
function muxOriginalAudio(renderedPath: string, originalPath: string, finalPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', renderedPath,
      '-i', originalPath,
      '-map', '0:v:0',       // video from rendered
      '-map', '1:a:0',       // audio from original
      '-c:v', 'copy',        // no video re-encode
      '-c:a', 'aac',         // ensure MP4-compatible audio codec
      '-b:a', '320k',
      '-shortest',
      '-y',
      finalPath,
    ]
    const proc = spawn('ffmpeg', args)
    let stderr = ''
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Audio mux failed (exit ${code}): ${stderr.slice(-500)}`))
    })
    proc.on('error', (err) => reject(err))
  })
}

try {
  const port = await findFreePort()

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
    port,
  })

  // Override static placeholder metadata with actual video values
  const resolvedComposition = {
    ...composition,
    durationInFrames,
    fps,
    width,
    height,
  }

  // Render to a temp file first so we can mux original audio afterward
  const tempOutput = outputPath.replace(/\.mp4$/, '_raw.mp4')

  await renderMedia({
    composition: resolvedComposition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: tempOutput,
    inputProps,
    port,
    onProgress: ({ progress }) => {
      // Reserve 0-95% for Remotion render, 95-100% for audio mux
      parentPort?.postMessage({ type: 'progress', progress: Math.round(progress * 95) })
    },
  })

  // Mux original audio into the final output
  const originalPath = await findOriginalVideo()
  if (originalPath) {
    parentPort?.postMessage({ type: 'progress', progress: 96 })
    await muxOriginalAudio(tempOutput, originalPath, outputPath)
    await unlink(tempOutput)
  } else {
    // No original found — use rendered file as-is (already has normalized audio)
    await rename(tempOutput, outputPath)
  }

  parentPort?.postMessage({ type: 'done' })
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  parentPort?.postMessage({ type: 'error', error: message })
  process.exit(1)
}
