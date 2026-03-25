import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'

// ── Request body types ────────────────────────────────────────────────────────

interface CreatePresetBody {
  name: string
  scope: string
  enter: Record<string, unknown>
  active: Record<string, unknown>
  exit: Record<string, unknown>
  keyframeTracks?: unknown  // KeyframePhases (object) or legacy KeyframeTrack[] (array)
  highlightAnimation?: unknown  // HighlightKeyframeConfig
}

interface UpdatePresetBody {
  name?: string
  scope?: string
  enter?: Record<string, unknown>
  active?: Record<string, unknown>
  exit?: Record<string, unknown>
  keyframeTracks?: unknown  // KeyframePhases (object) or legacy KeyframeTrack[] (array)
  highlightAnimation?: unknown  // HighlightKeyframeConfig
}

// ── Row → response shape mapper ───────────────────────────────────────────────

interface PresetRow {
  id: string
  name: string
  is_builtin: number
  scope: string
  params: string
  created_at: number
  updated_at: number
}

function rowToPreset(row: PresetRow) {
  const params = JSON.parse(row.params) as Record<string, unknown>
  return {
    id: row.id,
    name: row.name,
    isBuiltin: Boolean(row.is_builtin),
    scope: row.scope,
    ...params,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Route plugin ──────────────────────────────────────────────────────────────

async function presetsRoutes(fastify: FastifyInstance): Promise<void> {
  // Prepared statements bound to the db instance from the animationPresetsPlugin
  const getAllStmt = fastify.db.prepare<[], PresetRow>(
    'SELECT * FROM animation_presets ORDER BY created_at ASC'
  )
  const getByIdStmt = fastify.db.prepare<[string], PresetRow>(
    'SELECT * FROM animation_presets WHERE id = ?'
  )
  const insertStmt = fastify.db.prepare(
    'INSERT INTO animation_presets (id, name, is_builtin, scope, params, created_at, updated_at) VALUES (?, ?, 0, ?, ?, ?, ?)'
  )
  const updateStmt = fastify.db.prepare(
    'UPDATE animation_presets SET name = ?, scope = ?, params = ?, updated_at = ? WHERE id = ?'
  )
  const deleteStmt = fastify.db.prepare(
    'DELETE FROM animation_presets WHERE id = ?'
  )

  // GET /api/presets — return all presets as JSON array
  fastify.get('/api/presets', async (_req, reply) => {
    const rows = getAllStmt.all()
    return reply.send(rows.map(rowToPreset))
  })

  // POST /api/presets — create a new user-defined preset
  fastify.post('/api/presets', async (req, reply) => {
    const body = req.body as CreatePresetBody

    if (!body.name || !body.scope || !body.enter || !body.active || !body.exit) {
      return reply.code(400).send({ error: 'Missing required fields: name, scope, enter, active, exit' })
    }

    const id = crypto.randomUUID()
    const now = Date.now()
    const paramsObj: Record<string, unknown> = { enter: body.enter, active: body.active, exit: body.exit }
    if (body.keyframeTracks !== undefined) {
      paramsObj.keyframeTracks = body.keyframeTracks
    }
    if (body.highlightAnimation !== undefined) {
      paramsObj.highlightAnimation = body.highlightAnimation
    }
    const params = JSON.stringify(paramsObj)

    insertStmt.run(id, body.name, body.scope, params, now, now)

    const row = getByIdStmt.get(id)!
    return reply.code(201).send(rowToPreset(row))
  })

  // PUT /api/presets/:id — update an existing user-defined preset
  fastify.put('/api/presets/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as UpdatePresetBody

    const existing = getByIdStmt.get(id)
    if (!existing) {
      return reply.code(404).send({ error: 'Preset not found' })
    }

    if (existing.is_builtin === 1) {
      return reply.code(403).send({ error: 'Cannot modify built-in presets' })
    }

    // Merge with existing params
    const existingParams = JSON.parse(existing.params) as Record<string, unknown>
    const mergedParams: Record<string, unknown> = {
      enter: body.enter ?? existingParams.enter,
      active: body.active ?? existingParams.active,
      exit: body.exit ?? existingParams.exit,
    }
    // Preserve or update keyframeTracks: if provided in body, use it; if not, keep existing
    const updatedKeyframeTracks = body.keyframeTracks ?? existingParams.keyframeTracks
    if (updatedKeyframeTracks !== undefined) {
      mergedParams.keyframeTracks = updatedKeyframeTracks
    }
    // Preserve or update highlightAnimation
    const updatedHighlight = body.highlightAnimation ?? existingParams.highlightAnimation
    if (updatedHighlight !== undefined) {
      mergedParams.highlightAnimation = updatedHighlight
    }

    const updatedName = body.name ?? existing.name
    const updatedScope = body.scope ?? existing.scope
    const now = Date.now()

    updateStmt.run(updatedName, updatedScope, JSON.stringify(mergedParams), now, id)

    const updated = getByIdStmt.get(id)!
    return reply.send(rowToPreset(updated))
  })

  // DELETE /api/presets/:id — remove a user-defined preset
  fastify.delete('/api/presets/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const existing = getByIdStmt.get(id)
    if (!existing) {
      return reply.code(404).send({ error: 'Preset not found' })
    }

    if (existing.is_builtin === 1) {
      return reply.code(403).send({ error: 'Cannot delete built-in presets' })
    }

    deleteStmt.run(id)
    return reply.send({ ok: true })
  })

  // POST /api/presets/:id/duplicate — create a copy of an existing preset
  fastify.post('/api/presets/:id/duplicate', async (req, reply) => {
    const { id } = req.params as { id: string }

    const source = getByIdStmt.get(id)
    if (!source) {
      return reply.code(404).send({ error: 'Preset not found' })
    }

    const newId = crypto.randomUUID()
    const now = Date.now()
    const newName = `${source.name} (Copy)`

    // Copy scope and params from source, is_builtin = 0
    insertStmt.run(newId, newName, source.scope, source.params, now, now)

    const newRow = getByIdStmt.get(newId)!
    return reply.code(201).send(rowToPreset(newRow))
  })
}

export default fp(presetsRoutes)
