import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import path from 'node:path'
import { access } from 'node:fs/promises'

import { DATA_ROOT } from '../index.ts'
import { extractWaveform } from '../services/waveform.ts'
import { probeVideo } from '../services/ffmpeg.ts'

async function waveformRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/jobs/:jobId/waveform — return 2000-point audio waveform amplitude data
  fastify.get('/api/jobs/:jobId/waveform', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const job = fastify.jobs.get(jobId)

    // If job is in memory and still processing, reject
    if (job && (job.status === 'uploading' || job.status === 'normalizing')) {
      return reply.code(409).send({ error: 'Video not yet normalized' })
    }

    const normalizedPath = path.join(DATA_ROOT, jobId, 'normalized.mp4')

    // Verify file exists on disk (works after server restart)
    try {
      await access(normalizedPath)
    } catch {
      return reply.code(404).send({ error: 'Video file not found' })
    }

    // Get duration from in-memory job or probe the file
    let duration: number
    if (job?.metadata?.duration) {
      duration = job.metadata.duration
    } else {
      const meta = await probeVideo(normalizedPath)
      duration = meta.duration
    }

    try {
      const samples = await extractWaveform(jobId, normalizedPath)

      return reply.send({
        samples: Array.from(samples),
        duration,
        sampleRate: 2000 / duration,
      })
    } catch (err) {
      fastify.log.error(err, 'waveform extraction failed')
      return reply.code(500).send({ error: 'Waveform extraction failed' })
    }
  })
}

export default fp(waveformRoutes)
