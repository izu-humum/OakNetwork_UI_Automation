/**
 * Full end-to-end flow as Playwright tests.
 *
 * Four ordered tests share the same Chrome (CDP-attached) so each
 * appears in the terminal output as its own pass/fail row, while every
 * action inside each test is reported as a sub-step in the HTML report.
 *
 *   npm run test:flow                  # run this file only
 *   npx playwright show-report         # open the HTML report
 *
 * Prerequisite: this file uses your real Chrome profile via CDP so
 * MetaMask is available. Make sure Chrome is closed (or already running
 * with --remote-debugging-port=9222) before starting.
 */

import { test, expect } from '@playwright/test';
import type { Browser, BrowserContext, Page } from '@playwright/test';

// CommonJS helper modules.
const { launchBrowserAndGetPage, closeBrowser } = require('../../scripts/browser');
const { runLogin } = require('../../scripts/login');
const { createCampaign } = require('../../scripts/create_campaign');
const { runAdmin } = require('../../scripts/admin');
const { cryptoPledge } = require('../../scripts/crypto_pledge');

type Launched = {
  launchKind: 'cdp' | 'bundled' | 'persistent';
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

let launched: Launched;
let campaignTitle: string;

test.describe.configure({ mode: 'serial' });

test.describe('Oak Network — full flow', () => {
  test.beforeAll(async () => {
    launched = (await launchBrowserAndGetPage()) as Launched;

    if (launched.context) {
      for (const p of launched.context.pages()) {
        const u = p.url();
        if (
          p !== launched.page &&
          (u === 'about:blank' ||
            u === 'chrome://newtab/' ||
            u === 'chrome://new-tab-page/' ||
            u === 'chrome://welcome/')
        ) {
          await p.close().catch(() => {});
        }
      }
    }
  });

  test.afterAll(async () => {
    if (launched) {
      await closeBrowser(launched);
    }
  });

  test('1. Login via MetaMask', async () => {
    test.setTimeout(5 * 60_000);
    await runLogin(launched.page, launched.context, {
      step: test.step.bind(test),
    });
    await expect(
      launched.page.locator('.chakra-avatar__root').first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('2. Create a campaign', async () => {
    test.setTimeout(10 * 60_000);
    campaignTitle = await createCampaign(launched.page, launched.context, {
      step: test.step.bind(test),
    });
    expect(campaignTitle, 'campaign title returned by createCampaign').toBeTruthy();
  });

  test('3. Admin approves campaign and it goes live', async () => {
    test.setTimeout(15 * 60_000);
    await runAdmin(launched.page, launched.context, campaignTitle, {
      step: test.step.bind(test),
    });
  });

  test('4. Crypto pledge', async () => {
    test.setTimeout(10 * 60_000);
    await cryptoPledge(launched.page, launched.context, campaignTitle, {
      step: test.step.bind(test),
    });
  });
});
