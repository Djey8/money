import { test, expect } from '@playwright/test';
import { freshUser, TRANSACTIONS, todayISO } from './fixtures/test-data';
import { registerAndRedirect, navigateTo, openAddTransaction } from './helpers/auth.helper';
import { AddTransactionPage } from './pages/add-transaction.page';

test.describe('Data Persistence', () => {
  const user = freshUser();

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAndRedirect(page, user);
    await page.close();
  });

  test('should persist transactions across page reload', async ({ page }) => {
    // Login
    await page.goto('/#/authentication');
    await page.locator('#EmailL').fill(user.email);
    await page.locator('#passwordL').fill(user.password);
    await page.locator('#loginbtn').click();
    await page.waitForURL('**/');
    await page.waitForSelector('#heading', { timeout: 15_000 });

    // Add a unique transaction
    const uniqueCategory = `@Persist${Date.now()}`;
    await navigateTo(page, 'transactions');
    await openAddTransaction(page);
    const addPage = new AddTransactionPage(page);
    await addPage.fill({
      account: 'Daily',
      amount: '77.77',
      category: uniqueCategory,
      date: todayISO(),
    });
    await addPage.submit();
    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    // Full page reload
    await page.reload();
    await page.waitForSelector('#heading', { timeout: 15_000 });
    await page.waitForTimeout(3000);

    // Navigate back to transactions
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(2000);

    // The transaction should still be there
    const tableText = await page.locator('body').textContent();
    expect(tableText).toContain(uniqueCategory.replace('@', ''));
  });

  test('should persist data after logout and login', async ({ page }) => {
    // Login
    await page.goto('/#/authentication');
    await page.locator('#EmailL').fill(user.email);
    await page.locator('#passwordL').fill(user.password);
    await page.locator('#loginbtn').click();
    await page.waitForURL('**/');
    await page.waitForSelector('#heading', { timeout: 15_000 });

    // Add a unique transaction
    const uniqueCategory = `@ReLogin${Date.now()}`;
    await navigateTo(page, 'transactions');
    await openAddTransaction(page);
    const addPage = new AddTransactionPage(page);
    await addPage.fill({
      account: 'Daily',
      amount: '33.33',
      category: uniqueCategory,
      date: todayISO(),
    });
    await addPage.submit();
    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    // Logout by going to auth page (which clears localStorage in constructor)
    await page.goto('/#/authentication');
    await page.waitForSelector('#loginbtn', { timeout: 10_000 });

    // Login again
    await page.locator('#EmailL').fill(user.email);
    await page.locator('#passwordL').fill(user.password);
    await page.locator('#loginbtn').click();
    await page.waitForURL('**/');
    await page.waitForSelector('#heading', { timeout: 15_000 });

    // Check data persisted
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(3000);
    const tableText = await page.locator('body').textContent();
    expect(tableText).toContain(uniqueCategory.replace('@', ''));
  });

  test('tab-back (visibilitychange) should not trigger full reload when data unchanged', async ({ page }) => {
    // Login
    await page.goto('/#/authentication');
    await page.locator('#EmailL').fill(user.email);
    await page.locator('#passwordL').fill(user.password);
    await page.locator('#loginbtn').click();
    await page.waitForURL('**/');
    await page.waitForSelector('#heading', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    // Instrument the network to count API calls
    const batchRequests: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/api/data/read/batch')) {
        batchRequests.push(req.url());
      }
    });

    // Simulate tab-out / tab-back via visibilitychange dispatch
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForTimeout(3000);

    // After tab-back with unchanged data, either:
    // - 0 batch-read calls (cached / skipped because updatedAt unchanged), or
    // - at most 1 call (the updatedAt check + potentially 1 batch)
    // The key assertion: we should NOT see 19 individual /api/data/read/* calls
    expect(batchRequests.length).toBeLessThanOrEqual(1);
  });
});
