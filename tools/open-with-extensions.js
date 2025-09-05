/*
  Opens Playwright Chromium with specified unpacked Chrome extensions.
  Usage:
    node tools/open-with-extensions.js --ext dist --ext path/to/another/extension [--url https://example.com]

  Notes:
  - Extensions require headful mode; headless must be false.
  - For MV3, the service worker will appear in context.serviceWorkers().
*/

const fs = require('fs');
const path = require('path');

async function main() {
  const { chromium } = require('playwright');

  const args = process.argv.slice(2);
  const exts = [];
  let url = 'https://www.customwheeloffset.com/';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ext') {
      const p = args[++i];
      if (!p) throw new Error('--ext requires a path');
      exts.push(path.resolve(p));
    } else if (args[i] === '--url') {
      url = args[++i] || url;
    }
  }

  if (exts.length === 0) {
    exts.push(path.resolve(__dirname, '..', 'dist'));
  }

  exts.forEach((p) => {
    if (!fs.existsSync(p)) {
      throw new Error(`Extension path does not exist: ${p}`);
    }
  });

  const userDataDir = path.resolve('.playwright-chrome');

  const extArg = exts.join(',');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chrome', // use installed Chrome for best MV3 support
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      `--disable-extensions-except=${extArg}`,
      `--load-extension=${extArg}`,
    ],
  });

  // Helpful: log MV3 service worker URLs to extract IDs
  const logServiceWorkers = () => {
    const sws = context.serviceWorkers();
    if (sws.length) {
      console.log('Loaded extension service workers:');
      for (const sw of sws) {
        try {
          const id = new URL(sw.url()).host;
          console.log(` - ${id} (${sw.url()})`);
        } catch {}
      }
    }
  };

  context.on('serviceworker', logServiceWorkers);
  // Log any existing ones
  logServiceWorkers();

  const page = await context.newPage();
  await page.goto(url);
  console.log('Opened:', url);

  // Keep running
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

