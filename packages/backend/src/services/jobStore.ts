import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import type { Job } from '@eigen/shared-types'

// TypeScript module augmentation — gives fastify.jobs proper typing everywhere
declare module 'fastify' {
  interface FastifyInstance {
    jobs: Map<string, Job>
  }
}

async function jobStorePlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorate('jobs', new Map<string, Job>())
}

export default fp(jobStorePlugin)

/**
 * Create a new Job record with status 'uploading'.
 */
export function createJob(id: string, filename: string): Job {
  return {
    id,
    status: 'uploading',
    progress: 0,
    originalFilename: filename,
    createdAt: Date.now(),
  }
}

/**
 * Apply a partial update to an existing job in the store.
 */
export function updateJob(
  jobs: Map<string, Job>,
  id: string,
  update: Partial<Job>
): void {
  const existing = jobs.get(id)
  if (!existing) return
  jobs.set(id, { ...existing, ...update })
}
