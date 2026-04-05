import { bundle } from '@remotion/bundler'
import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { updateJob } from './jobStore.ts'
import type { Job } from '@eigen/shared-types'
import type { SubtitleCompositionProps } from '@eigen/remotion-composition'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let bundleLocation: string | null = null

export async function initBundle(): Promise<void> {
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
    if (!hasFinished && code !== 0) {
      updateJob(jobs, jobId, {
        status: 'failed',
        error: `Render worker exited with code ${code}`,
      })
    }
  })
}
