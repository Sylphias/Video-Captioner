import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import {
  listTextStyles,
  createTextStyle,
  updateTextStyle,
  deleteTextStyle,
  duplicateTextStyle,
} from '../services/textStyleStore.ts'

// Global text-style library (D-13/14/15). Handlers are thin; rules live in the store.
async function stylesRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/styles — built-ins first, then user styles
  fastify.get('/api/styles', async () => listTextStyles(fastify.textStylesDb))

  // POST /api/styles — create a user style
  fastify.post('/api/styles', async (req, reply) => {
    const r = createTextStyle(fastify.textStylesDb, req.body)
    if (!r.ok) return reply.code(r.status).send({ error: r.error })
    return reply.code(201).send(r.value)
  })

  // PUT /api/styles/:id — rename and/or change a user style (403 for built-ins)
  fastify.put('/api/styles/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const r = updateTextStyle(fastify.textStylesDb, id, req.body)
    if (!r.ok) return reply.code(r.status).send({ error: r.error })
    return reply.send(r.value)
  })

  // DELETE /api/styles/:id — delete a user style (403 for built-ins)
  fastify.delete('/api/styles/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const r = deleteTextStyle(fastify.textStylesDb, id)
    if (!r.ok) return reply.code(r.status).send({ error: r.error })
    return reply.send({ ok: true })
  })

  // POST /api/styles/:id/duplicate — editable copy named "<name> (Copy)"
  fastify.post('/api/styles/:id/duplicate', async (req, reply) => {
    const { id } = req.params as { id: string }
    const r = duplicateTextStyle(fastify.textStylesDb, id)
    if (!r.ok) return reply.code(r.status).send({ error: r.error })
    return reply.code(201).send(r.value)
  })
}

export default fp(stylesRoutes)
