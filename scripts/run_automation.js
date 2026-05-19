/**
 * Standalone orchestrator — runs the full flow end-to-end with the
 * default console step runner (logs every action).
 *
 * For pass/fail per-step reporting, prefer running the Playwright tests:
 *
 *     npm test                                 # all tests
 *     npx playwright test tests/full_flow.spec.ts   # full flow only
 *     npx playwright show-report               # HTML report with per-step results
 */

const { execSync } = require('child_process');
const { launchBrowserAndGetPage, closeBrowser, CDP_PORT } = require('./browser');
const { runLogin } = require('./login');
const { createCampaign } = require('./create_campaign');
const { runAdmin } = require('./admin');
const { cryptoPledge } = require('./crypto_pledge');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  const { launchKind, browser, context, page } = await launchBrowserAndGetPage();

  async function closeBlankTabs() {
    if (!context) return;
    for (const p of context.pages()) {
      const u = p.url();
      if (
        p !== page &&
        (u === 'about:blank' ||
          u === 'chrome://newtab/' ||
          u === 'chrome://new-tab-page/' ||
          u === 'chrome://welcome/')
      ) {
        await p.close().catch(() => {});
      }
    }
  }

  try {
    await closeBlankTabs();

    await runLogin(page, context);

    await closeBlankTabs();
    await sleep(2000);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('PageDown');
      await sleep(1000);
    }

    const campaignTitle = await createCampaign(page, context);
    await runAdmin(page, context, campaignTitle);
    await cryptoPledge(page, context, campaignTitle);

    console.log('\nPress Enter in this terminal to close the browser…');
    process.stdin.setEncoding('utf8');
    await new Promise((resolve) => process.stdin.once('data', resolve));
  } finally {
    console.log('Closing browser…');
    await closeBrowser({ launchKind, browser, context });
    try {
      execSync(`lsof -ti TCP:${CDP_PORT} | xargs kill -9 2>/dev/null`, { stdio: 'ignore' });
    } catch {
      // ok
    }
    console.log('Browser closed.');
    process.exit(0);
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
