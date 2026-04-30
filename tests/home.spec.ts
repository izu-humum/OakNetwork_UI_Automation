import { test, expect } from '@playwright/test';

test.describe('Oak Network — Home', () => {
  test('loads landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Oak Network/i);
  });

  test('document has visible content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
