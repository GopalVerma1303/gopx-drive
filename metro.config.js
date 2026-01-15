// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("@expo/metro-config");

// Extend @expo/metro-config as required by EAS
/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Configure path aliases
config.resolver = {
  ...config.resolver,
  alias: {
    "@": __dirname,
  },
  extraNodeModules: {
    "@": __dirname,
  },
};

module.exports = config;
