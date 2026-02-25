import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'

async function jobRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/jobs/:jobId/status — Server-Sent Events stream of job progress
  fastify.get('/api/jobs/:jobId/status', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }

    // Write SSE headers manually (most reliable approach per plan research notes)
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    // Send initial comment to establish connection
    reply.raw.write(': connected\n\n')

    // Poll job store every 500ms and push SSE events
    const interval = setInterval(() => {
      const job = fastify.jobs.get(jobId)

      if (!job) {
        reply.raw.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`)
        clearInterval(interval)
        reply.raw.end()
        return
      }

      reply.raw.write(`data: ${JSON.stringify(job)}\n\n`)

      // Close when terminal state reached
      if (job.status === 'ready' || job.status === 'failed') {
        clearInterval(interval)
        reply.raw.end()
      }
    }, 500)

    // Clean up interval if client disconnects early
    req.raw.on('close', () => {
      clearInterval(interval)
    })
  })

  // GET /api/jobs/:jobId/thumbnail — Serve the thumbnail JPEG
  fastify.get('/api/jobs/:jobId/thumbnail', async (req, reply) => {
    const { jobId } = req.params as { jobId: string }

    const job = fastify.jobs.get(jobId)
    if (!job) {
      return reply.code(404).send({ error: 'Job not found' })
    }

    if (!job.thumbnailPath) {
      return reply.code(404).send({ error: 'Thumbnail not yet available' })
    }

    // Verify the thumbnail file actually exists before serving
    try {
      await access(job.thumbnailPath)
    } catch {
      return reply.code(404).send({ error: 'Thumbnail file not found on disk' })
    }

    reply.header('Content-Type', 'image/jpeg')
    return reply.send(createReadStream(job.thumbnailPath))
  })
}

export default fp(jobRoutes)
