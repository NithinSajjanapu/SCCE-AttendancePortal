const { join } = require('node:path');

// Keep the managed browser beside the runtime dependencies instead of
// Render's shared home-cache. The runtime already receives node_modules, so
// Chrome and Puppeteer are deployed as one unit rather than depending on a
// separately restored build cache.
module.exports = {
  cacheDirectory: join(__dirname, 'node_modules', '.cache', 'puppeteer')
};
