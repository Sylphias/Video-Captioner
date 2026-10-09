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
// Packaged app: Electron injects SCRIPTS_DIR (the shipped scripts/ resource); dev uses <repo>/scripts.
const SCRIPT = path.join(process.env.SCRIPTS_DIR ?? path.join(REPO_ROOT, 'scripts'), 'transcribe.py')

/**
 * Run WhisperX transcription + diarization on a video/audio file.
 * Spawns a Python subprocess that emits JSON-line progress to stdout.
 *
 * @param audioPath - Path to the normalized .mp4 or audio file
 * @param outputPath - Path where transcript.json will be written
 * @param onProgress - Callback receiving progress percentage 0-100 and the script's phase label
 * @param language - Language code (default: 'en')
 * @param hfToken - Optional HuggingFace token for speaker diarization
 * @param numSpeakers - Optional speaker count constraint
 * @returns Promise resolving when transcription completes, with the subprocess handle for cleanup
 */
export function runTranscription(
  audioPath: string,
  outputPath: string,
  onProgress?: (percent: number, status?: string) => void,
  language: string = 'en',
  hfToken?: string,
  numSpeakers?: number,
): { promise: Promise<void>; process: ChildProcess } {
  const args = ['-u', SCRIPT, audioPath, outputPath, language]
  args.push(hfToken ?? '')
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
        const msg = JSON.parse(line) as { type: string; percent?: number; status?: string }
        if (msg.type === 'progress' && msg.percent !== undefined && onProgress) {
          // status ("loading_model", "transcribing", ...) is the script's phase label
          onProgress(msg.percent, msg.status)
        }
        // 'done' type is informational — process exit code is the real signal
      } catch {
        // Ignore non-JSON lines (e.g., model download output)
      }
    })

    let stderr = ''
    proc.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code, signal) => {
      if (proc.pid !== undefined) unregisterChild(proc.pid)
      if (code === 0) {
        if (onProgress) onProgress(100)
        resolve()
      } else if (signal) {
        reject(new Error(`transcribe.py killed by ${signal} (likely out of memory loading model on CPU). stderr: ${stderr.slice(-500)}`))
      } else {
        reject(new Error(`transcribe.py exited ${code}: ${stderr.slice(-500)}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn transcribe.py: ${err.message}. Ensure venv exists (run: just setup-python-windows, or complete first-run setup)`))
    })
  })

  return { promise, process: proc }
}
