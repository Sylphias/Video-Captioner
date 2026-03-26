import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import path from 'node:path'

import { DATA_ROOT } from '../index.ts'
import { extractWaveform } from '../services/waveform.ts'

async function waveformRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/jobs/:jobId/waveform — return 2000-point audio waveform amplitude data
  fastify.get('/api/jobs/:jobId/waveform', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }
    const job = fastify.jobs.get(jobId)

    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }

    // Waveform only available once video is normalized (status past 'normalizing')
    if (job.status === 'uploading' || job.status === 'normalizing') {
      return reply.code(409).send({ error: 'Video not yet normalized' })
    }

    if (!job.metadata) {
      return reply.code(409).send({ error: 'Job metadata not available' })
    }

    const normalizedPath = path.join(DATA_ROOT, jobId, 'normalized.mp4')

    try {
      const samples = await extractWaveform(jobId, normalizedPath)

      return reply.send({
        samples: Array.from(samples),
        duration: job.metadata.duration,
        sampleRate: 2000 / job.metadata.duration,
      })
    } catch (err) {
      fastify.log.error(err, 'waveform extraction failed')
      return reply.code(500).send({ error: 'Waveform extraction failed' })
    }
  })
}

export default fp(waveformRoutes)
