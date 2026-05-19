/**
 * Chrome lifecycle helpers — extracted from run_automation.js so both
 * the standalone runner and the Playwright test file can reuse them.
 *
 * The helpers prefer attaching to an already-running Chrome via CDP.
 * If none is running, they copy the user's Chrome profile to a temp
 * directory and launch a second Chrome instance with
 * `--remote-debugging-port=9222`. This keeps MetaMask and all
 * extensions available without disturbing the user's real Chrome.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { chromium } = require('@playwright/test');

const CDP_PORT = 9222;
const CDP_TRY_TIMEOUT_MS = 2500;
const AUTOMATION_DATA_DIR = path.join(os.tmpdir(), 'chrome-automation-profile');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chromeUserDataDir() {
  if (process.env.CHROME_USER_DATA_DIR) {
    return path.resolve(process.env.CHROME_USER_DATA_DIR);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
  }
  if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
  }
  return path.join(os.homedir(), '.config', 'google-chrome');
}

function prepareAutomationProfile() {
  const profileDirectory = process.env.CHROME_PROFILE_DIRECTORY || 'Default';
  const srcDataDir = chromeUserDataDir();
  const srcProfile = path.join(srcDataDir, profileDirectory);
  const dstProfile = path.join(AUTOMATION_DATA_DIR, profileDirectory);

  try {
    if (fs.existsSync(AUTOMATION_DATA_DIR)) {
      execSync(`rm -rf "${AUTOMATION_DATA_DIR}"`, { stdio: 'ignore' });
    }
  } catch {
    fs.rmSync(AUTOMATION_DATA_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(AUTOMATION_DATA_DIR, { recursive: true });

  console.log(`Copying Chrome profile "${profileDirectory}" for automation…`);
  execSync(`cp -R "${srcProfile}" "${dstProfile}"`, { stdio: 'pipe', timeout: 60_000 });

  const localState = path.join(srcDataDir, 'Local State');
  if (fs.existsSync(localState)) {
    fs.copyFileSync(localState, path.join(AUTOMATION_DATA_DIR, 'Local State'));
  }

  fs.writeFileSync(path.join(AUTOMATION_DATA_DIR, 'First Run'), '');
  return AUTOMATION_DATA_DIR;
}

function launchChromeWithDebugging() {
  const profileDirectory = process.env.CHROME_PROFILE_DIRECTORY || 'Default';
  const automationDir = prepareAutomationProfile();
  console.log(`Launching Chrome with --remote-debugging-port=${CDP_PORT}…`);

  const bin =
    process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : 'google-chrome';

  const child = spawn(
    bin,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${automationDir}`,
      `--profile-directory=${profileDirectory}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-crash-reporter',
      '--noerrdialogs',
      '--disable-breakpad',
      '--disable-infobars',
      '--disable-session-crashed-bubble',
      '--hide-crash-restore-bubble',
      '--restore-last-session=false',
    ],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();
}

async function waitForCDP(maxWaitMs = 30_000) {
  const endpoint = `http://127.0.0.1:${CDP_PORT}`;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const browser = await chromium.connectOverCDP(endpoint, {
        timeout: CDP_TRY_TIMEOUT_MS,
      });
      const ctx = browser.contexts()[0];
      if (ctx) {
        const page = await ctx.newPage();
        console.log(`Attached to Chrome (CDP ${endpoint}) — opened a new tab.\n`);
        return { launchKind: 'cdp', browser, context: ctx, page };
      }
      await browser.close().catch(() => {});
    } catch {
      // not ready yet
    }
    await sleep(1000);
  }
  return null;
}

async function tryAttachChromeViaCDP() {
  const chromeCdpUrl = process.env.CHROME_CDP_URL?.trim();
  const raw = [
    chromeCdpUrl,
    `http://127.0.0.1:${CDP_PORT}`,
    `http://localhost:${CDP_PORT}`,
  ].filter((u) => typeof u === 'string' && u.trim());

  const seen = new Set();
  for (const r of raw) {
    const endpoint = r.trim().replace(/\/$/, '');
    if (seen.has(endpoint)) continue;
    seen.add(endpoint);
    try {
      const browser = await chromium.connectOverCDP(endpoint, {
        timeout: CDP_TRY_TIMEOUT_MS,
      });
      const ctx = browser.contexts()[0];
      if (!ctx) {
        await browser.close().catch(() => {});
        continue;
      }
      const page = await ctx.newPage();
      console.log(`Using your open Chrome (CDP ${endpoint}) — opened a new tab.\n`);
      return { launchKind: 'cdp', browser, context: ctx, page };
    } catch {
      // try next
    }
  }
  return null;
}

async function launchBrowserAndGetPage() {
  if (process.env.USE_BUNDLED_CHROMIUM === '1') {
    console.log('Using bundled Chromium (USE_BUNDLED_CHROMIUM=1). Extensions like MetaMask are not available.\n');
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    return { launchKind: 'bundled', browser, context: null, page };
  }

  const attached = await tryAttachChromeViaCDP();
  if (attached) return attached;

  launchChromeWithDebugging();
  const result = await waitForCDP();
  if (result) return result;

  throw new Error('Launched Chrome but could not connect via CDP. Check Chrome installation path.');
}

async function closeBrowser({ launchKind, browser, context }) {
  try {
    if (launchKind === 'cdp') {
      if (context) {
        for (const p of context.pages()) {
          await p.close().catch(() => {});
        }
      }
      await browser?.close().catch(() => {});
      try {
        execSync(`lsof -ti TCP:${CDP_PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
      } catch {
        // already closed
      }
    } else if (launchKind === 'persistent' && context) {
      await context.close();
    } else if (browser) {
      await browser.close();
    }
  } catch {
    try {
      execSync(`lsof -ti TCP:${CDP_PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
    } catch {
      // ok
    }
  }
}

module.exports = {
  CDP_PORT,
  launchBrowserAndGetPage,
  closeBrowser,
};
