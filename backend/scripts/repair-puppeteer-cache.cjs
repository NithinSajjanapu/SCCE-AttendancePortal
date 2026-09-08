const { existsSync, readdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');

// Render can restore node_modules from its build cache. Puppeteer deliberately
// refuses to overwrite an installation directory when its Chrome executable is
// absent, so remove only those provably incomplete Linux Chrome directories.
// A healthy cached browser remains untouched and is not downloaded again.
if (process.platform === 'linux') {
  const chromeRoot = join(__dirname, '..', 'node_modules', '.cache', 'puppeteer', 'chrome');

  if (existsSync(chromeRoot)) {
    for (const entry of readdirSync(chromeRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith('linux-')) continue;

      const installation = join(chromeRoot, entry.name);
      const executable = join(installation, 'chrome-linux64', 'chrome');
      if (!existsSync(executable)) {
        rmSync(installation, { recursive: true, force: true });
        console.log(`PUPPETEER_CACHE_REPAIRED ${entry.name}`);
      }
    }
  }
}
