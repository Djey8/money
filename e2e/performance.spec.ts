import { test, expect } from '@playwright/test';
import { freshUser } from './fixtures/test-data';
import { registerAndRedirect } from './helpers/auth.helper';

/**
 * Performance regression tests for the selfhosted mode.
 * Verifies that tiered loading and batch-read optimizations keep load times acceptable.
 *
 * These tests require a running selfhosted backend + frontend (ng serve --configuration e2e).
 */
test.describe('Performance: load times', () => {
  const user = freshUser();

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAndRedirect(page, user);
    await page.close();
  });

  test('app should be interactive within 10 seconds after login', async ({ page }) => {
    await page.goto('/#/authentication');

    // Start timing from login click
    await page.locator('#EmailL').fill(user.email);
    await page.locator('#passwordL').fill(user.password);

    const startTime = Date.now();
    await page.locator('#loginbtn').click();

    // Wait for the app shell (heading) — this marks "time to interactive"
    await page.waitForSelector('#heading', { timeout: 15_000 });
    const timeToInteractive = Date.now() - startTime;

    // Should be interactive within 10s (generous for CI; target is <3s on Pi)
    expect(timeToInteractive).toBeLessThan(10_000);
  });

  test('page reload should be interactive within 10 seconds', async ({ page }) => {
    // Login first
    await page.goto('/#/authentication');
    await page.locator('#EmailL').fill(user.email);
    await page.locator('#passwordL').fill(user.password);
    await page.locator('#loginbtn').click();
    await page.waitForSelector('#heading', { timeout: 15_000 });

    // Now measure reload time
    const startTime = Date.now();
    await page.reload();
    await page.waitForSelector('#heading', { timeout: 15_000 });
    const reloadTime = Date.now() - startTime;

    // Reload should be fast (cached data + single batch request)
    expect(reloadTime).toBeLessThan(10_000);
  });

  test('batch-read should use at most 2 HTTP requests for initial load', async ({ page }) => {
    // Login and count /api/data/read/batch requests
    await page.goto('/#/authentication');
    await page.locator('#EmailL').fill(user.email);
    await page.locator('#passwordL').fill(user.password);

    const batchRequests: string[] = [];
    const individualReads: string[] = [];
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/api/data/read/batch')) {
        batchRequests.push(url);
      } else if (url.match(/\/api\/data\/read\/[^b]/)) {
        individualReads.push(url);
      }
    });

    await page.locator('#loginbtn').click();
    await page.waitForSelector('#heading', { timeout: 15_000 });
    await page.waitForTimeout(5000); // Wait for Tier 2 to complete

    // Should use batch requests, not 19 individual reads
    // Tier 1 = 1 batch, Tier 2 = 1 batch → max 2
    expect(batchRequests.length).toBeLessThanOrEqual(2);
    // Most reads should go through batch; a few individual reads (e.g. updatedAt, auth) are acceptable
    expect(individualReads.length).toBeLessThanOrEqual(5);
  });
});
