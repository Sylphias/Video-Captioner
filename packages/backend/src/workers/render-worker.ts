import { parentPort, workerData } from 'node:worker_threads'
import { renderMedia, selectComposition } from '@remotion/renderer'
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
} = workerData as RenderWorkerData

try {
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  })

  // Override static placeholder metadata with actual video values
  const resolvedComposition = {
    ...composition,
    durationInFrames,
    fps,
    width,
    height,
  }

  await renderMedia({
    composition: resolvedComposition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    onProgress: ({ progress }) => {
      parentPort?.postMessage({ type: 'progress', progress: Math.round(progress * 100) })
    },
  })

  parentPort?.postMessage({ type: 'done' })
} catch (err) {
  const message = err instanceof Error ? err.message : String(err)
  parentPort?.postMessage({ type: 'error', error: message })
  process.exit(1)
}
