// Stage the backend for packaging (RESEARCH Open Q2, Pitfall 3, "Don't Hand-Roll" native rebuild).
//
// The packaged app runs the backend as a plain Node child (ELECTRON_RUN_AS_NODE=1) straight from
// real files under <resources>/backend - NOT from app.asar. In this npm workspace the backend's
// dependencies are hoisted into the repo-root node_modules (alongside Vite, Electron, vitest, ...),
// so shipping "packages/backend + node_modules" verbatim is impossible. This script builds a
// self-contained tree at packages/desktop/build/backend:
//
//   build/backend/package.json   production-only manifest (workspace @eigen/* deps dropped: the
//                                backend only `import type`s them, which Node type-stripping erases)
//   build/backend/src/           backend source, run as-is by Node's type stripping
//   build/backend/node_modules/  exact installed versions of the backend's production dependency
//                                closure (read from the lockfile-installed tree, no network)
//
// Native modules (better-sqlite3) are then rebuilt against Electron's ABI with @electron/rebuild,
// IN THE STAGED COPY ONLY, so the repo's own node_modules keeps its system-Node build for dev/tests.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const desktopRoot = path.resolve(here, '..')
const repoRoot = path.resolve(desktopRoot, '..', '..')
const backendSrcRoot = path.join(repoRoot, 'packages', 'backend')
const rootNodeModules = path.join(repoRoot, 'node_modules')
const stageDir = path.join(desktopRoot, 'build', 'backend')

const NATIVE_MODULES = ['better-sqlite3']

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

const electronVersion = readJson(path.join(rootNodeModules, 'electron', 'package.json')).version
const backendPkg = readJson(path.join(backendSrcRoot, 'package.json'))

/** Node-style resolution of a dependency from `fromDir`, bounded by the repo root. */
function resolveDep(name, fromDir) {
  let dir = fromDir
  for (;;) {
    const candidate = path.join(dir, 'node_modules', name)
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate
    if (dir === repoRoot) return null
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

const inRootNodeModules = (p) => {
  const rel = path.relative(rootNodeModules, p)
  return !rel.startsWith('..') && !path.isAbsolute(rel)
}

// --- 1. Walk the production dependency closure -------------------------------------------------
const copied = new Map() // realpath -> dest
function collect(pkgDir) {
  const pkg = readJson(path.join(pkgDir, 'package.json'))
  const wanted = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
    // Non-optional peers are auto-installed by npm >= 7 and needed at runtime (e.g. react for remotion).
    ...Object.keys(pkg.peerDependencies ?? {}).filter((n) => !pkg.peerDependenciesMeta?.[n]?.optional),
  ]
  for (const name of wanted) {
    if (name.startsWith('@eigen/')) continue // type-only at runtime; see header
    const found = resolveDep(name, pkgDir)
    if (!found) continue // optional / platform-specific dependency not installed on this platform
    const real = fs.realpathSync(found)
    if (!inRootNodeModules(real)) continue // workspace symlink
    if (copied.has(real)) continue
    copied.set(real, path.join(stageDir, 'node_modules', path.relative(rootNodeModules, real)))
    collect(real)
  }
}
collect(backendSrcRoot)

// --- 2. Materialize the stage -------------------------------------------------------------------
console.log(`[stage-backend] staging -> ${stageDir}`)
fs.rmSync(stageDir, { recursive: true, force: true })
fs.mkdirSync(stageDir, { recursive: true })

fs.cpSync(path.join(backendSrcRoot, 'src'), path.join(stageDir, 'src'), { recursive: true })

const stagedPkg = {
  name: backendPkg.name,
  version: backendPkg.version,
  private: true,
  type: backendPkg.type,
  dependencies: Object.fromEntries(Object.entries(backendPkg.dependencies).filter(([n]) => !n.startsWith('@eigen/'))),
}
fs.writeFileSync(path.join(stageDir, 'package.json'), JSON.stringify(stagedPkg, null, 2) + '\n')

for (const [src, dest] of copied) {
  fs.cpSync(src, dest, {
    recursive: true,
    dereference: true,
    // A package's nested node_modules are visited (and copied) as packages of their own.
    filter: (s) => path.relative(src, s).split(path.sep)[0] !== 'node_modules',
  })
}
console.log(`[stage-backend] copied ${copied.size} production packages`)

for (const mod of NATIVE_MODULES) {
  if (!fs.existsSync(path.join(stageDir, 'node_modules', mod))) {
    console.error(`[stage-backend] expected native module not in closure: ${mod}`)
    process.exit(1)
  }
}

// --- 3. Rebuild native modules against Electron's ABI --------------------------------------------
const { rebuild } = await import('@electron/rebuild')
console.log(`[stage-backend] rebuilding ${NATIVE_MODULES.join(', ')} for Electron ${electronVersion} (x64)`)
await rebuild({
  buildPath: stageDir,
  electronVersion,
  arch: 'x64',
  onlyModules: NATIVE_MODULES,
  force: true,
})

const sqliteNode = path.join(stageDir, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
if (!fs.existsSync(sqliteNode)) {
  console.error(`[stage-backend] better_sqlite3.node missing after rebuild: ${sqliteNode}`)
  process.exit(1)
}
// Keep only the loadable binary: drop node-gyp intermediates (~57 MB) and the vendored sqlite/C++ sources.
{
  const modDir = path.join(stageDir, 'node_modules', 'better-sqlite3')
  const keep = path.join(stageDir, 'better_sqlite3.node.keep')
  fs.renameSync(sqliteNode, keep)
  for (const rel of ['build', 'deps', 'src']) fs.rmSync(path.join(modDir, rel), { recursive: true, force: true })
  fs.mkdirSync(path.dirname(sqliteNode), { recursive: true })
  fs.renameSync(keep, sqliteNode)
}
const compositor = path.join(stageDir, 'node_modules', '@remotion', 'compositor-win32-x64-msvc')
if (!fs.existsSync(compositor)) {
  console.error(`[stage-backend] @remotion/compositor-win32-x64-msvc missing from the closure (needs a win32-x64 install)`)
  process.exit(1)
}
console.log(`[stage-backend] done: ${sqliteNode}`)
