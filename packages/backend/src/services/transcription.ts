import { spawn, type ChildProcess } from 'node:child_process'
import readline from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Resolve paths: scripts/ is at repo root, .venv/ is at repo root
const REPO_ROOT = path.resolve(__dirname, '../../../../')

// NeMo/Parakeet runs in WSL (NeMo has no native Windows support — triton dependency).
// The Node.js backend stays on Windows; Python ML scripts run in WSL.
// WSL venv is at .venv-wsl/ in the repo root (Linux path: ~/path/to/repo/.venv-wsl).
// We spawn `wsl` with the WSL python executable and pass Linux-converted paths.
const WSL_PYTHON = '/root/.venv-wsl/bin/python3'

/**
 * Convert a Windows absolute path to a WSL path.
 * e.g. C:\Users\foo\bar -> /mnt/c/Users/foo/bar
 */
function toWslPath(winPath: string): string {
  // Replace backslashes, handle drive letter: C:\... -> /mnt/c/...
  const normalized = winPath.replace(/\\/g, '/')
  return normalized.replace(/^([A-Za-z]):\//, (_, drive) => `/mnt/${drive.toLowerCase()}/`)
}

const SCRIPT_WIN = path.join(REPO_ROOT, 'scripts/transcribe.py')
const SCRIPT = toWslPath(SCRIPT_WIN)

/**
 * Run faster-whisper transcription on a video/audio file.
 * Spawns a Python subprocess that emits JSON-line progress to stdout.
 *
 * @param audioPath - Path to the normalized .mp4 or audio file
 * @param outputPath - Path where transcript.json will be written
 * @param onProgress - Callback receiving progress percentage 0-100
 * @returns Promise resolving when transcription completes, with the subprocess handle for cleanup
 */
export function runTranscription(
  audioPath: string,
  outputPath: string,
  onProgress?: (percent: number) => void,
  language: string = 'en',
): { promise: Promise<void>; process: ChildProcess } {
  const wslAudioPath = toWslPath(audioPath)
  const wslOutputPath = toWslPath(outputPath)
  const proc = spawn('wsl', [WSL_PYTHON, '-u', SCRIPT, wslAudioPath, wslOutputPath, language], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

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
        // Ignore non-JSON lines (e.g., model download output)
      }
    })

    let stderr = ''
    proc.stderr!.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        if (onProgress) onProgress(100)
        resolve()
      } else {
        reject(new Error(`transcribe.py exited ${code}: ${stderr.slice(-500)}`))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn transcribe.py via WSL: ${err.message}. Ensure WSL venv exists (run: just setup-python-wsl)`))
    })
  })

  return { promise, process: proc }
}
