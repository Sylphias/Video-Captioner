// Backend child-process lifecycle: spawn (no build step), health gate, graceful-then-tree-kill shutdown.
// App traffic stays HTTP (D-02); this module never uses Electron IPC to talk to the backend.
import { spawn, type ChildProcess } from 'node:child_process'
import http from 'node:http'
import log from 'electron-log/main'
import treeKill from 'tree-kill'

export interface StartBackendOptions {
  /** Absolute path to the backend entry (packages/backend/src/index.ts or its packaged copy). */
  backendEntry: string
  /** Env from config.buildBackendEnv — must include ELECTRON_RUN_AS_NODE=1. */
  env: NodeJS.ProcessEnv
  /**
   * Dev-only escape hatch: run the backend with a system Node instead of Electron's. Native modules
   * (better-sqlite3) are built for the system Node ABI in dev, not Electron's; packaged builds are
   * rebuilt for Electron (Plan 08) and leave this unset.
   */
  nodeBinary?: string
  /** Optional lifecycle notifications (spawned / exited) for the caller. */
  onStatus?: (message: string) => void
}

/**
 * Spawn the existing backend TypeScript directly with Electron's bundled Node
 * (process.execPath + ELECTRON_RUN_AS_NODE=1, Pattern 1). Node >= 22.18 strips erasable TS types
 * without a flag, so no backend build step is needed (D-02).
 */
export function startBackend({ backendEntry, env, nodeBinary, onStatus }: StartBackendOptions): ChildProcess {
  // A system Node (dev override) may predate unflagged type-stripping (22.18+), so pass the flag explicitly.
  const command = nodeBinary ?? process.execPath
  const args = nodeBinary ? ['--experimental-strip-types', backendEntry] : [backendEntry]
  const proc = spawn(command, args, {
    env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  // Forward output into electron-log so startup failures are diagnosable without a devtools console.
  proc.stdout?.on('data', (chunk: Buffer) => log.info(`[backend] ${chunk.toString().trimEnd()}`))
  proc.stderr?.on('data', (chunk: Buffer) => log.error(`[backend] ${chunk.toString().trimEnd()}`))
  proc.on('error', (err) => {
    log.error('[backend] failed to spawn', err)
    onStatus?.(`Backend failed to spawn: ${err.message}`)
  })
  proc.on('exit', (code, signal) => {
    log.info(`[backend] exited code=${code} signal=${signal}`)
    onStatus?.(`Backend exited (code=${code}, signal=${signal})`)
  })
  log.info(`[backend] spawned pid=${proc.pid} entry=${backendEntry}`)
  onStatus?.('Starting backend…')
  return proc
}

function probeHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1500 }, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(false))
  })
}

/**
 * Poll /api/health every ~300ms until it returns 200. The backend only listens after bundling the
 * Remotion composition (several seconds), so the first probes are expected to be refused.
 * `shouldAbort` lets the caller fail fast (e.g. the child already exited) instead of waiting out the timeout.
 */
export async function waitForBackendHealth(
  port: number,
  onProgress: (message: string) => void,
  timeoutMs = 30_000,
  shouldAbort?: () => string | null,
): Promise<void> {
  const started = Date.now()
  const intervalMs = 300
  const rendererPhaseAfterMs = 1500
  let phase: 'backend' | 'renderer' = 'backend'
  onProgress('Starting backend…')

  while (Date.now() - started < timeoutMs) {
    const abortReason = shouldAbort?.()
    if (abortReason) throw new Error(`Backend stopped before becoming healthy: ${abortReason}`)

    if (await probeHealth(port)) return

    if (phase === 'backend' && Date.now() - started >= rendererPhaseAfterMs) {
      phase = 'renderer'
      onProgress('Preparing renderer…')
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Backend did not become healthy on 127.0.0.1:${port} within ${Math.round(timeoutMs / 1000)}s`)
}

/**
 * Graceful-then-tree-kill shutdown (Pattern 3). On POSIX, proc.kill() lets the backend's own SIGTERM
 * handler tree-kill its tracked children; if it hasn't exited after timeoutMs, tree-kill the whole
 * process tree. On Windows, Node's proc.kill() is an unconditional TerminateProcess (signal handlers
 * never run, so the backend could not reap its python/ffmpeg children), so go straight to
 * tree-kill (taskkill /T /F) which takes down the full descendant tree.
 */
export function shutdownBackend(proc: ChildProcess, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null || proc.signalCode !== null || proc.pid === undefined) {
      resolve()
      return
    }
    const pid = proc.pid
    const timer = setTimeout(() => {
      log.warn(`[backend] did not exit within ${timeoutMs}ms; tree-killing pid=${pid}`)
      treeKill(pid, 'SIGKILL', (err) => {
        if (err) log.error('[backend] tree-kill failed', err)
      })
    }, timeoutMs)
    proc.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    if (process.platform === 'win32') {
      clearTimeout(timer)
      treeKill(pid, 'SIGKILL', (err) => {
        if (err) log.error('[backend] tree-kill failed', err)
      })
    } else {
      proc.kill()
    }
  })
}
