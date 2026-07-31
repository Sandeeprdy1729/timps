/* eslint-disable */
// Loader for the @timps/memory-core-rs native addon.
// Matches napi.targets in package.json (8 triples: darwin x64/arm64,
// linux-gnu x64/arm64, linux-musl x64/arm64, win32-msvc x64/arm64).
//
// The addon is OPTIONAL: when no binary exists for the current
// platform/arch, this module exports null instead of throwing so that
// consumers (e.g. memory-core's getNative()) can transparently fall back
// to the TypeScript implementation. Set TIMPS_NATIVE_VERBOSE=1 to see
// why the native addon was not loaded.
'use strict'

const { platform, arch } = process

let binding = null
const loadError = []

function isMusl() {
  if (!process.report || typeof process.report.getReport !== 'function') {
    try {
      const lddPath = require('child_process').execSync('which ldd').toString().trim()
      return require('fs').readFileSync(lddPath, 'utf8').includes('musl')
    } catch {
      return true
    }
  }
  const { glibcVersionRuntime } = process.report.getReport().header
  return !glibcVersionRuntime
}

function tryLoad(path) {
  try {
    return require(path)
  } catch (e) {
    loadError.push(e)
    return null
  }
}

switch (platform) {
  case 'darwin':
    if (arch === 'arm64') binding = tryLoad('./memory-core-rs.darwin-arm64.node')
    else if (arch === 'x64') binding = tryLoad('./memory-core-rs.darwin-x64.node')
    else loadError.push(new Error(`Unsupported macOS arch: ${arch}`))
    break
  case 'linux':
    if (isMusl()) {
      if (arch === 'x64') binding = tryLoad('./memory-core-rs.linux-x64-musl.node')
      else if (arch === 'arm64') binding = tryLoad('./memory-core-rs.linux-arm64-musl.node')
      else loadError.push(new Error(`Unsupported Linux musl arch: ${arch}`))
    } else {
      if (arch === 'x64') binding = tryLoad('./memory-core-rs.linux-x64-gnu.node')
      else if (arch === 'arm64') binding = tryLoad('./memory-core-rs.linux-arm64-gnu.node')
      else loadError.push(new Error(`Unsupported Linux arch: ${arch}`))
    }
    break
  case 'win32':
    if (arch === 'x64') binding = tryLoad('./memory-core-rs.win32-x64-msvc.node')
    else if (arch === 'arm64') binding = tryLoad('./memory-core-rs.win32-arm64-msvc.node')
    else loadError.push(new Error(`Unsupported Windows arch: ${arch}`))
    break
  default:
    loadError.push(new Error(`Unsupported platform: ${platform}`))
}

if (!binding && loadError.length) {
  const msgs = [...new Set(loadError.map((e) => e.message))].join('\n  ')
  if (process.env.TIMPS_NATIVE_VERBOSE) {
    console.warn(
      `[memory-core-rs] Native addon not loaded; falling back to TypeScript implementation.\n  ${msgs}\n\nBuild with:\n  cd packages/memory-core-rs && npm run build\n`
    )
  }
}

module.exports = binding
