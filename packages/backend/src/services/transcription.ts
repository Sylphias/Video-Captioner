import { spawn, type ChildProcess } from 'node:child_process'
import readline from 'node:readline'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const REPO_ROOT = path.resolve(__dirname, '../../../../')
const VENV_PYTHON = path.join(REPO_ROOT, '.venv/bin/python3')
const SCRIPT = path.join(REPO_ROOT, 'scripts/transcribe.py')

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
  const proc = spawn(VENV_PYTHON, ['-u', SCRIPT, audioPath, outputPath, language], {
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
      reject(new Error(`Failed to spawn transcribe.py: ${err.message}. Ensure venv exists (run: just setup-python)`))
    })
  })

  return { promise, process: proc }
}
