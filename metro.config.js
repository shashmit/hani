// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The Tauri desktop shell (Rust sources and its large build output) is not app code.
config.resolver.blockList = [...[].concat(config.resolver.blockList ?? []), /[\\/]src-tauri[\\/].*/];

module.exports = config;
