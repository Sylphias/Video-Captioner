import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'

// ── Request body types ────────────────────────────────────────────────────────

interface LaneLayout {
  speakerLanes: Record<string, { verticalPosition: number }>
  overlapGap: number
  maxVisibleRows: number
}

interface CreateLanePresetBody {
  name: string
  layout: LaneLayout
}

interface UpdateLanePresetBody {
  name?: string
  layout?: LaneLayout
}

// ── Row → response shape mapper ───────────────────────────────────────────────

interface LanePresetRow {
  id: string
  name: string
  layout: string
  created_at: number
  updated_at: number
}

function rowToPreset(row: LanePresetRow) {
  return {
    id: row.id,
    name: row.name,
    layout: JSON.parse(row.layout) as LaneLayout,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Route plugin ──────────────────────────────────────────────────────────────

async function lanePresetsRoutes(fastify: FastifyInstance): Promise<void> {
  // Prepared statements bound to the lanePresetsDb instance from lanePresetsPlugin
  const getAllStmt = fastify.lanePresetsDb.prepare<[], LanePresetRow>(
    'SELECT * FROM lane_presets ORDER BY created_at ASC'
  )
  const getByIdStmt = fastify.lanePresetsDb.prepare<[string], LanePresetRow>(
    'SELECT * FROM lane_presets WHERE id = ?'
  )
  const insertStmt = fastify.lanePresetsDb.prepare(
    'INSERT INTO lane_presets (id, name, layout, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  )
  const updateStmt = fastify.lanePresetsDb.prepare(
    'UPDATE lane_presets SET name = ?, layout = ?, updated_at = ? WHERE id = ?'
  )
  const deleteStmt = fastify.lanePresetsDb.prepare(
    'DELETE FROM lane_presets WHERE id = ?'
  )

  // GET /api/lane-presets — return all presets sorted by created_at ASC
  fastify.get('/api/lane-presets', async (_req, reply) => {
    const rows = getAllStmt.all()
    return reply.send(rows.map(rowToPreset))
  })

  // POST /api/lane-presets — create a new lane preset
  fastify.post('/api/lane-presets', async (req, reply) => {
    const body = req.body as CreateLanePresetBody

    if (!body.name || !body.layout) {
      return reply.code(400).send({ error: 'Missing required fields: name, layout' })
    }

    const id = crypto.randomUUID()
    const now = Date.now()
    const layoutJson = JSON.stringify(body.layout)

    insertStmt.run(id, body.name, layoutJson, now, now)

    const row = getByIdStmt.get(id)!
    return reply.code(201).send(rowToPreset(row))
  })

  // PUT /api/lane-presets/:id — update an existing lane preset
  fastify.put('/api/lane-presets/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as UpdateLanePresetBody

    const existing = getByIdStmt.get(id)
    if (!existing) {
      return reply.code(404).send({ error: 'Lane preset not found' })
    }

    const updatedName = body.name ?? existing.name
    // If layout provided, replace entire layout JSON; otherwise keep existing
    const updatedLayout = body.layout !== undefined
      ? JSON.stringify(body.layout)
      : existing.layout
    const now = Date.now()

    updateStmt.run(updatedName, updatedLayout, now, id)

    const updated = getByIdStmt.get(id)!
    return reply.send(rowToPreset(updated))
  })

  // DELETE /api/lane-presets/:id — remove a lane preset
  fastify.delete('/api/lane-presets/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const existing = getByIdStmt.get(id)
    if (!existing) {
      return reply.code(404).send({ error: 'Lane preset not found' })
    }

    deleteStmt.run(id)
    return reply.code(204).send()
  })
}

export default fp(lanePresetsRoutes)
