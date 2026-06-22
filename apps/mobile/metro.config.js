const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch monorepo root so Metro can resolve ../../../convex/_generated/api
config.watchFolders = [monorepoRoot];

// Only resolve node_modules from the mobile app — adding root node_modules
// causes transformer conflicts with web-only packages.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
];

// Stub react-dom — @clerk/react imports it for web portals but it must never
// execute on Android. Point it to a harmless empty module.
config.resolver.extraNodeModules = {
  'react-dom': path.resolve(projectRoot, 'shims/react-dom.js'),
};

// Prevent Metro from crawling into nested react-native copies
config.resolver.blockList = [
  /node_modules\/.*\/node_modules\/react-native\/.*/,
];

module.exports = config;
