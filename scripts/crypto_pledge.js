/**
 * Crypto Pledge automation.
 * Called from run_automation.js after admin approval and campaign goes live.
 *
 * Usage:
 *   const { cryptoPledge } = require('./crypto_pledge');
 *   await cryptoPledge(page, context, campaignTitle);
 */

const { MM_PASSWORD } = require('./metamask_password');

const HOME_URL = 'https://app-dev.oaknetwork.org';
const MAX_PLEDGE_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function announceClick(buttonLabel) {
  await sleep(2000);
  console.log(`Clicking "${buttonLabel}" button…`);
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
        // page might be navigating, retry
      }
    }
    await sleep(1000);
  }
  return null;
}

async function goHomeSearchAndOpenCampaign(page, campaignTitle) {
  console.log(`Navigating to ${HOME_URL}…`);
  await page.goto(HOME_URL, { waitUntil: 'load', timeout: 60_000 });
  await sleep(3000);

  const searchInput = page.locator('input[name="searchString"]');
  await searchInput.waitFor({ state: 'visible', timeout: 15_000 });
  await searchInput.click({ clickCount: 3 });
  await sleep(500);
  await page.keyboard.press('Backspace');
  await sleep(500);
  console.log(`Searching for campaign: "${campaignTitle}"…`);
  for (const char of campaignTitle) {
    await page.keyboard.type(char, { delay: 80 + Math.floor(Math.random() * 120) });
  }
  await sleep(3000);

  const campaignCard = page.locator('a').filter({ hasText: campaignTitle }).first();
  await campaignCard.waitFor({ state: 'visible', timeout: 20_000 });
  await announceClick(campaignTitle);
  await campaignCard.click();
  console.log(`Clicked on campaign: "${campaignTitle}".`);

  await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
  await sleep(3000);
  console.log(`On page: ${page.url()}`);
}

function pledgeNoRewardConfirmUrl(projectId) {
  return `${HOME_URL}/backer/projects/${projectId}/pledge/no-reward/confirm?amount=0.1`;
}

/**
 * Confirm page: backer fields → payment → checkbox → Confirm Pledge → MetaMask → "Pledge Confirmed".
 */
async function runPledgeCheckoutFlow(page, context) {
  const nameInput = page.locator('input[name="name"]');
  const phoneInput = page.locator('input[name="phoneNumber"]');
  const emailInput = page.locator('input[name="email"]');

  const nameVal = await nameInput.inputValue().catch(() => '');
  const phoneVal = await phoneInput.inputValue().catch(() => '');
  const emailVal = await emailInput.inputValue().catch(() => '');

  console.log(`Backer Name: ${nameVal || '(empty)'}`);
  console.log(`Backer Phone: ${phoneVal || '(empty)'}`);
  console.log(`Backer Email: ${emailVal || '(empty)'}`);

  const paymentDropdown = page.getByText('Select payment method');
  await paymentDropdown.waitFor({ state: 'visible', timeout: 15_000 });
  await paymentDropdown.scrollIntoViewIfNeeded();
  await announceClick('Select payment method');
  await paymentDropdown.click();
  await sleep(2000);

  const cryptoOption = page.getByText('Crypto Wallet');
  await cryptoOption.waitFor({ state: 'visible', timeout: 10_000 });
  await announceClick('Crypto Wallet');
  await cryptoOption.click();
  console.log('Selected "Crypto Wallet" as payment method.');
  await sleep(2000);

  const checkbox = page.locator('svg[data-state="unchecked"]').first();
  await checkbox.waitFor({ state: 'visible', timeout: 15_000 });
  await checkbox.scrollIntoViewIfNeeded();
  await announceClick('Acknowledgment checkbox');
  await checkbox.click();
  console.log('Checked acknowledgment checkbox.');
  await sleep(2000);

  const confirmPledgeBtn = page.locator('button[type="submit"]').filter({ hasText: /confirm pledge/i });
  await confirmPledgeBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await confirmPledgeBtn.scrollIntoViewIfNeeded();
  await announceClick('Confirm Pledge');
  await confirmPledgeBtn.click();
  console.log('Clicked "Confirm Pledge" button.');
  await sleep(3000);

  console.log('Waiting for MetaMask popup…');
  let mmPage = await findMetaMaskPage(context);
  if (mmPage) {
    await mmPage.bringToFront();
    await sleep(2000);

    const passwordField = mmPage.locator('input[type="password"]');
    const isLocked = await passwordField.isVisible({ timeout: 5_000 }).catch(() => false);

    if (isLocked) {
      console.log('MetaMask is locked. Entering password…');
      await passwordField.click();
      for (const char of MM_PASSWORD) {
        await mmPage.keyboard.type(char, { delay: 60 + Math.floor(Math.random() * 80) });
      }
      await sleep(500);

      const unlockBtn = mmPage.locator('button[data-testid="unlock-submit"]');
      await unlockBtn.waitFor({ state: 'visible', timeout: 10_000 });
      await announceClick('Unlock');
      await unlockBtn.click();
      console.log('Clicked "Unlock" button.');
      await sleep(3000);

      mmPage = await findMetaMaskPage(context);
      if (mmPage) {
        await mmPage.bringToFront();
        await sleep(2000);
      }
    }

    const confirmBtn1 = mmPage.locator('button[data-testid="confirm-footer-button"]');
    await confirmBtn1.waitFor({ state: 'visible', timeout: 15_000 });
    await announceClick('Confirm (MetaMask)');
    await confirmBtn1.click();
    console.log('Clicked first MetaMask "Confirm" button.');
    await sleep(5000);

    console.log('Waiting for second MetaMask confirmation popup…');
    mmPage = await findMetaMaskPage(context);
    if (mmPage) {
      await mmPage.bringToFront();
      await sleep(2000);
      const confirmBtn2 = mmPage.locator('button[data-testid="confirm-footer-button"]');
      await confirmBtn2.waitFor({ state: 'visible', timeout: 15_000 });
      await announceClick('Confirm (MetaMask)');
      await confirmBtn2.click();
      console.log('Clicked second MetaMask "Confirm" button.');
      await sleep(5000);
    } else {
      console.log('Second MetaMask popup not found.');
    }
  } else {
    console.log('MetaMask popup not found.');
  }

  await page.bringToFront();
  await sleep(3000);

  const pledgeConfirmedModal = page.getByText('Pledge Confirmed');
  await pledgeConfirmedModal.waitFor({ state: 'visible', timeout: 30_000 });
  console.log('"Pledge Confirmed" modal appeared!');
}

/**
 * Campaign backer page: Back this Project → amount → Pledge → then checkout flow.
 */
async function runPledgeFromCampaignDetail(page, context) {
  const backBtn = page.getByRole('button', { name: /back this project/i });
  await backBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await backBtn.scrollIntoViewIfNeeded();
  await announceClick('Back this Project');
  await backBtn.click();
  console.log('Clicked "Back this Project" button.');
  await sleep(3000);

  await page.locator('body').click();
  await sleep(500);
  console.log('Scrolling to bottom of page…');
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('PageDown');
    await sleep(800);
    const atBottom = await page.evaluate(() =>
      window.innerHeight + window.scrollY >= document.body.scrollHeight - 10
    );
    if (atBottom) break;
  }
  await sleep(2000);

  const pledgeInput = page.locator('.css-137t7tx input.chakra-input[placeholder="0"]');
  await pledgeInput.waitFor({ state: 'visible', timeout: 30_000 });
  await pledgeInput.scrollIntoViewIfNeeded();
  await pledgeInput.click({ clickCount: 3 });
  await sleep(500);
  await page.keyboard.press('Backspace');
  await sleep(1000);
  console.log('Entering pledge amount…');
  const pledgeAmount = '0.1';
  for (const char of pledgeAmount) {
    await page.keyboard.type(char, { delay: 80 + Math.floor(Math.random() * 100) });
  }
  console.log('Pledge amount entered: 0.1.');

  const pledgeBtn = page.locator('button[type="submit"]').filter({ hasText: /^pledge$/i });
  await pledgeBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await pledgeBtn.scrollIntoViewIfNeeded();
  await announceClick('Pledge');
  await pledgeBtn.click();
  console.log('Clicked "Pledge" button.');
  await sleep(3000);

  await runPledgeCheckoutFlow(page, context);
}

function extractProjectIdFromUrl(url) {
  const m = url.match(/projects\/([a-f0-9-]+)/);
  return m ? m[1] : null;
}

async function cryptoPledge(page, context, campaignTitle) {
  console.log('\n--- Crypto Pledge ---\n');

  await goHomeSearchAndOpenCampaign(page, campaignTitle);
  let projectId = extractProjectIdFromUrl(page.url());

  let lastError;
  let resumeFromConfirmUrlOnly = false;

  for (let attempt = 1; attempt <= MAX_PLEDGE_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      console.log(`\nPledge attempt ${attempt - 1} did not complete. Retrying (${attempt}/${MAX_PLEDGE_ATTEMPTS})…\n`);
      if (projectId) {
        const confirmUrl = pledgeNoRewardConfirmUrl(projectId);
        console.log(`Opening pledge confirm URL (no search): ${confirmUrl}`);
        await page.goto(confirmUrl, { waitUntil: 'load', timeout: 60_000 });
        await sleep(3000);
        resumeFromConfirmUrlOnly = true;
      } else {
        await goHomeSearchAndOpenCampaign(page, campaignTitle);
        projectId = extractProjectIdFromUrl(page.url());
        resumeFromConfirmUrlOnly = false;
      }
    }
    try {
      if (resumeFromConfirmUrlOnly) {
        await runPledgeCheckoutFlow(page, context);
      } else {
        await runPledgeFromCampaignDetail(page, context);
      }
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      console.log(`Pledge attempt ${attempt} failed: ${err.message}`);
      if (attempt === MAX_PLEDGE_ATTEMPTS) {
        throw lastError;
      }
    }
  }

  const doneBtn = page.getByRole('button', { name: /^done$/i });
  await doneBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await announceClick('Done');
  const urlBeforeDone = page.url();
  const projectIdMatch = urlBeforeDone.match(/projects\/([a-f0-9-]+)/);

  await doneBtn.click();
  console.log('Clicked "Done" button. Pledge complete!');

  await page.waitForURL(/\/backer\/projects\/[a-f0-9-]+$/, { timeout: 5_000 }).catch(() => {});
  await sleep(3000);

  const urlAfterDone = page.url();
  if (urlAfterDone.includes('/confirm') || urlAfterDone.includes('/pledge')) {
    if (projectIdMatch) {
      const campaignPageUrl = `${HOME_URL}/backer/projects/${projectIdMatch[1]}`;
      console.log('Done button did not redirect. Navigating manually…');
      await page.goto(campaignPageUrl, { waitUntil: 'load', timeout: 60_000 });
      await sleep(5000);
    }
  } else {
    console.log(`Redirected to: ${urlAfterDone}`);
    await sleep(3000);
  }

  const raisedText = await page.locator('.chakra-stack').filter({ hasText: /raised/i }).locator('p').first().textContent().catch(() => null);
  if (raisedText) {
    const raisedAmount = raisedText.replace('$', '').trim();
    const pledgedAmount = '0.1';
    if (raisedAmount === pledgedAmount) {
      console.log(`Raised amount: $${raisedAmount} — matches pledged amount ($${pledgedAmount}).`);
    } else {
      console.log(`Raised amount: $${raisedAmount} — does NOT match pledged amount ($${pledgedAmount}).`);
    }
  } else {
    console.log('Could not read raised amount from the page.');
  }
  console.log(`On page: ${page.url()}`);

  console.log('\n--- Crypto Pledge Complete ---\n');
}

module.exports = { cryptoPledge };
