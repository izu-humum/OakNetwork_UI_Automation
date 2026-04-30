const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');
const { chromium } = require('@playwright/test');
const { createCampaign } = require('./create_campaign');
const { runAdmin } = require('./admin');
const { cryptoPledge } = require('./crypto_pledge');

const baseURL = (
  process.env.PLAYWRIGHT_BASE_URL ||
  'https://app-dev.oaknetwork.org/'
).replace(/\/$/, '');
const pathSegment = process.env.OPEN_PATH || '/';
const url = new URL(
  pathSegment.startsWith('/') ? pathSegment : `/${pathSegment}`,
  `${baseURL}/`
).href;

const PAUSE_AFTER_LOAD_MS = Number(process.env.PAUSE_AFTER_LOAD_MS) || 5000;
const allowAuthLanding = process.env.ALLOW_AUTH_LANDING === '1';
const useBundledChromium = process.env.USE_BUNDLED_CHROMIUM === '1';
const chromeCdpUrl = process.env.CHROME_CDP_URL?.trim();
const CDP_PORT = 9222;
const CDP_TRY_TIMEOUT_MS = 2500;

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function announceClick(buttonLabel) {
  await sleep(2000);
  console.log(`Clicking "${buttonLabel}" button…`);
}

/**
 * Check if the user is already logged in by looking for the avatar/popover trigger in the header.
 * <button class="chakra-popover__trigger" ...><div><div class="chakra-avatar__root ..."> ...
 */
async function isUserLoggedIn(page) {
  const avatar = page
    .locator('button.chakra-popover__trigger')
    .filter({ has: page.locator('[data-scope="avatar"]') })
    .or(page.locator('.chakra-avatar__root'))
    .first();

  return avatar.isVisible({ timeout: 5000 }).catch(() => false);
}

function loginControl(page) {
  const chakraLogIn = page
    .locator('button[type="button"].chakra-button')
    .filter({ has: page.locator('p', { hasText: /^Log In$/i }) });
  return chakraLogIn
    .or(page.getByRole('button', { name: /log in/i }))
    .or(page.getByRole('link', { name: /log in/i }))
    .first();
}

function isAuthPath(pathname) {
  return /\/auth|\/privy/i.test(pathname);
}

async function openUrl(page, href) {
  console.log(`Opening ${href}…`);
  await page.goto(href, { waitUntil: 'load', timeout: 60_000 });
  await page.locator('body').waitFor({ state: 'visible' });

  const landedPath = new URL(page.url()).pathname;
  const wantedPath = new URL(href).pathname;
  if (landedPath !== wantedPath) {
    console.log(`Note: Now at ${page.url()} (redirect from ${href}).`);
  }

  if (
    !allowAuthLanding &&
    isAuthPath(landedPath) &&
    wantedPath !== '/' &&
    wantedPath !== ''
  ) {
    console.log(
      'That route opens login immediately when you are logged out. Opening the public home page first so you can wait, scroll, then click Log In.'
    );
    const home = `${baseURL}/`;
    console.log(`Opening ${home}…`);
    await page.goto(home, { waitUntil: 'load', timeout: 60_000 });
    await page.locator('body').waitFor({ state: 'visible' });
  }
}

async function getScrollY(page) {
  return page.evaluate(() => window.scrollY).catch(() => 0);
}

async function isAtBottom(page) {
  return page.evaluate(
    () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 5
  ).catch(() => true);
}

async function focusPage(page) {
  await page.locator('body').click({ position: { x: 400, y: 300 }, force: true }).catch(() => {});
  await sleep(200);
}

async function humanScrollDown(page) {
  await focusPage(page);

  for (let i = 0; i < 12; i++) {
    const atBottom = await isAtBottom(page);
    if (atBottom) break;
    await page.keyboard.press('PageDown');
    await sleep(400 + Math.random() * 400);
  }
  await sleep(500);
}

async function humanScrollUp(page) {
  for (let i = 0; i < 12; i++) {
    const y = await getScrollY(page);
    if (y <= 0) break;
    await page.keyboard.press('PageUp');
    await sleep(400 + Math.random() * 400);
  }
  await sleep(500);
}

/**
 * Scroll to the bottom, clicking "Load More" each time it appears,
 * until the button is gone (all projects loaded).
 */
async function scrollAndLoadAll(page) {
  console.log('Scrolling down and loading all projects…');
  let loadMoreClicks = 0;

  for (let round = 0; round < 50; round++) {
    await humanScrollDown(page);

    const loadMoreBtn = page
      .getByRole('button', { name: /^load more$/i })
      .or(
        page.locator('button.chakra-button').filter({ hasText: /^Load More$/i })
      )
      .first();

    const visible = await loadMoreBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) {
      break;
    }

    // Scroll the button into the center of the viewport so it doesn't overlap with cards
    await loadMoreBtn.scrollIntoViewIfNeeded();
    await sleep(1000);
    await announceClick('Load More');
    await loadMoreBtn.click({ force: false, trial: true }).catch(() => {});
    await loadMoreBtn.click();
    loadMoreClicks++;
    console.log(`Clicked "Load More" button (${loadMoreClicks}).`);
    await sleep(3000 + Math.random() * 1000);
  }

  if (loadMoreClicks > 0) {
    console.log(`All projects loaded (clicked Load More ${loadMoreClicks} time${loadMoreClicks > 1 ? 's' : ''}).`);
  } else {
    console.log('No "Load More" button found — all projects already visible.');
  }
}

async function humanLikeBrowse(page) {
  console.log(`Waiting ${PAUSE_AFTER_LOAD_MS / 1000}s for the page to feel loaded…`);
  await sleep(PAUSE_AFTER_LOAD_MS);

  console.log('Scrolling down, then back up…');
  await humanScrollDown(page);
  await sleep(500 + Math.random() * 500);
  await humanScrollUp(page);
  await sleep(300 + Math.random() * 400);
}

async function clickLoginButton(page, timeoutMs) {
  const loc = loginControl(page);
  await loc.waitFor({ state: 'visible', timeout: timeoutMs });
  await sleep(150 + Math.random() * 250);
  await announceClick('Log In');
  await loc.click();
  console.log('Clicked "Log In" button.');
}

function continueWithWalletControl(page) {
  return page
    .locator('button.login-method-button')
    .filter({ hasText: /continue with a wallet/i })
    .or(page.getByRole('button', { name: /continue with a wallet/i }))
    .first();
}

async function clickContinueWithWalletButton(page, timeoutMs = 30_000) {
  const loc = continueWithWalletControl(page);
  await loc.waitFor({ state: 'visible', timeout: timeoutMs });
  await sleep(200 + Math.random() * 300);
  await announceClick('Continue with a wallet');
  await loc.click();
  console.log('Clicked "Continue with a wallet" button.');
}

function metaMaskWalletControl(page) {
  return page
    .getByRole('button', { name: /metamask/i })
    .or(
      page
        .locator('button')
        .filter({ has: page.locator('span', { hasText: /^MetaMask$/i }) })
    )
    .first();
}

async function clickMetaMaskWalletButton(page, context, timeoutMs = 30_000) {
  const loc = metaMaskWalletControl(page);
  await loc.waitFor({ state: 'visible', timeout: timeoutMs });
  await sleep(200 + Math.random() * 350);

  const popupPromise = context
    ? context.waitForEvent('page', { timeout: 15_000 }).catch(() => null)
    : page.waitForEvent('popup', { timeout: 15_000 }).catch(() => null);

  await announceClick('MetaMask');
  await loc.click();
  console.log('Clicked "MetaMask" button.');

  const mmPage = await popupPromise;
  if (mmPage) {
    console.log('MetaMask window detected.');
    await mmPage.waitForLoadState('domcontentloaded').catch(() => {});
    await sleep(2000);
    return mmPage;
  }

  await sleep(3000);
  if (context) {
    const pages = context.pages();
    const mmTab = pages.find(
      (p) => p.url().includes('chrome-extension://') && p.url().includes('nkbihfbeogaeaoehlefnkodbefgpgknn')
    );
    if (mmTab) {
      console.log('MetaMask tab found.');
      return mmTab;
    }
  }

  console.log('MetaMask popup not detected by Playwright (extension UI). Continuing…');
  return null;
}

/**
 * If MetaMask is locked, enter the password and unlock.
 * Looks for the password input and "Unlock" button on the MetaMask page.
 */
async function unlockMetaMaskIfNeeded(mmPage) {
  if (!mmPage) return;

  const { MM_PASSWORD } = require('./metamask_password');

  try {
    await mmPage.bringToFront();
    await sleep(1500);

    const passwordInput = mmPage
      .locator('input[type="password"]')
      .or(mmPage.getByTestId('unlock-password'))
      .or(mmPage.locator('#password'))
      .first();

    const isLocked = await passwordInput.isVisible({ timeout: 8000 }).catch(() => false);

    if (!isLocked) {
      console.log('MetaMask is already unlocked.');
      return;
    }

    console.log('MetaMask is locked. Entering password…');
    await passwordInput.click();
    for (const char of MM_PASSWORD) {
      await mmPage.keyboard.type(char, { delay: 60 + Math.floor(Math.random() * 80) });
    }
    await sleep(300 + Math.random() * 200);

    const unlockBtn = mmPage
      .getByRole('button', { name: /unlock/i })
      .or(mmPage.locator('button[data-testid="unlock-submit"]'))
      .first();

    await announceClick('Connect with a wallet');
    await unlockBtn.click();
    console.log('Clicked "Connect with a wallet" button. MetaMask unlocked.');
    await sleep(2000);
  } catch (err) {
    console.warn('Could not unlock MetaMask automatically:', err.message);
  }
}

/**
 * Find the current MetaMask extension page across all open tabs.
 * After Connect, MetaMask closes and reopens a new popup — the old page ref is stale.
 */
async function findMetaMaskPage(context) {
  if (!context) return null;
  await sleep(2000);

  for (let attempt = 0; attempt < 10; attempt++) {
    const pages = context.pages();
    const mm = pages.find(
      (p) =>
        p.url().includes('chrome-extension://') &&
        p.url().includes('nkbihfbeogaeaoehlefnkodbefgpgknn')
    );
    if (mm) {
      try {
        await mm.waitForLoadState('domcontentloaded').catch(() => {});
        return mm;
      } catch {
        // page might be navigating, retry
      }
    }
    await sleep(1000);
  }
  return null;
}

/**
 * After MetaMask unlocks (or is already unlocked), click the "Connect" confirmation button.
 * <button data-testid="confirm-btn">Connect</button>
 */
async function clickMetaMaskConnect(mmPage, context) {
  if (!mmPage) return;

  try {
    await mmPage.bringToFront();
    await sleep(1500);

    const connectBtn = mmPage
      .locator('button[data-testid="confirm-btn"]')
      .or(mmPage.getByRole('button', { name: /^connect$/i }))
      .first();

    const visible = await connectBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) {
      console.log('MetaMask "Connect" button not found — may have auto-connected.');
      return;
    }

    await sleep(300 + Math.random() * 300);
    await announceClick('Connect');
    await connectBtn.click();
    console.log('Clicked "Connect" button. Wallet connected.');
    await sleep(2000);
  } catch (err) {
    console.warn('Could not click MetaMask Connect:', err.message);
  }
}

/**
 * After Connect, MetaMask closes the popup and opens a NEW one for signature/permission.
 * We must find that new page before clicking Confirm.
 * <button data-testid="confirm-footer-button">Confirm</button>
 */
async function clickMetaMaskConfirm(context) {
  console.log('Waiting for MetaMask to reopen for confirmation…');
  const mmPage = await findMetaMaskPage(context);

  if (!mmPage) {
    console.log('MetaMask confirmation page not found — may have auto-confirmed.');
    return;
  }

  try {
    await mmPage.bringToFront();
    await sleep(1500);

    const confirmBtn = mmPage
      .locator('button[data-testid="confirm-footer-button"]')
      .or(mmPage.getByRole('button', { name: /^confirm$/i }))
      .first();

    const visible = await confirmBtn.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!visible) {
      console.log('MetaMask "Confirm" button not found — may have auto-confirmed.');
      return;
    }

    await sleep(300 + Math.random() * 300);
    await announceClick('Confirm');
    await confirmBtn.click();
    console.log('Clicked "Confirm" button. Signature approved.');
    await sleep(2000);
  } catch (err) {
    console.warn('Could not click MetaMask Confirm:', err.message);
  }
}

/**
 * After login the app may show a "One more step (creators only)" modal
 * with Verify Profile / Skip buttons. Click Skip to dismiss.
 */
async function dismissVerifyProfileModal(page, context) {
  try {
    // After MetaMask confirm, the app redirects to /auth/onboarding/privy
    // where the verification modal appears. Find that tab.
    console.log('Looking for onboarding page…');
    await sleep(3000);

    let appPage = page;

    if (context) {
      // Wait for the onboarding page to appear (may take a few seconds)
      for (let attempt = 0; attempt < 10; attempt++) {
        const pages = context.pages();
        const onboarding = pages.find(
          (p) => p.url().includes('/auth/onboarding')
        );
        if (onboarding) {
          appPage = onboarding;
          break;
        }
        // Also try any page on the base URL
        const appTab = pages.find(
          (p) => p.url().includes(baseURL) && !p.url().includes('chrome-extension://')
        );
        if (appTab) {
          appPage = appTab;
        }
        await sleep(2000);
      }
    }

    await appPage.bringToFront();
    console.log(`On page: ${appPage.url()}`);
    await sleep(3000);

    // Poll for the modal
    let modalFound = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const modalText = appPage.locator('text=One more step');
      const visible = await modalText.isVisible().catch(() => false);
      if (visible) {
        modalFound = true;
        break;
      }
      await sleep(2000);
    }

    if (!modalFound) {
      console.log('No verification modal appeared.');
      return;
    }

    console.log('Verification modal detected ("One more step").');

    const skipBtn = appPage
      .getByRole('button', { name: /^skip$/i })
      .or(
        appPage
          .locator('button.chakra-button')
          .filter({ hasText: /^Skip$/i })
      )
      .first();

    await skipBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sleep(300 + Math.random() * 300);
    await announceClick('Skip');
    await skipBtn.click();
    console.log('Clicked "Skip" button. Verification modal dismissed.');
    await sleep(1500);
  } catch (err) {
    console.warn('Could not dismiss verification modal:', err.message);
  }
}

/**
 * Click the avatar popover trigger to open the account dropdown.
 */
async function clickAvatarPopover(page) {
  const avatar = page
    .locator('button.chakra-popover__trigger')
    .filter({ has: page.locator('[data-scope="avatar"]') })
    .first();

  await avatar.waitFor({ state: 'visible', timeout: 10_000 });
  await sleep(300 + Math.random() * 300);
  await announceClick('Avatar');
  await avatar.click();
  console.log('Clicked "Avatar" button. Account popover opened.');
  await sleep(1500);
}

/**
 * Inside the account popover, click Log Out.
 * <button type="submit" class="chakra-button css-…"><p>Log Out</p></button>
 */
async function clickLogOut(page) {
  const popoverContent = page.locator('.chakra-popover__content[data-state="open"]');
  await popoverContent.waitFor({ state: 'visible', timeout: 10_000 });

  const logOutBtn = popoverContent
    .locator('button')
    .filter({ hasText: /^Log Out$/i })
    .first();

  await logOutBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await sleep(300 + Math.random() * 300);
  await announceClick('Log Out');
  await logOutBtn.click();
  console.log('Clicked "Log Out" button. Logging out…');
  await sleep(3000);
}

// --------------- Chrome lifecycle helpers ---------------

const AUTOMATION_DATA_DIR = path.join(os.tmpdir(), 'chrome-automation-profile');

/**
 * Copy the real Chrome profile into a temporary user-data-dir.
 * Chrome on macOS ignores --remote-debugging-port when pointed at its own
 * default data directory, so we must use a separate one.
 * The copy keeps MetaMask and all extensions.
 */
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
    // fallback
    fs.rmSync(AUTOMATION_DATA_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(AUTOMATION_DATA_DIR, { recursive: true });

  console.log(`Copying Chrome profile "${profileDirectory}" for automation…`);
  execSync(`cp -R "${srcProfile}" "${dstProfile}"`, { stdio: 'pipe', timeout: 60_000 });

  const localState = path.join(srcDataDir, 'Local State');
  if (fs.existsSync(localState)) {
    fs.copyFileSync(localState, path.join(AUTOMATION_DATA_DIR, 'Local State'));
  }

  // Prevent "Welcome to Google Chrome" first-run dialog
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
        console.log(
          `Attached to Chrome (CDP ${endpoint}) — opened a new tab.\n`
        );
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
      console.log(
        `Using your open Chrome (CDP ${endpoint}) — opened a new tab.\n`
      );
      return { launchKind: 'cdp', browser, context: ctx, page };
    } catch {
      // try next
    }
  }
  return null;
}

// --------------- Main launch logic ---------------

async function launchBrowserAndGetPage() {
  if (useBundledChromium) {
    console.log(
      'Using bundled Chromium (USE_BUNDLED_CHROMIUM=1). Extensions like MetaMask are not available.\n'
    );
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    return { launchKind: 'bundled', browser, context: null, page };
  }

  // 1. Try attaching to an already-running Chrome with CDP (e.g. from a previous run)
  const attached = await tryAttachChromeViaCDP();
  if (attached) {
    return attached;
  }

  // 2. Launch a separate Chrome instance with a copy of your profile + CDP enabled.
  //    Your normal Chrome can stay open — this is a second process with its own data dir.
  launchChromeWithDebugging();
  const result = await waitForCDP();
  if (result) {
    return result;
  }
  throw new Error(
    'Launched Chrome but could not connect via CDP. Check Chrome installation path.'
  );
}

// --------------- Run ---------------

(async () => {
  const { launchKind, browser, context, page } = await launchBrowserAndGetPage();

  // Close any extra blank tabs that opened alongside the main tab
  async function closeBlankTabs() {
    for (const p of context.pages()) {
      const u = p.url();
      if (p !== page && (u === 'about:blank' || u === 'chrome://newtab/' || u === 'chrome://new-tab-page/' || u === 'chrome://welcome/')) {
        await p.close().catch(() => {});
      }
    }
  }
  await closeBlankTabs();

  await openUrl(page, url);
  await sleep(2000);
  await closeBlankTabs();
  await sleep(PAUSE_AFTER_LOAD_MS);

  // If already logged in, log out first so we go through the full login flow
  const alreadyLoggedIn = await isUserLoggedIn(page);

  if (alreadyLoggedIn) {
    console.log('User is already logged in (avatar found). Logging out first…\n');
    await clickAvatarPopover(page);
    await clickLogOut(page);

    // After logout the page may redirect; go back to home and wait for it to fully load
    const homeUrl = `${baseURL}/`;
    await openUrl(page, homeUrl);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await sleep(PAUSE_AFTER_LOAD_MS);
  }

  // Full login flow — try multiple times with increasing wait
  let loginClicked = false;
  for (let attempt = 0; attempt < 3 && !loginClicked; attempt++) {
    try {
      await clickLoginButton(page, 20_000);
      loginClicked = true;
    } catch {
      const pathname = new URL(page.url()).pathname;
      if (pathname !== '/' && pathname !== '') {
        console.log(
          'Log In is not on this page (e.g. /my-projects shows the wallet screen). Opening home for the header Log In…'
        );
        const homeUrl = `${baseURL}/`;
        await openUrl(page, homeUrl);
        await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
        await sleep(PAUSE_AFTER_LOAD_MS);
      } else if (attempt < 2) {
        console.log('Log In button not found yet. Reloading page…');
        await page.reload({ waitUntil: 'load', timeout: 30_000 }).catch(() => {});
        await sleep(PAUSE_AFTER_LOAD_MS);
      } else {
        throw new Error('Log In button or link not found.');
      }
    }
  }

  await clickContinueWithWalletButton(page, 30_000);
  const mmPage = await clickMetaMaskWalletButton(page, context, 30_000);
  await unlockMetaMaskIfNeeded(mmPage);
  await clickMetaMaskConnect(mmPage, context);
  await clickMetaMaskConfirm(context);

  // Back on the main page — dismiss the profile verification modal if it appears
  await dismissVerifyProfileModal(page, context);

  // Brief scroll after login so the page feels natural
  await sleep(2000);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('PageDown');
    await sleep(1000);
  }

  // Create a campaign
  const campaignTitle = await createCampaign(page, context);

  // Admin panel
  await runAdmin(page, context, campaignTitle);

  // Crypto pledge
  await cryptoPledge(page, context, campaignTitle);

  console.log('Press Enter in this terminal to close the browser…');
  process.stdin.setEncoding('utf8');
  await new Promise((resolve) => process.stdin.once('data', resolve));

  console.log('Closing browser…');
  try {
    if (launchKind === 'cdp') {
      // CDP: close all pages, then kill the Chrome process
      if (context) {
        for (const p of context.pages()) {
          await p.close().catch(() => {});
        }
      }
      await browser.close().catch(() => {});
      // Force kill the automation Chrome process
      try {
        execSync(
          `lsof -ti TCP:${CDP_PORT} | xargs kill -9 2>/dev/null`,
          { stdio: 'ignore' }
        );
      } catch {
        // already closed
      }
    } else if (launchKind === 'persistent' && context) {
      await context.close();
    } else if (browser) {
      await browser.close();
    }
  } catch {
    // fallback: kill automation Chrome
    try {
      execSync(
        `lsof -ti TCP:${CDP_PORT} | xargs kill -9 2>/dev/null`,
        { stdio: 'ignore' }
      );
    } catch {
      // ok
    }
  }
  console.log('Browser closed.');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
