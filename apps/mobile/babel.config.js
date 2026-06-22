module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // reanimated v4 moved the worklet transform plugin to react-native-worklets
    plugins: ['react-native-worklets/plugin'],
  };
};
