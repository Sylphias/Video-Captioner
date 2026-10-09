import { spawn, type ChildProcess } from 'node:child_process'
import readline from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { readdir, rm, stat, unlink } from 'node:fs/promises'
import treeKill from 'tree-kill'
import { registerChild, unregisterChild } from './childRegistry.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPO_ROOT = path.resolve(__dirname, '../../../../')

// Same resolution as transcription.ts / diarization.ts (D-07): Electron injects an absolute
// venv python via VENV_PYTHON; dev falls back to the repo-local .venv for the host platform.
export const VENV_PYTHON =
  process.env.VENV_PYTHON ??
  path.join(
    REPO_ROOT,
    process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python3',
  )

// venv root = two levels above the interpreter (<root>/Scripts/python.exe or <root>/bin/python3)
const VENV_ROOT = path.resolve(path.dirname(path.dirname(VENV_PYTHON)))

// Sibling of the venv: exists from the moment provisioning starts until it fully succeeds, so a
// half-built venv (python.exe present but no packages) is never reported as ready.
const INCOMPLETE_MARKER = `${VENV_ROOT}.setup-incomplete`

// Private uv cache next to the venv (same volume => hardlinks, no duplicate ~5GB copy). It also
// makes download progress measurable (bytes written since start) and is deleted on success.
const UV_CACHE_DIR = `${VENV_ROOT}.uv-cache`

// Interpreter version handed to `uv venv`. whisperx/pyannote/torch 2.8 all support 3.12; pinning
// stops uv from picking a too-new system interpreter, and uv downloads a managed 3.12 if absent.
const PYTHON_VERSION = '3.12'

// Rough size of the finished environment, used only to turn cache growth into a percentage.
const EXPECTED_BYTES = 6 * 1024 ** 3

// Never report 100% from the byte meter; completion is signalled by the terminal event.
const MAX_METER_PERCENT = 97

const METER_INTERVAL_MS = 1500

export type ProvisionPhase = 'preparing' | 'downloading' | 'installing'

export interface ProvisionProgress {
  phase: ProvisionPhase
  /** 0-100 while downloading; undefined when indeterminate */
  percent?: number
  message: string
}

export class SetupCancelledError extends Error {
  constructor() {
    super('Setup cancelled')
    this.name = 'SetupCancelledError'
  }
}

/** True when the venv interpreter exists and a previous provisioning run did not leave a marker. */
export function venvExists(): boolean {
  return existsSync(VENV_PYTHON) && !existsSync(INCOMPLETE_MARKER)
}

function uvBinary(): string {
  return process.env.UV_PATH ?? 'uv'
}

interface Step {
  id: 'venv' | 'torch' | 'deps'
  args: string[]
}

/**
 * The fixed command sequence — mirrors the justfile `setup-python-windows` recipe (verified in
 * Plan 04). No user-supplied package names ever enter this list (T-15-61).
 */
export function buildSteps(venvRoot: string, venvPython: string, platform: NodeJS.Platform = process.platform): Step[] {
  const torchPkgs = ['torch>=2.8.0,<2.9', 'torchaudio>=2.8.0,<2.9']
  // macOS wheels come from the default index (MPS); Windows/Linux use the cu128 CUDA index
  const torchArgs = ['pip', 'install', '--python', venvPython, ...torchPkgs]
  if (platform !== 'darwin') {
    torchArgs.push('--index-url', 'https://download.pytorch.org/whl/cu128')
  }
  const depsArgs = ['pip', 'install', '--python', venvPython, 'whisperx', 'pyannote-audio>=4.0.4']
  // Windows torch wheels bundle their own CUDA DLLs but ctranslate2 needs cuDNN/cuBLAS explicitly
  if (platform === 'win32') depsArgs.push('nvidia-cudnn-cu12', 'nvidia-cublas-cu12')
  return [
    { id: 'venv', args: ['venv', venvRoot, '--python', PYTHON_VERSION] },
    { id: 'torch', args: torchArgs },
    { id: 'deps', args: depsArgs },
  ]
}

async function dirSize(dir: string): Promise<number> {
  let total = 0
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    try {
      if (entry.isDirectory()) total += await dirSize(full)
      else if (entry.isFile()) total += (await stat(full)).size
    } catch {
      // file vanished mid-scan (uv temp files) — ignore
    }
  }
  return total
}

async function removeQuietly(target: string): Promise<void> {
  // maxRetries covers brief Windows file locks right after a process tree is killed
  await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => undefined)
}

export interface ProvisionHandle {
  promise: Promise<void>
  /** The uv child currently running (null between steps / after completion). */
  readonly process: ChildProcess | null
  /** Kill the running uv tree and discard the partial environment. */
  cancel: () => void
}

/**
 * Provision the Python venv with uv. uv has no machine-readable progress (RESEARCH A2) and prints
 * only Resolved/Prepared/Installed summary lines when not attached to a TTY, so:
 *  - percent is derived from bytes written to the private uv cache (best-effort, monotonic);
 *  - the phase flips to 'installing' (indeterminate) once the final step reports "Prepared".
 */
export function provisionVenv(onProgress: (p: ProvisionProgress) => void): ProvisionHandle {
  let current: ChildProcess | null = null
  let cancelled = false
  let lastPercent = 0

  const killCurrent = (): void => {
    if (current?.pid !== undefined) {
      try {
        treeKill(current.pid, 'SIGKILL', () => undefined)
      } catch {
        // already gone
      }
    }
  }

  const runStep = (step: Step, phase: ProvisionPhase): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      if (cancelled) return reject(new SetupCancelledError())
      const proc = spawn(uvBinary(), step.args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env: {
          ...process.env,
          UV_CACHE_DIR,
          UV_NO_PROGRESS: '1',
          NO_COLOR: '1',
          // torch wheels are ~2.5GB; the 30s default read timeout is too tight on slow links
          UV_HTTP_TIMEOUT: '120',
        },
      })
      current = proc
      if (proc.pid !== undefined) registerChild(proc.pid)

      let stderrTail = ''
      let currentPhase = phase
      const onLine = (line: string): void => {
        const text = line.trim()
        if (!text) return
        // Final step finished downloading/unpacking -> remaining work is linking/installing
        if (step.id === 'deps' && /^Prepared \d+ packages?/.test(text) && currentPhase !== 'installing') {
          currentPhase = 'installing'
          onProgress({ phase: 'installing', message: 'Installing dependencies…' })
        }
      }
      readline.createInterface({ input: proc.stdout!, terminal: false }).on('line', onLine)
      readline.createInterface({ input: proc.stderr!, terminal: false }).on('line', (line) => {
        stderrTail = (stderrTail + line + '\n').slice(-500)
        onLine(line)
      })

      // Byte meter: only meaningful while packages are being downloaded
      let meterBusy = false
      const meter =
        step.id === 'venv'
          ? null
          : setInterval(() => {
              if (meterBusy || currentPhase === 'installing') return
              meterBusy = true
              void dirSize(UV_CACHE_DIR)
                .then((bytes) => {
                  const pct = Math.min(MAX_METER_PERCENT, Math.floor((bytes / EXPECTED_BYTES) * 100))
                  if (pct > lastPercent && currentPhase !== 'installing' && !cancelled) {
                    lastPercent = pct
                    onProgress({ phase: 'downloading', percent: pct, message: `Downloading environment… ${pct}%` })
                  }
                })
                .finally(() => {
                  meterBusy = false
                })
            }, METER_INTERVAL_MS)

      proc.on('close', (code, signal) => {
        if (meter) clearInterval(meter)
        if (proc.pid !== undefined) unregisterChild(proc.pid)
        current = null
        if (cancelled) reject(new SetupCancelledError())
        else if (code === 0) resolve()
        else if (signal) reject(new Error(`uv ${step.id} killed by ${signal}. ${stderrTail.slice(-500)}`.trim()))
        else reject(new Error(`uv ${step.id} exited ${code}: ${stderrTail.slice(-500)}`))
      })

      proc.on('error', (err) => {
        if (meter) clearInterval(meter)
        if (proc.pid !== undefined) unregisterChild(proc.pid)
        current = null
        reject(new Error(`Failed to spawn uv (${uvBinary()}): ${err.message}`))
      })
    })

  const promise = (async () => {
    // Start from a clean slate: a leftover half-built venv would make `uv venv` ambiguous
    await removeQuietly(VENV_ROOT)
    mkdirSync(path.dirname(VENV_ROOT), { recursive: true })
    writeFileSync(INCOMPLETE_MARKER, new Date().toISOString())

    try {
      const steps = buildSteps(VENV_ROOT, VENV_PYTHON)
      onProgress({ phase: 'preparing', message: 'Preparing environment…' })
      await runStep(steps[0], 'preparing')
      if (cancelled) throw new SetupCancelledError()
      onProgress({ phase: 'downloading', percent: lastPercent, message: `Downloading environment… ${lastPercent}%` })
      await runStep(steps[1], 'downloading')
      if (cancelled) throw new SetupCancelledError()
      await runStep(steps[2], 'downloading')
      if (cancelled) throw new SetupCancelledError()
      if (!existsSync(VENV_PYTHON)) {
        throw new Error(`uv finished but ${VENV_PYTHON} does not exist`)
      }
    } catch (err) {
      if (cancelled || err instanceof SetupCancelledError) {
        // Cancel discards the partial download entirely (UI-SPEC: "discard the partial download")
        await removeQuietly(VENV_ROOT)
        await removeQuietly(UV_CACHE_DIR)
        await unlink(INCOMPLETE_MARKER).catch(() => undefined)
        throw new SetupCancelledError()
      }
      // Failure: drop the broken venv but keep the uv cache so Retry resumes quickly.
      // The incomplete marker stays, so venvExists() remains false.
      await removeQuietly(VENV_ROOT)
      throw err
    }

    // Success: environment is complete — clear marker and reclaim the private cache disk space
    await unlink(INCOMPLETE_MARKER).catch(() => undefined)
    await removeQuietly(UV_CACHE_DIR)
  })()

  return {
    promise,
    get process() {
      return current
    },
    cancel: () => {
      cancelled = true
      killCurrent()
    },
  }
}
