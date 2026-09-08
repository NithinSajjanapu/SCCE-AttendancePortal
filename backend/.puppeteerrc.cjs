const { join } = require('node:path');

// Keep the managed browser beside the runtime dependencies instead of
// Render's shared home-cache. The runtime already receives node_modules, so
// Chrome and Puppeteer are deployed as one unit rather than depending on a
// separately restored build cache.
module.exports = {
  cacheDirectory: join(__dirname, 'node_modules', '.cache', 'puppeteer'),
  // The PDF renderer launches full Chrome; the separate headless-shell binary
  // is unused and need not make the build fail or consume cache space.
  'chrome-headless-shell': {
    skipDownload: true
  }
};
