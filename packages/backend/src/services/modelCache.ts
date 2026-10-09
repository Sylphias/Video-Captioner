import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * First-transcription model download visibility (D-09, UI-SPEC section 4).
 *
 * transcribe.py calls whisperx.load_model("large-v3"), which silently downloads ~3 GB from
 * HuggingFace on first use (its tqdm output goes to stderr, not the JSON-line stdout protocol).
 * We cannot get a real percentage from the script without changing the protocol, so we infer
 * one from how much of the model's HF cache folder exists on disk — same approach as the
 * first-run environment setup, which measures its uv cache.
 */

const WHISPER_MODEL_DIR = 'models--Systran--faster-whisper-large-v3'
/** Approximate on-disk size of the faster-whisper large-v3 snapshot (model.bin ~3.09 GB + small files). */
export const WHISPER_LARGE_V3_BYTES = 3_100_000_000

/** HuggingFace hub cache dir, honoring the same env vars huggingface_hub does. */
export function hfHubCacheDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.HF_HUB_CACHE) return env.HF_HUB_CACHE
  if (env.HUGGINGFACE_HUB_CACHE) return env.HUGGINGFACE_HUB_CACHE
  if (env.HF_HOME) return path.join(env.HF_HOME, 'hub')
  if (env.XDG_CACHE_HOME) return path.join(env.XDG_CACHE_HOME, 'huggingface', 'hub')
  return path.join(os.homedir(), '.cache', 'huggingface', 'hub')
}

function modelDir(hubDir: string): string {
  return path.join(hubDir, WHISPER_MODEL_DIR)
}

/** True once a complete snapshot (model.bin present) exists, i.e. no download will be needed. */
export function whisperModelCached(hubDir: string = hfHubCacheDir()): boolean {
  try {
    const snapshots = path.join(modelDir(hubDir), 'snapshots')
    for (const rev of fs.readdirSync(snapshots)) {
      if (fs.existsSync(path.join(snapshots, rev, 'model.bin'))) return true
    }
  } catch {
    // no cache dir yet
  }
  return false
}

function dirBytes(dir: string): number {
  let total = 0
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    try {
      if (entry.isDirectory()) total += dirBytes(full)
      else if (entry.isFile()) total += fs.statSync(full).size
    } catch {
      // file vanished mid-download (incomplete -> final rename); next poll recovers
    }
  }
  return total
}

/** Download progress 0-99 from bytes on disk (never 100: completion is signalled by the script). */
export function downloadPercent(bytes: number, expected: number = WHISPER_LARGE_V3_BYTES): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0
  return Math.min(99, Math.floor((bytes / expected) * 100))
}

/**
 * Poll the model cache folder and report percent. Only the blobs/ folder is measured (the
 * snapshots/ folder holds links or copies of the same data and would double count). Returns a
 * stop function.
 */
export function watchModelDownload(
  onPercent: (percent: number) => void,
  hubDir: string = hfHubCacheDir(),
  intervalMs = 1000,
): () => void {
  const blobs = path.join(modelDir(hubDir), 'blobs')
  let last = -1
  const timer = setInterval(() => {
    // Monotonic: with HF_HUB_DISABLE_SYMLINKS the finished blob is moved out of blobs/ into
    // snapshots/, which would otherwise make the bar fall back to 0 right at the end.
    const pct = Math.max(last, downloadPercent(dirBytes(blobs)))
    if (pct !== last) {
      last = pct
      onPercent(pct)
    }
  }, intervalMs)
  timer.unref()
  return () => clearInterval(timer)
}
