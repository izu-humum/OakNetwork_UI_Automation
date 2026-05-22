/**
 * Admin panel automation — approves the campaign and waits for it to go live.
 *
 * Every action is wrapped in `step(name, async () => { ... })` for
 * per-step reporting in the Playwright HTML report.
 *
 * Usage:
 *   const { runAdmin } = require('./admin');
 *   await runAdmin(page, context, campaignTitle, { step });
 */

const { ADMIN_EMAIL, ADMIN_PASSWORD } = require('./admin_credentials');
const { resolveStep } = require('./step');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeHumanLike(page, text, { min = 60, jitter = 80 } = {}) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: min + Math.floor(Math.random() * jitter) });
  }
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

async function runAdmin(page, context, campaignTitle, opts = {}) {
  const step = resolveStep(opts);
  const adminUrl = opts.adminUrl;
  const appHomeUrl = opts.appHomeUrl;
  if (!adminUrl) {
    throw new Error('runAdmin: opts.adminUrl is required (pass the selected environment\'s admin URL).');
  }
  if (!appHomeUrl) {
    throw new Error('runAdmin: opts.appHomeUrl is required (pass the selected environment\'s app URL).');
  }

  let adminPage;
  await step('Open admin panel in new tab', async () => {
    adminPage = await context.newPage();
    await adminPage.goto(adminUrl, { waitUntil: 'load', timeout: 60_000 });
    await adminPage.bringToFront();
    await sleep(3000);
  });

  const alreadyLoggedIn = adminPage.url().includes('/admin/projects');

  if (!alreadyLoggedIn) {
    await step('Fill admin email', async () => {
      const emailInput = adminPage.locator('input[name="email"]');
      await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
      await emailInput.click();
      await sleep(500);
      await typeHumanLike(adminPage, ADMIN_EMAIL);
    });

    await step('Fill admin password', async () => {
      const passwordInput = adminPage.locator('input[name="password"]');
      await passwordInput.waitFor({ state: 'visible', timeout: 15_000 });
      await passwordInput.click();
      await sleep(500);
      await typeHumanLike(adminPage, ADMIN_PASSWORD);
    });

    await step('Click "Login" button (admin)', async () => {
      const loginBtn = adminPage.locator('button[type="submit"]').filter({ hasText: /login/i });
      await loginBtn.waitFor({ state: 'visible', timeout: 15_000 });
      await loginBtn.click();
      await adminPage.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
      await sleep(3000);
    });
  }

  if (!campaignTitle) {
    throw new Error('No campaign title provided — cannot approve campaign.');
  }

  await step(`Locate campaign "${campaignTitle}" in admin table`, async () => {
    await sleep(3000);
    const campaignRow = adminPage.locator('tr').filter({ hasText: campaignTitle });
    const found = await campaignRow.first().isVisible({ timeout: 15_000 }).catch(() => false);
    if (!found) {
      const noResults = adminPage.locator('td').filter({ hasText: /no results/i });
      const isEmpty = await noResults.isVisible({ timeout: 5_000 }).catch(() => false);
      throw new Error(
        isEmpty
          ? `Campaign "${campaignTitle}" not found — admin table shows "No results".`
          : `Campaign "${campaignTitle}" not visible in admin table.`
      );
    }
  });

  await step('Click "Approve Campaign" icon (row)', async () => {
    const campaignRow = adminPage.locator('tr').filter({ hasText: campaignTitle });
    const approveIcon = campaignRow.first().getByRole('img', { name: 'Approve Campaign' });
    await approveIcon.waitFor({ state: 'visible', timeout: 10_000 });
    await approveIcon.click();
    await sleep(3000);
  });

  await step('Wait for "Approve Project" confirmation modal', async () => {
    const approveModal = adminPage.getByText('Approve Project');
    await approveModal.waitFor({ state: 'visible', timeout: 15_000 });
  });

  await step('Click "APPROVE" button on modal', async () => {
    const approveBtn = adminPage.getByRole('button', { name: /^approve$/i });
    await approveBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await approveBtn.click();
    await sleep(3000);
  });

  await step('Click MetaMask "Confirm" (first signature)', async () => {
    const mmPage = await findMetaMaskPage(context);
    if (!mmPage) throw new Error('MetaMask popup not found for first confirmation.');
    await mmPage.bringToFront();
    await sleep(2000);
    const confirmBtn1 = mmPage.locator('button[data-testid="confirm-footer-button"]');
    await confirmBtn1.waitFor({ state: 'visible', timeout: 15_000 });
    await confirmBtn1.click();
    await sleep(5000);
  });

  await step('Click MetaMask "Confirm" (second signature)', async () => {
    const mmPage = await findMetaMaskPage(context);
    if (!mmPage) throw new Error('MetaMask popup not found for second confirmation.');
    await mmPage.bringToFront();
    await sleep(2000);
    const confirmBtn2 = mmPage.locator('button[data-testid="confirm-footer-button"]');
    await confirmBtn2.waitFor({ state: 'visible', timeout: 15_000 });
    await confirmBtn2.click();
    await sleep(3000);
  });

  await step('Verify campaign status changes to PRE_LAUNCH', async () => {
    await adminPage.bringToFront();
    await sleep(3000);
    const preLaunchCell = adminPage.locator('td').filter({ hasText: /PRE_LAUNCH/i });
    for (let attempt = 0; attempt < 10; attempt++) {
      const isPreLaunch = await preLaunchCell.first().isVisible({ timeout: 3_000 }).catch(() => false);
      if (isPreLaunch) return;
      await sleep(2000);
    }
    throw new Error('Campaign did not reach PRE_LAUNCH status within timeout.');
  });

  let campaignTab;
  await step('Switch back to Oak Network campaign tab', async () => {
    const appHost = new URL(appHomeUrl).host;
    const allPages = context.pages();
    campaignTab = allPages.find(
      (p) => p.url().includes(appHost) || p.url().includes('oaknetwork')
    );
    if (!campaignTab) throw new Error('Oak Network campaign tab not found.');
    await campaignTab.bringToFront();
    await sleep(2000);
  });

  await step('Hard refresh campaign page', async () => {
    await campaignTab.reload({ waitUntil: 'load', timeout: 60_000 });
    await sleep(5000);
  });

  await step('Wait for "Campaign Launching" modal and countdown to complete', async () => {
    const launchingModal = campaignTab.getByText('Campaign Launching');
    const launchingVisible = await launchingModal.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!launchingVisible) {
      return;
    }

    const liveModal = campaignTab.getByText('Your Campaign is Live!');
    let isLiveNow = false;
    while (!isLiveNow) {
      isLiveNow = await liveModal.isVisible({ timeout: 1_000 }).catch(() => false);
      if (isLiveNow) break;
      const timerText = await campaignTab.locator('.css-13yktzd').textContent().catch(() => null);
      if (timerText) {
        process.stdout.write(`\rTime remaining: ${timerText}   `);
      }
      await sleep(1000);
    }
    process.stdout.write('\r                          \r');
    await sleep(2000);
  });

  await step('Grant clipboard permission for share button', async () => {
    const cdpSession = await campaignTab.context().newCDPSession(campaignTab);
    await cdpSession
      .send('Browser.grantPermissions', {
        origin: campaignTab.url(),
        permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
      })
      .catch(() => {});
  });

  await step('Click "Share Campaign" button', async () => {
    const shareBtn = campaignTab.getByRole('button', { name: /share campaign/i });
    const visible = await shareBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) return;
    await shareBtn.click();
    await sleep(2000);
  });

  await step('Click "View Campaign" button', async () => {
    const viewBtn = campaignTab.getByRole('button', { name: /view campaign/i });
    const visible = await viewBtn.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!visible) return;
    await viewBtn.click();
    await campaignTab.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await sleep(5000);
  });

  await step('Verify campaign status badge is "Live"', async () => {
    const liveBadge = campaignTab.locator('.chakra-badge').filter({ hasText: /live/i });
    const isLive = await liveBadge.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!isLive) {
      throw new Error('"Live" status badge not visible on campaign page.');
    }
  });

  await step('Navigate back to Oak Network home', async () => {
    await campaignTab.goto(appHomeUrl, { waitUntil: 'load', timeout: 60_000 });
    await sleep(3000);
  });
}

module.exports = { runAdmin };
