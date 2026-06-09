// Metro/Babel must resolve the shared workspace packages (@drawie/core, @drawie/data)
// from outside apps/native. Because apps/native is intentionally NOT part of the root
// npm workspace install, configure Metro's watchFolders + extraNodeModules in
// metro.config.js (see NATIVE_PLAN.md) so it can reach ../../packages.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-reanimated/gesture-handler plugin must be last if added.
    ],
  }
}
