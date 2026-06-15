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

// @drawie/data's moderationService dynamically imports heavy WEB-ONLY ML libs (TensorFlow.js /
// nsfwjs / tesseract.js) for client-side NSFW+OCR moderation. Native pulls the service in via the
// barrel export but never runs that path (it moderates via the server-side `moderate` edge
// function), so resolve those to empty modules — they're not installed for native and don't belong.
const WEB_ONLY = new Set(['@tensorflow/tfjs', 'nsfwjs', 'tesseract.js'])
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (WEB_ONLY.has(moduleName)) return { type: 'empty' }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform)
}

module.exports = config
