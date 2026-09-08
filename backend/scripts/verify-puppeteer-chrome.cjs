const { existsSync } = require('node:fs');
const puppeteer = require('puppeteer');

const executable = puppeteer.executablePath();
if (!existsSync(executable)) {
  console.error('PUPPETEER_CHROME_VERIFY_FAILED');
  process.exit(1);
}

console.log('PUPPETEER_CHROME_READY');
