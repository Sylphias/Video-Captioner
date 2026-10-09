// electron-builder afterPack hook: copy the staged backend node_modules into <resources>/backend.
//
// electron-builder's extraResources copier unconditionally drops directories named node_modules
// (even with an explicit filter), so the backend's production dependencies - including the
// Electron-ABI better-sqlite3 and @remotion/compositor-win32-x64-msvc - must be placed here.
// They land as real files outside app.asar (Pitfall 3, Open Q2).
const fs = require('node:fs')
const path = require('node:path')

exports.default = async function afterPack(context) {
  const src = path.join(__dirname, '..', 'build', 'backend', 'node_modules')
  const dest = path.join(context.appOutDir, 'resources', 'backend', 'node_modules')
  if (!fs.existsSync(src)) {
    throw new Error(`staged backend node_modules missing: ${src} - run "npm run prebuild" first`)
  }
  fs.cpSync(src, dest, { recursive: true, dereference: true })
  const sqlite = path.join(dest, 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node')
  const compositor = path.join(dest, '@remotion', 'compositor-win32-x64-msvc')
  for (const required of [sqlite, compositor]) {
    if (!fs.existsSync(required)) throw new Error(`packaged backend is missing ${required}`)
  }
  console.log(`  • afterPack: backend node_modules copied -> ${dest}`)
}
