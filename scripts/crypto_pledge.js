/**
 * Crypto Pledge automation.
 *
 * Every action is wrapped in `step(name, async () => { ... })` for
 * per-step reporting in the Playwright HTML report.
 *
 * Usage:
 *   const { cryptoPledge } = require('./crypto_pledge');
 *   await cryptoPledge(page, context, campaignTitle, { step });
 */

const { MM_PASSWORD } = require('./metamask_password');
const { resolveStep } = require('./step');

const MAX_PLEDGE_ATTEMPTS = 3;
const PLEDGE_AMOUNT = '0.1';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function typeHumanLike(page, text, { min = 80, jitter = 120 } = {}) {
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

function extractProjectIdFromUrl(url) {
  const m = url.match(/projects\/([a-f0-9-]+)/);
  return m ? m[1] : null;
}

function pledgeNoRewardConfirmUrl(homeUrl, projectId) {
  return `${homeUrl}/backer/projects/${projectId}/pledge/no-reward/confirm?amount=${PLEDGE_AMOUNT}`;
}

async function goHomeSearchAndOpenCampaign(page, homeUrl, campaignTitle, step) {
  await step('Navigate to Oak Network home', async () => {
    await page.goto(homeUrl, { waitUntil: 'load', timeout: 60_000 });
    await sleep(3000);
  });

  await step(`Search for campaign "${campaignTitle}"`, async () => {
    const searchInput = page.locator('input[name="searchString"]');
    await searchInput.waitFor({ state: 'visible', timeout: 15_000 });
    await searchInput.click({ clickCount: 3 });
    await sleep(300);
    await page.keyboard.press('Backspace');
    await sleep(500);
    await typeHumanLike(page, campaignTitle);
    await sleep(3000);
  });

  await step('Click on the campaign card', async () => {
    const campaignCard = page.locator('a').filter({ hasText: campaignTitle }).first();
    await campaignCard.waitFor({ state: 'visible', timeout: 20_000 });
    await campaignCard.click();
    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await sleep(3000);
  });
}

async function runPledgeFromCampaignDetail(page, context, step) {
  await step('Click "Back this Project" button', async () => {
    const backBtn = page.getByRole('button', { name: /back this project/i });
    await backBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await backBtn.scrollIntoViewIfNeeded();
    await backBtn.click();
    await sleep(3000);
  });

  await step('Scroll pledge page to bottom', async () => {
    await page.locator('body').click();
    await sleep(500);
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('PageDown');
      await sleep(800);
      const atBottom = await page.evaluate(
        () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 10
      );
      if (atBottom) break;
    }
    await sleep(2000);
  });

  await step(`Enter pledge amount (${PLEDGE_AMOUNT})`, async () => {
    const pledgeInput = page.locator('.css-137t7tx input.chakra-input[placeholder="0"]');
    await pledgeInput.waitFor({ state: 'visible', timeout: 30_000 });
    await pledgeInput.scrollIntoViewIfNeeded();
    await pledgeInput.click({ clickCount: 3 });
    await sleep(300);
    await page.keyboard.press('Backspace');
    await sleep(500);
    await typeHumanLike(page, PLEDGE_AMOUNT);
  });

  await step('Click "Pledge" button', async () => {
    const pledgeBtn = page.locator('button[type="submit"]').filter({ hasText: /^pledge$/i });
    await pledgeBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await pledgeBtn.scrollIntoViewIfNeeded();
    await pledgeBtn.click();
    await sleep(3000);
  });

  await runPledgeCheckoutFlow(page, context, step);
}

async function runPledgeCheckoutFlow(page, context, step) {
  await step('Click "Select payment method" dropdown', async () => {
    const paymentDropdown = page.getByText('Select payment method');
    await paymentDropdown.waitFor({ state: 'visible', timeout: 15_000 });
    await paymentDropdown.scrollIntoViewIfNeeded();
    await paymentDropdown.click();
    await sleep(2000);
  });

  await step('Pick "Crypto Wallet" payment method', async () => {
    const cryptoOption = page.getByText('Crypto Wallet');
    await cryptoOption.waitFor({ state: 'visible', timeout: 10_000 });
    await cryptoOption.click();
    await sleep(2000);
  });

  await step('Check acknowledgment checkbox', async () => {
    const checkbox = page.locator('svg[data-state="unchecked"]').first();
    await checkbox.waitFor({ state: 'visible', timeout: 15_000 });
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.click();
    await sleep(2000);
  });

  await step('Click "Confirm Pledge" button', async () => {
    const confirmPledgeBtn = page.locator('button[type="submit"]').filter({ hasText: /confirm pledge/i });
    await confirmPledgeBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await confirmPledgeBtn.scrollIntoViewIfNeeded();
    await confirmPledgeBtn.click();
    await sleep(3000);
  });

  await step('Unlock MetaMask if locked', async () => {
    const mmPage = await findMetaMaskPage(context);
    if (!mmPage) return;
    await mmPage.bringToFront();
    await sleep(2000);

    const passwordField = mmPage.locator('input[type="password"]');
    const isLocked = await passwordField.isVisible({ timeout: 5_000 }).catch(() => false);
    if (!isLocked) return;

    await passwordField.click();
    for (const char of MM_PASSWORD) {
      await mmPage.keyboard.type(char, { delay: 60 + Math.floor(Math.random() * 80) });
    }
    await sleep(500);
    const unlockBtn = mmPage.locator('button[data-testid="unlock-submit"]');
    await unlockBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await unlockBtn.click();
    await sleep(3000);
  });

  await step('Click MetaMask "Confirm" (first pledge signature)', async () => {
    const mmPage = await findMetaMaskPage(context);
    if (!mmPage) throw new Error('MetaMask popup not found for first pledge confirmation.');
    await mmPage.bringToFront();
    await sleep(2000);
    const confirmBtn1 = mmPage.locator('button[data-testid="confirm-footer-button"]');
    await confirmBtn1.waitFor({ state: 'visible', timeout: 15_000 });
    await confirmBtn1.click();
    await sleep(5000);
  });

  await step('Click MetaMask "Confirm" (second pledge signature)', async () => {
    const mmPage = await findMetaMaskPage(context);
    if (!mmPage) return;
    await mmPage.bringToFront();
    await sleep(2000);
    const confirmBtn2 = mmPage.locator('button[data-testid="confirm-footer-button"]');
    const visible = await confirmBtn2.isVisible({ timeout: 15_000 }).catch(() => false);
    if (!visible) return;
    await confirmBtn2.click();
    await sleep(5000);
  });

  await step('Wait for "Pledge Confirmed" modal', async () => {
    await page.bringToFront();
    await sleep(3000);
    const pledgeConfirmedModal = page.getByText('Pledge Confirmed');
    await pledgeConfirmedModal.waitFor({ state: 'visible', timeout: 30_000 });
  });
}

async function cryptoPledge(page, context, campaignTitle, opts = {}) {
  const step = resolveStep(opts);
  const homeUrl = opts.appHomeUrl;
  if (!homeUrl) {
    throw new Error('cryptoPledge: opts.appHomeUrl is required (pass the selected environment\'s app URL).');
  }

  await goHomeSearchAndOpenCampaign(page, homeUrl, campaignTitle, step);
  let projectId = extractProjectIdFromUrl(page.url());

  await step('Complete pledge flow (with retries on transient failures)', async () => {
    let lastError;
    let resumeFromConfirmUrlOnly = false;

    for (let attempt = 1; attempt <= MAX_PLEDGE_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        console.log(`Pledge retry ${attempt}/${MAX_PLEDGE_ATTEMPTS}…`);
        if (projectId) {
          await page.goto(pledgeNoRewardConfirmUrl(homeUrl, projectId), { waitUntil: 'load', timeout: 60_000 });
          await sleep(3000);
          resumeFromConfirmUrlOnly = true;
        } else {
          await goHomeSearchAndOpenCampaign(page, homeUrl, campaignTitle, step);
          projectId = extractProjectIdFromUrl(page.url());
          resumeFromConfirmUrlOnly = false;
        }
      }
      try {
        if (resumeFromConfirmUrlOnly) {
          await runPledgeCheckoutFlow(page, context, step);
        } else {
          await runPledgeFromCampaignDetail(page, context, step);
        }
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        if (attempt === MAX_PLEDGE_ATTEMPTS) {
          throw lastError;
        }
      }
    }
  });

  await step('Click "Done" on pledge confirmation', async () => {
    const doneBtn = page.getByRole('button', { name: /^done$/i });
    await doneBtn.waitFor({ state: 'visible', timeout: 10_000 });
    const urlBeforeDone = page.url();
    const projectIdMatch = urlBeforeDone.match(/projects\/([a-f0-9-]+)/);

    await doneBtn.click();
    await page.waitForURL(/\/backer\/projects\/[a-f0-9-]+$/, { timeout: 5_000 }).catch(() => {});
    await sleep(3000);

    const urlAfterDone = page.url();
    if (urlAfterDone.includes('/confirm') || urlAfterDone.includes('/pledge')) {
      if (projectIdMatch) {
        await page.goto(`${homeUrl}/backer/projects/${projectIdMatch[1]}`, {
          waitUntil: 'load',
          timeout: 60_000,
        });
        await sleep(5000);
      }
    } else {
      await sleep(3000);
    }
  });

  await step(`Verify raised amount equals pledged amount ($${PLEDGE_AMOUNT})`, async () => {
    const raisedText = await page
      .locator('.chakra-stack')
      .filter({ hasText: /raised/i })
      .locator('p')
      .first()
      .textContent()
      .catch(() => null);
    if (!raisedText) {
      throw new Error('Could not read raised amount from campaign page.');
    }
    const raisedAmount = raisedText.replace('$', '').trim();
    if (raisedAmount !== PLEDGE_AMOUNT) {
      throw new Error(`Raised amount $${raisedAmount} does not match pledged amount $${PLEDGE_AMOUNT}.`);
    }
  });
}

module.exports = { cryptoPledge };
