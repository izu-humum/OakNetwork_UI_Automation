/**
 * Login flow — extracted from run_automation.js.
 *
 * Every action is wrapped in `step(name, async () => { ... })` so that
 * when run from a Playwright test, each click / fill / wait shows up as
 * an individual reportable step. When run from `npm run automation`,
 * the default console-logging step runner is used.
 *
 * Usage:
 *   const { runLogin } = require('./login');
 *   await runLogin(page, context, { step });            // page/context from CDP attach
 *   await runLogin(page, context);                       // CLI mode (default step)
 */

const { resolveStep } = require('./step');

const DEFAULT_BASE_URL = (process.env.PLAYWRIGHT_BASE_URL || 'https://app-dev.oaknetwork.org/').replace(/\/$/, '');
const PAUSE_AFTER_LOAD_MS = Number(process.env.PAUSE_AFTER_LOAD_MS) || 5000;
const ALLOW_AUTH_LANDING = process.env.ALLOW_AUTH_LANDING === '1';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAuthPath(pathname) {
  return /\/auth|\/privy/i.test(pathname);
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

function continueWithWalletControl(page) {
  return page
    .locator('button.login-method-button')
    .filter({ hasText: /continue with a wallet/i })
    .or(page.getByRole('button', { name: /continue with a wallet/i }))
    .first();
}

function metaMaskWalletControl(page) {
  return page
    .getByRole('button', { name: /metamask/i })
    .or(
      page.locator('button').filter({ has: page.locator('span', { hasText: /^MetaMask$/i }) })
    )
    .first();
}

async function isUserLoggedIn(page) {
  const avatar = page
    .locator('button.chakra-popover__trigger')
    .filter({ has: page.locator('[data-scope="avatar"]') })
    .or(page.locator('.chakra-avatar__root'))
    .first();
  return avatar.isVisible({ timeout: 5000 }).catch(() => false);
}

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
        // retry
      }
    }
    await sleep(1000);
  }
  return null;
}

async function openUrlSafely(page, href, baseURL) {
  await page.goto(href, { waitUntil: 'load', timeout: 60_000 });
  await page.locator('body').waitFor({ state: 'visible' });

  const landedPath = new URL(page.url()).pathname;
  const wantedPath = new URL(href).pathname;

  if (
    !ALLOW_AUTH_LANDING &&
    isAuthPath(landedPath) &&
    wantedPath !== '/' &&
    wantedPath !== ''
  ) {
    const home = `${baseURL}/`;
    await page.goto(home, { waitUntil: 'load', timeout: 60_000 });
    await page.locator('body').waitFor({ state: 'visible' });
  }
}

async function runLogin(page, context, opts = {}) {
  const step = resolveStep(opts);
  const baseURL = opts.baseURL || DEFAULT_BASE_URL;
  const pathSegment = opts.path || process.env.OPEN_PATH || '/';
  const targetUrl = new URL(
    pathSegment.startsWith('/') ? pathSegment : `/${pathSegment}`,
    `${baseURL}/`
  ).href;

  await step('Open Oak Network home page', async () => {
    await openUrlSafely(page, targetUrl, baseURL);
    await sleep(PAUSE_AFTER_LOAD_MS);
  });

  await step('Log out if already logged in', async () => {
    const alreadyLoggedIn = await isUserLoggedIn(page);
    if (!alreadyLoggedIn) return;

    const avatar = page
      .locator('button.chakra-popover__trigger')
      .filter({ has: page.locator('[data-scope="avatar"]') })
      .first();
    await avatar.waitFor({ state: 'visible', timeout: 10_000 });
    await avatar.click();
    await sleep(1500);

    const popoverContent = page.locator('.chakra-popover__content[data-state="open"]');
    await popoverContent.waitFor({ state: 'visible', timeout: 10_000 });
    const logOutBtn = popoverContent.locator('button').filter({ hasText: /^Log Out$/i }).first();
    await logOutBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await logOutBtn.click();
    await sleep(3000);

    await openUrlSafely(page, `${baseURL}/`, baseURL);
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
    await sleep(PAUSE_AFTER_LOAD_MS);
  });

  await step('Click "Log In" button', async () => {
    let clicked = false;
    let lastErr;
    for (let attempt = 0; attempt < 3 && !clicked; attempt++) {
      try {
        const loc = loginControl(page);
        await loc.waitFor({ state: 'visible', timeout: 20_000 });
        await sleep(200);
        await loc.click();
        clicked = true;
      } catch (err) {
        lastErr = err;
        const pathname = new URL(page.url()).pathname;
        if (pathname !== '/' && pathname !== '') {
          await openUrlSafely(page, `${baseURL}/`, baseURL);
          await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
          await sleep(PAUSE_AFTER_LOAD_MS);
        } else if (attempt < 2) {
          await page.reload({ waitUntil: 'load', timeout: 30_000 }).catch(() => {});
          await sleep(PAUSE_AFTER_LOAD_MS);
        }
      }
    }
    if (!clicked) throw lastErr || new Error('Log In button not found.');
  });

  await step('Click "Continue with a wallet"', async () => {
    const loc = continueWithWalletControl(page);
    await loc.waitFor({ state: 'visible', timeout: 30_000 });
    await sleep(300);
    await loc.click();
  });

  let mmPage = null;

  await step('Click "MetaMask" wallet option', async () => {
    const loc = metaMaskWalletControl(page);
    await loc.waitFor({ state: 'visible', timeout: 30_000 });
    await sleep(300);

    const popupPromise = context
      ? context.waitForEvent('page', { timeout: 15_000 }).catch(() => null)
      : page.waitForEvent('popup', { timeout: 15_000 }).catch(() => null);

    await loc.click();
    mmPage = await popupPromise;
    if (mmPage) {
      await mmPage.waitForLoadState('domcontentloaded').catch(() => {});
      await sleep(2000);
      return;
    }
    await sleep(3000);
    if (context) {
      mmPage = await findMetaMaskPage(context);
    }
  });

  await step('Unlock MetaMask (enter password and click Unlock)', async () => {
    if (!mmPage) return;
    const { MM_PASSWORD } = require('./metamask_password');

    await mmPage.bringToFront();
    await sleep(1500);

    const passwordInput = mmPage
      .locator('input[type="password"]')
      .or(mmPage.getByTestId('unlock-password'))
      .or(mmPage.locator('#password'))
      .first();

    const isLocked = await passwordInput.isVisible({ timeout: 8000 }).catch(() => false);
    if (!isLocked) return;

    await passwordInput.click();
    for (const char of MM_PASSWORD) {
      await mmPage.keyboard.type(char, { delay: 60 + Math.floor(Math.random() * 80) });
    }
    await sleep(300);
    const unlockBtn = mmPage
      .getByRole('button', { name: /unlock/i })
      .or(mmPage.locator('button[data-testid="unlock-submit"]'))
      .first();
    await unlockBtn.click();
    await sleep(2000);
  });

  await step('Click MetaMask "Connect" button', async () => {
    if (!mmPage) return;
    await mmPage.bringToFront();
    await sleep(1500);

    const connectBtn = mmPage
      .locator('button[data-testid="confirm-btn"]')
      .or(mmPage.getByRole('button', { name: /^connect$/i }))
      .first();

    const visible = await connectBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!visible) return;

    await sleep(300);
    await connectBtn.click();
    await sleep(2000);
  });

  await step('Click MetaMask "Confirm" (signature)', async () => {
    const popup = await findMetaMaskPage(context);
    if (!popup) return;
    await popup.bringToFront();
    await sleep(1500);

    const confirmBtn = popup
      .locator('button[data-testid="confirm-footer-button"]')
      .or(popup.getByRole('button', { name: /^confirm$/i }))
      .first();
    const visible = await confirmBtn.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!visible) return;
    await sleep(300);
    await confirmBtn.click();
    await sleep(2000);
  });

  await step('Dismiss "One more step" verification modal if present', async () => {
    await sleep(3000);
    let appPage = page;
    if (context) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const pages = context.pages();
        const onboarding = pages.find((p) => p.url().includes('/auth/onboarding'));
        if (onboarding) {
          appPage = onboarding;
          break;
        }
        const appTab = pages.find(
          (p) => p.url().includes(baseURL) && !p.url().includes('chrome-extension://')
        );
        if (appTab) appPage = appTab;
        await sleep(2000);
      }
    }
    await appPage.bringToFront();
    await sleep(3000);

    let modalFound = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const visible = await appPage.locator('text=One more step').isVisible().catch(() => false);
      if (visible) {
        modalFound = true;
        break;
      }
      await sleep(2000);
    }
    if (!modalFound) return;

    const skipBtn = appPage
      .getByRole('button', { name: /^skip$/i })
      .or(appPage.locator('button.chakra-button').filter({ hasText: /^Skip$/i }))
      .first();
    await skipBtn.waitFor({ state: 'visible', timeout: 5000 });
    await skipBtn.click();
    await sleep(1500);
  });

  await step('Verify user is logged in (avatar visible)', async () => {
    const loggedIn = await isUserLoggedIn(page);
    if (!loggedIn) throw new Error('Avatar not visible after login flow.');
  });
}

module.exports = { runLogin };
