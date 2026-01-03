const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude macOS resource fork files (._*) from being processed
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /.*\/\._.*/,
];

module.exports = config;

