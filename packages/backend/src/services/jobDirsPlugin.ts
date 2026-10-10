import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import path from 'node:path'

import { DATA_ROOT, MEDIA_ROOT } from '../index.ts'
import { createJobDirResolver, type JobDirResolver } from './jobDirs.ts'

declare module 'fastify' {
  interface FastifyInstance {
    jobDirs: JobDirResolver
  }
}

/**
 * Wires the job-folder resolver to the projects table and app settings.
 * Must register after projectStore and appConfig.
 *
 * Probe order for an existing job: root recorded on its project row, current MEDIA_ROOT,
 * the default roots (dev: MEDIA_ROOT defaults to DATA_ROOT; packaged: <userData>/media, the
 * sibling of DATA_ROOT=<userData>/data, see packages/desktop/src/config.ts), the saved
 * mediaRoot setting, then every other root recorded in the projects table.
 */
async function jobDirsPlugin(fastify: FastifyInstance): Promise<void> {
  const db = fastify.projectsDb
  const recordedRootStmt = db.prepare<[string], { media_root: string }>(
    'SELECT media_root FROM projects WHERE job_id = ? AND media_root IS NOT NULL LIMIT 1',
  )
  const knownRootsStmt = db.prepare<[], { media_root: string }>(
    'SELECT DISTINCT media_root FROM projects WHERE media_root IS NOT NULL',
  )
  // Lazy backfill: does not touch updated_at, so the projects list order is unchanged
  const backfillStmt = db.prepare(
    'UPDATE projects SET media_root = ? WHERE job_id = ? AND (media_root IS NULL OR media_root <> ?)',
  )

  const resolver = createJobDirResolver({
    currentRoot: MEDIA_ROOT,
    recordedRoot: (jobId) => recordedRootStmt.get(jobId)?.media_root ?? null,
    fallbackRoots: () => [
      DATA_ROOT,
      path.join(path.dirname(DATA_ROOT), 'media'),
      fastify.appConfig.getSetting('mediaRoot'),
      ...knownRootsStmt.all().map((r) => r.media_root),
    ],
    onResolved: (jobId, root) => {
      try {
        backfillStmt.run(root, jobId, root)
      } catch (err) {
        fastify.log.warn({ jobId, err }, 'Could not record media root for job')
      }
    },
  })

  fastify.decorate('jobDirs', resolver)
}

export default fp(jobDirsPlugin)
