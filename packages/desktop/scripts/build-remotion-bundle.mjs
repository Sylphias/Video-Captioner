// Build-time Remotion bundle (RESEARCH Pattern 2, Pitfall 3).
//
// Runs ONCE at packaging time (the `prebuild` npm script, before electron-builder), never at app
// launch. The packaged backend (IS_PACKAGED=1) skips webpack entirely and points Remotion's
// renderer at this prebuilt directory via REMOTION_BUNDLE_DIR (see backend services/render.ts,
// initBundle()). electron-builder ships the output as an extraResource at <resources>/remotion-bundle.
//
// Requires the workspace libs to be built first (shared-types + remotion-composition dist/), which
// the `prebuild` script handles.
import { bundle } from '@remotion/bundler'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(here, '..')
// Same entry point render.ts uses for its dev-mode bundle().
const entryPoint = path.resolve(desktopRoot, '../remotion-composition/src/remotion-entry.ts')
const outDir = path.join(desktopRoot, 'build', 'remotion-bundle')

if (!fs.existsSync(entryPoint)) {
  console.error(`[remotion-bundle] entry point not found: ${entryPoint}`)
  process.exit(1)
}

const remotionVersion = JSON.parse(
  fs.readFileSync(path.resolve(desktopRoot, '../../node_modules/@remotion/bundler/package.json'), 'utf8'),
).version

// Always rebuild: the composition source may have changed, and a stale bundle would silently ship.
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(path.dirname(outDir), { recursive: true })

console.log(`[remotion-bundle] @remotion/bundler ${remotionVersion}`)
console.log(`[remotion-bundle] entry:  ${entryPoint}`)
console.log(`[remotion-bundle] outDir: ${outDir}`)

const started = Date.now()
const location = await bundle({ entryPoint, outDir })

const indexHtml = path.join(location, 'index.html')
if (!fs.existsSync(indexHtml)) {
  console.error(`[remotion-bundle] bundle finished but ${indexHtml} is missing`)
  process.exit(1)
}
console.log(`[remotion-bundle] done in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${location}`)
