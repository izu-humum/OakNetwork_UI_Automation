import { test, expect } from '@playwright/test';

test.describe('Oak Network — My Projects', () => {
  test('loads my-projects page', async ({ page }) => {
    await page.goto('/my-projects');
    await expect(page).toHaveTitle(/Oak Network/i);
  });
});
