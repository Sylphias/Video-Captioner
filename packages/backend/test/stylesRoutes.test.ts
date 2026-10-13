import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import Database from 'better-sqlite3'
import stylesRoutes from '../src/routes/styles.ts'
import {
  ensureTextStylesSchema,
  seedBuiltinTextStyles,
  type TextStyleProps,
} from '../src/services/textStyleStore.ts'

const props = (): TextStyleProps => ({
  fontFamily: 'Inter',
  fontWeight: 700,
  fontSize: 80,
  baseColor: '#FFFFFF',
  highlightColor: '#FFD60A',
  strokeColor: '#000000',
  strokeWidth: 4,
  shadowColor: '#000000',
  shadowOffsetX: 3,
  shadowOffsetY: 3,
  shadowBlur: 2,
  shadowType: 'drop',
  letterSpacing: 0,
  wordSpacing: 0,
})

describe('/api/styles routes', () => {
  let app: FastifyInstance
  let db: Database.Database
  let userId = ''

  beforeAll(async () => {
    db = new Database(':memory:')
    ensureTextStylesSchema(db)
    seedBuiltinTextStyles(db)
    app = Fastify()
    app.decorate('textStylesDb', db)
    await app.register(stylesRoutes)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    db.close()
  })

  it('GET lists the six built-ins first', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/styles' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<Record<string, any>>
    expect(body).toHaveLength(6)
    expect(body[0].name).toBe('Classic')
    for (const s of body) {
      expect(typeof s.id).toBe('string')
      expect(typeof s.name).toBe('string')
      expect(s.isBuiltin).toBe(true)
      expect(s.props.shadowType).toBeDefined()
      expect(typeof s.createdAt).toBe('number')
      expect(typeof s.updatedAt).toBe('number')
    }
  })

  it('POST creates (201) and rejects layout keys (400)', async () => {
    const ok = await app.inject({
      method: 'POST',
      url: '/api/styles',
      payload: { name: 'Mine', props: props() },
    })
    expect(ok.statusCode).toBe(201)
    const created = ok.json() as { id: string; isBuiltin: boolean }
    expect(created.isBuiltin).toBe(false)
    userId = created.id

    const bad = await app.inject({
      method: 'POST',
      url: '/api/styles',
      payload: { name: 'Bad', props: { ...props(), verticalPosition: 50 } },
    })
    expect(bad.statusCode).toBe(400)
    expect(typeof (bad.json() as { error: unknown }).error).toBe('string')
  })

  it('PUT: built-in 403, user 200, unknown 404', async () => {
    const b = await app.inject({ method: 'PUT', url: '/api/styles/builtin-classic', payload: { name: 'X' } })
    expect(b.statusCode).toBe(403)
    const u = await app.inject({ method: 'PUT', url: `/api/styles/${userId}`, payload: { name: 'Renamed' } })
    expect(u.statusCode).toBe(200)
    expect((u.json() as { name: string }).name).toBe('Renamed')
    const n = await app.inject({ method: 'PUT', url: '/api/styles/nope', payload: { name: 'X' } })
    expect(n.statusCode).toBe(404)
  })

  it('DELETE: built-in 403, unknown 404, user ok', async () => {
    const b = await app.inject({ method: 'DELETE', url: '/api/styles/builtin-3d-shadow' })
    expect(b.statusCode).toBe(403)
    const n = await app.inject({ method: 'DELETE', url: '/api/styles/nope' })
    expect(n.statusCode).toBe(404)
    const u = await app.inject({ method: 'DELETE', url: `/api/styles/${userId}` })
    expect(u.statusCode).toBe(200)
    expect(u.json()).toEqual({ ok: true })
  })

  it('POST duplicate of a built-in gives an editable copy', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/styles/builtin-3d-shadow/duplicate' })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { name: string; isBuiltin: boolean }
    expect(body.name).toBe('3D Shadow (Copy)')
    expect(body.isBuiltin).toBe(false)
    const miss = await app.inject({ method: 'POST', url: '/api/styles/nope/duplicate' })
    expect(miss.statusCode).toBe(404)
  })
})
