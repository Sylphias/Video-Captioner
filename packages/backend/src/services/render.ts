import { bundle } from '@remotion/bundler'
import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { updateJob } from './jobStore.ts'
import type { Job } from '@eigen/shared-types'
import type { SubtitleCompositionProps } from '@eigen/remotion-composition'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let bundleLocation: string | null = null

// Live render worker threads, tracked so shutdown can terminate them (T-15-21).
// Workers are in-process threads (threadId is not an OS pid), so they cannot go in childRegistry.
const activeWorkers = new Set<Worker>()

export function terminateActiveRenders(): void {
  for (const worker of [...activeWorkers]) {
    // Best-effort: terminate() returns a promise; ignore rejection during shutdown
    void worker.terminate().catch(() => undefined)
  }
  activeWorkers.clear()
}

export async function initBundle(): Promise<void> {
  // Packaged mode (Pattern 2, Pitfall 3): webpack bundle() cannot run against asar-packed source
  // and is slow on every launch, so reuse the prebuilt bundle shipped as extraResources.
  if (process.env.IS_PACKAGED === '1') {
    const prebuilt = process.env.REMOTION_BUNDLE_DIR
    if (!prebuilt || !existsSync(prebuilt)) {
      throw new Error(
        'Packaged app missing its prebuilt Remotion bundle — rebuild the installer ' +
          `(REMOTION_BUNDLE_DIR=${prebuilt ?? '<unset>'})`,
      )
    }
    bundleLocation = prebuilt
    console.log(`[render] Using prebuilt Remotion bundle at ${bundleLocation}`)
    return
  }

  const entryPoint = path.resolve(
    __dirname,
    '../../../remotion-composition/src/remotion-entry.ts',
  )
  bundleLocation = await bundle({ entryPoint })
  console.log(`[render] Remotion bundle ready at ${bundleLocation}`)
}

export function getBundleLocation(): string {
  if (!bundleLocation) throw new Error('Remotion bundle not initialized — call initBundle() first')
  return bundleLocation
}

export function dispatchRender(
  jobs: Map<string, Job>,
  jobId: string,
  outputPath: string,
  inputProps: SubtitleCompositionProps,
): void {
  const job = jobs.get(jobId)
  if (!job || !job.metadata) {
    updateJob(jobs, jobId, { status: 'failed', error: 'Job metadata not available for render' })
    return
  }

  const { fps, width, height, duration } = job.metadata
  const durationInFrames = Math.floor(duration * fps)
  const currentBundleLocation = getBundleLocation()

  const workerPath = path.resolve(__dirname, '../workers/render-worker.ts')
  const jobDir = path.join(path.dirname(outputPath)) // e.g. DATA_ROOT/{jobId}

  const worker = new Worker(workerPath, {
    workerData: {
      bundleLocation: currentBundleLocation,
      outputPath,
      compositionId: 'SubtitleComposition',
      inputProps,
      durationInFrames,
      fps,
      width,
      height,
      jobDir,
    },
  })

  activeWorkers.add(worker)
  let hasFinished = false

  worker.on('message', (msg: { type: string; progress?: number }) => {
    if (msg.type === 'progress' && msg.progress !== undefined) {
      updateJob(jobs, jobId, { progress: msg.progress })
    } else if (msg.type === 'done') {
      hasFinished = true
      updateJob(jobs, jobId, { status: 'rendered', progress: 100, outputPath })
    } else if (msg.type === 'error') {
      hasFinished = true
      const errMsg = (msg as { type: string; error?: string }).error ?? 'Unknown render error'
      updateJob(jobs, jobId, { status: 'failed', error: errMsg })
    }
  })

  worker.on('error', (err: Error) => {
    hasFinished = true
    updateJob(jobs, jobId, { status: 'failed', error: err.message })
  })

  worker.on('exit', (code: number) => {
    activeWorkers.delete(worker)
    if (!hasFinished && code !== 0) {
      updateJob(jobs, jobId, {
        status: 'failed',
        error: `Render worker exited with code ${code}`,
      })
    }
  })
}
