import { spawn, type ChildProcess } from 'node:child_process'
import readline from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerChild, unregisterChild } from './childRegistry.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPO_ROOT = path.resolve(__dirname, '../../../../')
// D-07: Electron injects an absolute venv path via VENV_PYTHON. Default is the Windows venv
// layout (target platform); non-Windows dev (WSL/Linux) falls back to the POSIX venv layout.
const VENV_PYTHON =
  process.env.VENV_PYTHON ??
  path.join(
    REPO_ROOT,
    process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python3',
  )
const SCRIPT = path.join(REPO_ROOT, 'scripts/diarize.py')

/**
 * Run pyannote speaker diarization on a transcribed video file.
 * Spawns a Python subprocess that emits JSON-line progress to stdout.
 * Enriches the transcript.json in place with per-word speaker labels.
 *
 * @param audioPath - Path to the normalized .mp4 file
 * @param transcriptPath - Path to transcript.json (read and overwritten in place)
 * @param hfToken - HuggingFace access token for the gated pyannote model
 * @param onProgress - Optional callback receiving progress percentage 0-100
 * @returns Promise resolving when diarization completes, with the subprocess handle for cleanup
 */
export function runDiarization(
  audioPath: string,
  transcriptPath: string,
  hfToken: string,
  onProgress?: (percent: number) => void,
  numSpeakers?: number,
): { promise: Promise<void>; process: ChildProcess } {
  const args = ['-u', SCRIPT, audioPath, transcriptPath, hfToken]
  if (numSpeakers !== undefined) args.push(String(numSpeakers))
  const proc = spawn(VENV_PYTHON, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  // Track for tree-kill on shutdown (D-03); unregistered on close below
  if (proc.pid !== undefined) registerChild(proc.pid)

  const promise = new Promise<void>((resolve, reject) => {
    const rl = readline.createInterface({ input: proc.stdout!, terminal: false })

    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line) as { type: string; percent?: number }
        if (msg.type === 'progress' && msg.percent !== undefined && onProgress) {
          onProgress(msg.percent)
        }
        // 'done' type is informational — process exit code is the real signal
      } catch {
        // Ignore non-JSON lines
      }
    })

    let stderr = ''
    proc.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (proc.pid !== undefined) unregisterChild(proc.pid)
      if (code === 0) {
        if (onProgress) onProgress(100)
        resolve()
      } else {
        reject(new Error(`diarize.py exited ${code}: ${stderr.slice(-500)}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn diarize.py: ${err.message}. Ensure venv exists (run: just setup-python-windows, or complete first-run setup)`))
    })
  })

  return { promise, process: proc }
}
