// Metro/Babel resolves the shared workspace packages (@drawie/core, @drawie/data)
// from outside apps/native via metro.config.js (watchFolders + extraNodeModules),
// since apps/native is intentionally NOT in the root npm workspace install.
module.exports = function (api) {
  api.cache(true)
  return {
    // NativeWind v4 stable: jsxImportSource routes className through nativewind's jsx
    // runtime, and 'nativewind/babel' wires the className transform. Both are presets,
    // so they don't disturb the worklets plugin below.
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // react-native-worklets/plugin powers reanimated v4 (which react-native-skia's
    // <Canvas> renderer depends on). It MUST be the last plugin.
    plugins: ['react-native-worklets/plugin'],
  }
}
