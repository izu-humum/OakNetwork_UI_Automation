/**
 * Admin panel automation.
 * Called from run_automation.js after campaign creation.
 *
 * Usage:
 *   const { runAdmin } = require('./admin');
 *   await runAdmin(page, context);
 */

const { ADMIN_EMAIL, ADMIN_PASSWORD } = require('./admin_credentials');

const ADMIN_URL = 'https://ccprotocol-minipay-admin-git-saclient-dev-crowdsplit.vercel.app/admin/login';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function announceClick(buttonLabel) {
  await sleep(2000);
  console.log(`Clicking "${buttonLabel}" button…`);
}

async function runAdmin(page, context, campaignTitle) {
  console.log('\n--- Admin Panel ---\n');

  // Open admin login page in a new tab
  console.log(`Opening admin panel in a new tab: ${ADMIN_URL}`);
  const adminPage = await context.newPage();
  await adminPage.goto(ADMIN_URL, { waitUntil: 'load', timeout: 60_000 });
  await adminPage.bringToFront();
  await sleep(3000);
  console.log(`On page: ${adminPage.url()}`);
  page = adminPage;

  // Check if already logged in (redirected to /admin/projects)
  const alreadyLoggedIn = adminPage.url().includes('/admin/projects');

  if (alreadyLoggedIn) {
    console.log('Already logged in to admin panel — skipping login.');
  } else {
    console.log('Admin login page loaded.');

    // Step 1: Enter admin email
    const emailInput = page.locator('input[name="email"]');
    await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
    await emailInput.click();
    await sleep(1000);
    console.log('Typing admin email…');
    const adminEmail = ADMIN_EMAIL;
    for (const char of adminEmail) {
      await page.keyboard.type(char, { delay: 60 + Math.floor(Math.random() * 80) });
    }
    console.log('Admin email entered.');

    // Step 2: Enter admin password
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.waitFor({ state: 'visible', timeout: 15_000 });
    await passwordInput.click();
    await sleep(1000);
    console.log('Typing admin password…');
    const adminPassword = ADMIN_PASSWORD;
    for (const char of adminPassword) {
      await page.keyboard.type(char, { delay: 60 + Math.floor(Math.random() * 80) });
    }
    console.log('Admin password entered.');

    // Step 3: Click "Login" button
    const loginBtn = page.locator('button[type="submit"]').filter({ hasText: /login/i });
    await loginBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await announceClick('Login');
    await loginBtn.click();
    console.log('Clicked "Login" button.');

    await page.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
    await sleep(3000);
    console.log(`On page: ${page.url()}`);
    console.log('Admin login complete.');
  }

  // Step 4: Verify the campaign exists in the admin table
  if (campaignTitle) {
    console.log(`\nSearching for campaign: "${campaignTitle}"…`);
    await sleep(3000);

    const campaignRow = page.locator('tr').filter({ hasText: campaignTitle });
    const found = await campaignRow.first().isVisible({ timeout: 15_000 }).catch(() => false);

    if (found) {
      console.log(`Campaign "${campaignTitle}" found in admin panel!`);

      // Step 5: Click the "Approve Campaign" icon in the same row
      const approveIcon = campaignRow.first().getByRole('img', { name: 'Approve Campaign' });
      await approveIcon.waitFor({ state: 'visible', timeout: 10_000 });
      await announceClick('Approve Campaign');
      await approveIcon.click();
      console.log('Clicked "Approve Campaign" icon.');
      await sleep(3000);

      // Step 6: Click "APPROVE" in the confirmation modal
      const approveModal = page.getByText('Approve Project');
      await approveModal.waitFor({ state: 'visible', timeout: 15_000 });
      console.log('"Approve Project" modal appeared.');

      const approveBtn = page.getByRole('button', { name: /^approve$/i });
      await approveBtn.waitFor({ state: 'visible', timeout: 10_000 });
      await announceClick('APPROVE');
      await approveBtn.click();
      console.log('Clicked "APPROVE" button.');
      await sleep(3000);

      // Step 7: First MetaMask confirm popup
      console.log('Waiting for MetaMask confirmation popup…');
      let mmPage = await findMetaMaskPage(context);
      if (mmPage) {
        await mmPage.bringToFront();
        await sleep(2000);
        const confirmBtn1 = mmPage.locator('button[data-testid="confirm-footer-button"]');
        await confirmBtn1.waitFor({ state: 'visible', timeout: 15_000 });
        await announceClick('Confirm (MetaMask)');
        await confirmBtn1.click();
        console.log('Clicked first MetaMask "Confirm" button.');
        await sleep(5000);
      } else {
        console.log('MetaMask popup not found for first confirmation.');
      }

      // Step 8: Second MetaMask confirm popup
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
        await sleep(3000);
      } else {
        console.log('MetaMask popup not found for second confirmation.');
      }

      // Bring admin page back to front and check for PRE_LAUNCH status
      await page.bringToFront();
      await sleep(3000);

      // Poll for PRE_LAUNCH status (no reload — it updates on the page)
      const preLaunchCell = page.locator('td').filter({ hasText: /PRE_LAUNCH/i });
      let isPreLaunch = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        isPreLaunch = await preLaunchCell.first().isVisible({ timeout: 3_000 }).catch(() => false);
        if (isPreLaunch) break;
        await sleep(2000);
      }

      if (isPreLaunch) {
        console.log(`Campaign "${campaignTitle}" status: PRE_LAUNCH — approved successfully!`);
      } else {
        console.log('Campaign approved but PRE_LAUNCH status not yet visible.');
      }

      // Switch back to the campaign tab (the Oak Network page)
      const allPages = context.pages();
      const campaignTab = allPages.find(
        (p) => p.url().includes('app-dev.oaknetwork.org') || p.url().includes('oaknetwork')
      );
      if (campaignTab) {
        await campaignTab.bringToFront();
        await sleep(2000);
        console.log(`Switched back to campaign tab: ${campaignTab.url()}`);

        // Hard refresh the campaign page
        console.log('Hard refreshing campaign page…');
        await campaignTab.reload({ waitUntil: 'load', timeout: 60_000 });
        await sleep(5000);
        console.log(`On page: ${campaignTab.url()}`);

        // Wait for "Campaign Launching" modal
        const launchingModal = campaignTab.getByText('Campaign Launching');
        const launchingVisible = await launchingModal.isVisible({ timeout: 15_000 }).catch(() => false);

        if (launchingVisible) {
          console.log('"Campaign Launching" modal appeared. Waiting for timer to complete…');

          // Poll the countdown timer and display it in the terminal
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
          console.log('Timer complete!');
          console.log('"Your Campaign is Live!" modal appeared!');
          await sleep(2000);

          // Grant clipboard permission so the browser doesn't show a popup
          const cdpSession = await campaignTab.context().newCDPSession(campaignTab);
          await cdpSession.send('Browser.grantPermissions', {
            origin: campaignTab.url(),
            permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
          }).catch(() => {});

          // Click "Share Campaign" button
          const shareBtn = campaignTab.getByRole('button', { name: /share campaign/i });
          await shareBtn.waitFor({ state: 'visible', timeout: 10_000 });
          await announceClick('Share Campaign');
          await shareBtn.click();
          console.log('Clicked "Share Campaign" button.');
          await sleep(2000);

          // Read clipboard to get the campaign URL
          const clipboardUrl = await campaignTab.evaluate(() => navigator.clipboard.readText()).catch(() => null);
          if (clipboardUrl) {
            console.log(`Campaign URL (copied to clipboard): ${clipboardUrl}`);
          } else {
            const fallbackUrl = campaignTab.url();
            const idMatch = fallbackUrl.match(/my-projects\/([a-f0-9-]+)/);
            const shareUrl = idMatch
              ? `https://app-dev.oaknetwork.org/my-projects/${idMatch[1]}`
              : fallbackUrl;
            console.log(`Campaign share URL: ${shareUrl}`);
          }
          await sleep(2000);

          // Click "View Campaign" button
          const viewBtn = campaignTab.getByRole('button', { name: /view campaign/i });
          await viewBtn.waitFor({ state: 'visible', timeout: 10_000 });
          await announceClick('View Campaign');
          await viewBtn.click();
          console.log('Clicked "View Campaign" button.');

          await campaignTab.waitForLoadState('load', { timeout: 60_000 }).catch(() => {});
          await sleep(5000);

          // Extract project ID from the URL
          const campaignUrl = campaignTab.url();
          const projectIdMatch = campaignUrl.match(/my-projects\/([a-f0-9-]+)/);
          const projectId = projectIdMatch ? projectIdMatch[1] : 'unknown';
          console.log(`Campaign URL: ${campaignUrl}`);
          console.log(`Project ID: ${projectId}`);

          // Verify "Live" status badge
          const liveBadge = campaignTab.locator('.chakra-badge').filter({ hasText: /live/i });
          const isLive = await liveBadge.isVisible({ timeout: 15_000 }).catch(() => false);
          if (isLive) {
            console.log(`Campaign "${campaignTitle}" status: LIVE`);
          } else {
            console.log('Campaign page loaded but "Live" badge not found.');
          }
        } else {
          console.log('"Campaign Launching" modal not found — campaign may already be live.');
        }

        // Navigate back to the home page
        const homeUrl = 'https://app-dev.oaknetwork.org';
        console.log(`\nNavigating back to: ${homeUrl}`);
        await campaignTab.goto(homeUrl, { waitUntil: 'load', timeout: 60_000 });
        await sleep(3000);
        console.log(`On page: ${campaignTab.url()}`);
        console.log('\n--- Admin script complete ---\n');
      } else {
        console.log('Campaign tab not found — staying on admin page.');
      }

    } else {
      const noResults = page.locator('td').filter({ hasText: /no results/i });
      const isEmpty = await noResults.isVisible({ timeout: 5_000 }).catch(() => false);
      if (isEmpty) {
        console.log(`Campaign "${campaignTitle}" NOT found — table shows "No results."`);
      } else {
        console.log(`Campaign "${campaignTitle}" not immediately visible. It may be on another page or pending.`);
      }
    }
  } else {
    console.log('No campaign title provided — skipping campaign verification.');
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
        // page might be navigating, retry
      }
    }
    await sleep(1000);
  }
  return null;
}

module.exports = { runAdmin };
