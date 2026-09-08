const { existsSync, readdirSync, rmSync } = require('node:fs');
const { join } = require('node:path');

// Render can restore node_modules from its build cache. Puppeteer deliberately
// refuses to overwrite an installation directory when its Chrome executable is
// absent, so remove only those provably incomplete Chrome directories.
// A healthy cached browser remains untouched and is not downloaded again.
const chromeRoot = join(__dirname, '..', 'node_modules', '.cache', 'puppeteer', 'chrome');

if (existsSync(chromeRoot)) {
  for (const entry of readdirSync(chromeRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const executable = entry.name.startsWith('linux-')
      ? join(chromeRoot, entry.name, 'chrome-linux64', 'chrome')
      : entry.name.startsWith('win64-')
        ? join(chromeRoot, entry.name, 'chrome-win64', 'chrome.exe')
        : null;
    if (executable && !existsSync(executable)) {
      rmSync(join(chromeRoot, entry.name), { recursive: true, force: true });
      console.log(`PUPPETEER_CACHE_REPAIRED ${entry.name}`);
    }
  }
}
