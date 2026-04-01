import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import path from 'node:path'
import { rm } from 'node:fs/promises'

import { DATA_ROOT } from '../index.ts'

// ── Row shape (as stored in SQLite) ──────────────────────────────────────────

interface ProjectRow {
  id: string
  job_id: string
  name: string
  state_json: string | null
  duration: number | null
  created_at: number
  updated_at: number
}

// ── Row → camelCase response mapper ──────────────────────────────────────────

function rowToProject(row: ProjectRow) {
  return {
    id: row.id,
    jobId: row.job_id,
    name: row.name,
    stateJson: row.state_json,
    duration: row.duration,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// ── Route plugin ──────────────────────────────────────────────────────────────

async function projectsRoutes(fastify: FastifyInstance): Promise<void> {
  // Prepared statements — omit state_json from list query (can be large)
  const getAllStmt = fastify.projectsDb.prepare<[], ProjectRow>(
    'SELECT id, job_id, name, duration, created_at, updated_at FROM projects ORDER BY updated_at DESC'
  )
  const getByIdStmt = fastify.projectsDb.prepare<[string], ProjectRow>(
    'SELECT * FROM projects WHERE id = ?'
  )
  const insertStmt = fastify.projectsDb.prepare(
    'INSERT INTO projects (id, job_id, name, state_json, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  const updateNameStmt = fastify.projectsDb.prepare(
    'UPDATE projects SET name = ?, updated_at = ? WHERE id = ?'
  )
  const updateStateStmt = fastify.projectsDb.prepare(
    'UPDATE projects SET state_json = ?, updated_at = ? WHERE id = ?'
  )
  const deleteStmt = fastify.projectsDb.prepare(
    'DELETE FROM projects WHERE id = ?'
  )
  const countByJobIdStmt = fastify.projectsDb.prepare<[string], { cnt: number }>(
    'SELECT COUNT(*) as cnt FROM projects WHERE job_id = ?'
  )

  // GET /api/projects — list all projects (no stateJson — too large for list)
  fastify.get('/api/projects', async (_req, reply) => {
    const rows = getAllStmt.all()
    return reply.send(rows.map(rowToProject))
  })

  // POST /api/projects — create a new project record
  fastify.post('/api/projects', async (req, reply) => {
    const body = req.body as { jobId: string; name: string; duration?: number }

    if (!body.jobId || !body.name) {
      return reply.code(400).send({ error: 'Missing required fields: jobId, name' })
    }

    const id = crypto.randomUUID()
    const now = Date.now()
    const duration = body.duration ?? null

    insertStmt.run(id, body.jobId, body.name, null, duration, now, now)

    return reply.code(201).send({
      id,
      jobId: body.jobId,
      name: body.name,
      stateJson: null,
      duration,
      createdAt: now,
      updatedAt: now,
    })
  })

  // GET /api/projects/:id — get a single project including stateJson
  fastify.get('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const row = getByIdStmt.get(id)
    if (!row) {
      return reply.code(404).send({ error: 'Project not found' })
    }

    return reply.send(rowToProject(row))
  })

  // PUT /api/projects/:id — update name and/or stateJson
  fastify.put('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = req.body as { name?: string; stateJson?: string }

    const existing = getByIdStmt.get(id)
    if (!existing) {
      return reply.code(404).send({ error: 'Project not found' })
    }

    if (body.name !== undefined) {
      updateNameStmt.run(body.name, Date.now(), id)
    }
    if (body.stateJson !== undefined) {
      updateStateStmt.run(body.stateJson, Date.now(), id)
    }

    const updated = getByIdStmt.get(id)!
    return reply.send(rowToProject(updated))
  })

  // DELETE /api/projects/:id — remove project; only delete job files if no other projects share jobId
  fastify.delete('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const row = getByIdStmt.get(id)
    if (!row) {
      return reply.code(404).send({ error: 'Project not found' })
    }

    const countRow = countByJobIdStmt.get(row.job_id)!
    if (countRow.cnt <= 1) {
      // Last project referencing this job directory — safe to delete files
      await rm(path.join(DATA_ROOT, row.job_id), { recursive: true, force: true }).catch(() => {})
    }

    deleteStmt.run(id)
    return reply.code(204).send()
  })

  // POST /api/projects/:id/duplicate — create a copy sharing the same jobId
  fastify.post('/api/projects/:id/duplicate', async (req, reply) => {
    const { id } = req.params as { id: string }

    const row = getByIdStmt.get(id)
    if (!row) {
      return reply.code(404).send({ error: 'Project not found' })
    }

    const newId = crypto.randomUUID()
    const now = Date.now()
    const newName = row.name + ' (copy)'

    insertStmt.run(newId, row.job_id, newName, row.state_json, row.duration, now, now)

    return reply.code(201).send({
      id: newId,
      jobId: row.job_id,
      name: newName,
      stateJson: row.state_json,
      duration: row.duration,
      createdAt: now,
      updatedAt: now,
    })
  })

}

export default fp(projectsRoutes)
