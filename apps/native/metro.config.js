// Metro config so the (non-workspace) native app can resolve the shared TS packages
// at ../../packages/{core,data}. apps/native is intentionally excluded from the root
// npm workspace install (to keep RN deps away from the verified web build), so Metro
// must be told where the shared source + their node_modules live.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('node:path')

const projectRoot = __dirname
const repoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch the shared packages so edits hot-reload.
config.watchFolders = [path.resolve(repoRoot, 'packages')]

// Resolve modules from the app first, then the repo root (for @drawie/* and hoisted deps).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
]
config.resolver.extraNodeModules = {
  '@drawie/core': path.resolve(repoRoot, 'packages/core'),
  '@drawie/data': path.resolve(repoRoot, 'packages/data'),
}

module.exports = config
