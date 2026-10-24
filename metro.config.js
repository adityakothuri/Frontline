// Expo's defaults, with one change: Metro's transform cache lives in the
// (git-ignored) `.expo/` folder instead of the system temp folder. macOS clears
// $TMPDIR after a few days, which made every `expo start` re-transform the whole
// app and node_modules from scratch — minutes of waiting before the app opened.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { FileStore } = require('@expo/metro-config/file-store');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.cacheStores = [new FileStore({ root: path.join(__dirname, '.expo', 'metro-cache') })];

module.exports = config;
