import { parentPort, workerData } from 'node:worker_threads'
import { renderMedia, selectComposition } from '@remotion/renderer'
import { createServer } from 'node:net'
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

  await renderMedia({
    composition: resolvedComposition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    port,
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
