import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { MEDIA_ROOT } from '../index.ts'

// HuggingFace user access tokens are "hf_" + alphanumerics. Format check only (no network call).
const HF_TOKEN_RE = /^hf_[A-Za-z0-9_-]{8,}$/

const INVALID_TOKEN = 'Invalid token — check your HuggingFace access token and try again.'
const BAD_FOLDER = 'Folder is not writable — choose a different location.'

/** The folder must be an absolute, existing directory we can actually create a file in. */
function isWritableDirectory(dir: string): boolean {
  try {
    if (!path.isAbsolute(dir)) return false
    if (!fs.statSync(dir).isDirectory()) return false
    const probe = path.join(dir, `.eigen-write-test-${randomUUID()}`)
    fs.writeFileSync(probe, '')
    fs.rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}

async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  function snapshot() {
    return {
      // Folder the user has chosen (or the one currently in use when none is saved)
      mediaRoot: fastify.appConfig.getSetting('mediaRoot') ?? MEDIA_ROOT,
      // Folder this backend process is actually using; differs until the app restarts
      activeMediaRoot: MEDIA_ROOT,
      // Never echo the raw token (T-15-73) — only whether one is available
      hasToken: Boolean(fastify.appConfig.getSetting('hfToken') || process.env.HUGGINGFACE_TOKEN),
    }
  }

  // GET /api/settings
  fastify.get('/api/settings', async () => snapshot())

  // PUT /api/settings — { hfToken?, mediaRoot? }. hfToken '' clears the saved token.
  fastify.put('/api/settings', async (req, reply) => {
    const body = (req.body ?? {}) as { hfToken?: unknown; mediaRoot?: unknown }
    const { hfToken, mediaRoot } = body

    if (hfToken !== undefined && typeof hfToken !== 'string') {
      return reply.code(400).send({ field: 'hfToken', error: INVALID_TOKEN })
    }
    if (mediaRoot !== undefined && typeof mediaRoot !== 'string') {
      return reply.code(400).send({ field: 'mediaRoot', error: BAD_FOLDER })
    }

    // Validate everything before saving anything so a rejected request changes nothing (T-15-72)
    const token = hfToken?.trim()
    if (token && !HF_TOKEN_RE.test(token)) {
      return reply.code(400).send({ field: 'hfToken', error: INVALID_TOKEN })
    }
    const folder = mediaRoot?.trim()
    if (folder !== undefined && !isWritableDirectory(folder)) {
      return reply.code(400).send({ field: 'mediaRoot', error: BAD_FOLDER })
    }

    if (token !== undefined) fastify.appConfig.setSetting('hfToken', token)
    if (folder !== undefined) fastify.appConfig.setSetting('mediaRoot', folder)

    return snapshot()
  })
}

export default fp(settingsRoutes)
