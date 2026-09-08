const { join } = require('node:path');

// Keep the managed browser with the deployed backend instead of Render's
// shared home-cache. That prevents a partially restored shared cache from
// making a later build appear successful while leaving Chrome unavailable at
// runtime.
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer')
};
