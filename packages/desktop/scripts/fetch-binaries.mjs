// Fetch the bundled Windows binaries shipped as extraResources (D-13 ffmpeg/ffprobe, D-08 uv).
//
// Runs as part of the packaging pipeline (the `prebuild` npm script, before electron-builder).
// Output (gitignored, never committed): packages/desktop/build/bin/{ffmpeg,ffprobe,uv}.exe
//
// Supply-chain (T-15-81): exact versions are pinned below AND every archive is verified against a
// pinned SHA-256 before extraction. To refresh: bump the version + sha256 here and in
// build/README.md (see that file for where the upstream checksums come from).
//
// Idempotent: if build/bin already holds the pinned versions, nothing is downloaded.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

export const PINNED = {
  ffmpeg: {
    version: '9.0.2',
    // gyan.dev "essentials" release build (GPL, includes libx264) - linked from ffmpeg.org/download.html
    url: 'https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.zip',
    sha256: '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba',
    // Folder name inside the archive
    root: 'ffmpeg-9.0.2-essentials_build',
  },
  uv: {
    version: '0.12.6',
    // Official astral-sh/uv release asset
    url: 'https://github.com/astral-sh/uv/releases/download/0.12.6/uv-x86_64-pc-windows-msvc.zip',
    sha256: 'df7cb9f243eae1621400d4fcf5b1b3d90f20e264ece91b64deb3b0078abca6ef',
  },
}

const here = path.dirname(fileURLToPath(import.meta.url))
const buildDir = path.resolve(here, '..', 'build')
const binDir = path.join(buildDir, 'bin')
const cacheDir = path.join(buildDir, 'cache')
const manifestPath = path.join(binDir, 'versions.json')
const EXPECTED = ['ffmpeg.exe', 'ffprobe.exe', 'uv.exe']

function isUpToDate() {
  try {
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    return (
      m.ffmpeg === PINNED.ffmpeg.version &&
      m.uv === PINNED.uv.version &&
      EXPECTED.every((f) => fs.existsSync(path.join(binDir, f)))
    )
  } catch {
    return false
  }
}

async function download(url, dest, expectedSha256) {
  // Reuse a previously downloaded archive only if its checksum still matches.
  if (fs.existsSync(dest) && (await sha256File(dest)) === expectedSha256) {
    console.log(`[fetch-binaries] cached ${path.basename(dest)}`)
    return
  }
  console.log(`[fetch-binaries] downloading ${url}`)
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error(`download failed (${res.status}) for ${url}`)
  const tmp = `${dest}.part`
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(tmp))
  const actual = await sha256File(tmp)
  if (actual !== expectedSha256) {
    fs.rmSync(tmp, { force: true })
    throw new Error(`SHA-256 mismatch for ${url}\n  expected ${expectedSha256}\n  actual   ${actual}`)
  }
  fs.renameSync(tmp, dest)
}

async function sha256File(file) {
  const hash = createHash('sha256')
  await pipeline(fs.createReadStream(file), hash)
  return hash.digest('hex')
}

function unzip(zipPath, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true })
  fs.mkdirSync(destDir, { recursive: true })
  // Windows ships bsdtar (reads zip) as System32\tar.exe; Git Bash's GNU tar cannot, so use it explicitly.
  const tar =
    process.platform === 'win32'
      ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
      : 'unzip'
  const args = process.platform === 'win32' ? ['-xf', zipPath, '-C', destDir] : ['-q', zipPath, '-d', destDir]
  const r = spawnSync(tar, args, { stdio: 'inherit' })
  if (r.status !== 0) throw new Error(`failed to extract ${zipPath} (exit ${r.status})`)
}

function copyOut(src, dest) {
  if (!fs.existsSync(src)) throw new Error(`expected file missing in archive: ${src}`)
  fs.copyFileSync(src, dest)
}

async function main() {
  console.log(`[fetch-binaries] pinned: ffmpeg/ffprobe ${PINNED.ffmpeg.version}, uv ${PINNED.uv.version}`)
  if (isUpToDate()) {
    console.log(`[fetch-binaries] up to date -> ${binDir} (skipping download)`)
    return
  }
  fs.mkdirSync(binDir, { recursive: true })
  fs.mkdirSync(cacheDir, { recursive: true })

  // ffmpeg + ffprobe
  const ffZip = path.join(cacheDir, `ffmpeg-${PINNED.ffmpeg.version}-essentials_build.zip`)
  await download(PINNED.ffmpeg.url, ffZip, PINNED.ffmpeg.sha256)
  const ffOut = path.join(cacheDir, 'ffmpeg-extracted')
  unzip(ffZip, ffOut)
  const ffRoot = path.join(ffOut, PINNED.ffmpeg.root)
  copyOut(path.join(ffRoot, 'bin', 'ffmpeg.exe'), path.join(binDir, 'ffmpeg.exe'))
  copyOut(path.join(ffRoot, 'bin', 'ffprobe.exe'), path.join(binDir, 'ffprobe.exe'))
  // The build is GPL: ship its license text alongside the binaries.
  if (fs.existsSync(path.join(ffRoot, 'LICENSE'))) {
    fs.copyFileSync(path.join(ffRoot, 'LICENSE'), path.join(binDir, 'ffmpeg-LICENSE.txt'))
  }

  // uv
  const uvZip = path.join(cacheDir, `uv-${PINNED.uv.version}-x86_64-pc-windows-msvc.zip`)
  await download(PINNED.uv.url, uvZip, PINNED.uv.sha256)
  const uvOut = path.join(cacheDir, 'uv-extracted')
  unzip(uvZip, uvOut)
  copyOut(path.join(uvOut, 'uv.exe'), path.join(binDir, 'uv.exe'))

  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ ffmpeg: PINNED.ffmpeg.version, uv: PINNED.uv.version, fetchedAt: new Date().toISOString() }, null, 2),
  )
  // Extracted trees are large and only needed during this run; keep the verified zips for fast re-runs.
  fs.rmSync(ffOut, { recursive: true, force: true })
  fs.rmSync(uvOut, { recursive: true, force: true })

  console.log(`[fetch-binaries] ffmpeg ${PINNED.ffmpeg.version}, ffprobe ${PINNED.ffmpeg.version}, uv ${PINNED.uv.version} -> ${binDir}`)
}

await main()
