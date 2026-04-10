import { test, expect } from '@playwright/test';
import { freshUser } from './fixtures/test-data';
import { registerAndRedirect, loginAndRedirect, navigateTo } from './helpers/auth.helper';

/**
 * Visual regression tests — screenshot comparison for key pages.
 * On first run, screenshots are saved as baselines in e2e/__screenshots__/.
 * Subsequent runs compare against the baseline and fail on visual diffs.
 *
 * Update baselines: npx playwright test visual-regression --update-snapshots
 */

// Visual regression requires baseline screenshots that are environment-specific
// (Linux CI vs Windows/Mac local). Run locally or with --update-snapshots.
test.describe('Visual Regression', () => {
  test.skip(!!process.env.CI, 'Visual regression skipped in CI — no baseline screenshots');
  const user = freshUser();

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAndRedirect(page, user);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginAndRedirect(page, user.email, user.password);
  });

  test('Home dashboard', async ({ page }) => {
    await page.waitForSelector('#heading', { timeout: 10_000 });
    // Wait for any animations/transitions to settle
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('home-dashboard.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('Budget plan view', async ({ page }) => {
    await navigateTo(page, 'budget');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('budget-plan.png', {
      maxDiffPixelRatio: 0.01,
    });
  });

  test('Balance sheet', async ({ page }) => {
    await navigateTo(page, 'balancesheet');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('balance-sheet.png', {
      maxDiffPixelRatio: 0.01,
    });
  });
});
