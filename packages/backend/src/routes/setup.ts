import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'

import {
  provisionVenv,
  venvExists,
  SetupCancelledError,
  type ProvisionHandle,
  type ProvisionProgress,
} from '../services/pythonEnv.ts'

type SetupEvent =
  | ({ type: 'progress' } & ProvisionProgress)
  | { type: 'done' }
  | { type: 'error'; message: string }
  | { type: 'cancelled' }

interface ActiveSetup {
  handle: ProvisionHandle
  listeners: Set<(event: SetupEvent) => void>
  last: SetupEvent | null
}

// Single in-flight setup guard (T-15-62): at most one uv provisioning run at any time.
// Additional POST /start calls (e.g. a reloaded window) attach to the same run.
let active: ActiveSetup | null = null

function broadcast(run: ActiveSetup, event: SetupEvent): void {
  run.last = event
  for (const listener of run.listeners) listener(event)
}

function startRun(fastify: FastifyInstance): ActiveSetup {
  const run: ActiveSetup = {
    handle: provisionVenv((p) => broadcast(run, { type: 'progress', ...p })),
    listeners: new Set(),
    last: null,
  }
  run.handle.promise
    .then(() => broadcast(run, { type: 'done' }))
    .catch((err: unknown) => {
      if (err instanceof SetupCancelledError) {
        broadcast(run, { type: 'cancelled' })
      } else {
        const message = err instanceof Error ? err.message : String(err)
        fastify.log.error({ err }, 'Python environment setup failed')
        broadcast(run, { type: 'error', message })
      }
    })
    .finally(() => {
      active = null
    })
  return run
}

async function setupRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/setup/status — is the Python venv ready? (and is a setup already running?)
  fastify.get('/api/setup/status', async () => {
    return { ready: venvExists(), running: active !== null }
  })

  // POST /api/setup/start — provision the venv, streaming progress as Server-Sent Events
  fastify.post('/api/setup/start', async (req, reply) => {
    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    raw.write(': connected\n\n')

    const send = (event: SetupEvent): void => {
      if (raw.writableEnded) return
      raw.write(`data: ${JSON.stringify(event)}\n\n`)
      if (event.type !== 'progress') raw.end()
    }

    // Nothing to do if the environment is already complete and no run is in flight
    if (!active && venvExists()) {
      send({ type: 'done' })
      return
    }

    const run = active ?? startRun(fastify)
    active = run
    if (run.last) send(run.last)
    run.listeners.add(send)

    // Client gone (window closed / fetch aborted): drop the listener, and if nobody is
    // watching any more, kill uv so no orphan keeps downloading (T-15-62).
    raw.on('close', () => {
      run.listeners.delete(send)
      if (run.listeners.size === 0 && active === run && !raw.writableFinished) {
        run.handle.cancel()
      }
    })
  })

  // POST /api/setup/cancel — explicit cancel; discards the partial environment
  fastify.post('/api/setup/cancel', async () => {
    if (!active) return { cancelled: false }
    active.handle.cancel()
    return { cancelled: true }
  })
}

export default fp(setupRoutes)
