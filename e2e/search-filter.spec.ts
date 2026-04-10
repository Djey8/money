import { test, expect } from '@playwright/test';
import { freshUser, todayISO } from './fixtures/test-data';
import { registerAndRedirect, navigateTo, openAddTransaction } from './helpers/auth.helper';
import { AddTransactionPage } from './pages/add-transaction.page';

test.describe('Transaction Search & Filtering', () => {
  const user = freshUser();

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAndRedirect(page, user);

    // Seed several transactions with distinct categories
    const transactions = [
      { account: 'Daily', amount: '10', category: '@AlphaFood' },
      { account: 'Daily', amount: '200', category: '@BetaElectronics' },
      { account: 'Splurge', amount: '55', category: '@GammaShopping' },
      { account: 'Daily', amount: '5', category: '@AlphaSnack' },
    ];

    for (const tx of transactions) {
      await navigateTo(page, 'transactions');
      await openAddTransaction(page);
      const addPage = new AddTransactionPage(page);
      await addPage.fill({ ...tx, date: todayISO() });
      await addPage.submit();
      await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
      await page.waitForTimeout(1000);
    }

    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/#/authentication');
    await page.locator('#EmailL').fill(user.email);
    await page.locator('#passwordL').fill(user.password);
    await page.locator('#loginbtn').click();
    await page.waitForURL('**/');
    await page.waitForSelector('#heading', { timeout: 15_000 });
  });

  test('should filter transactions by search text', async ({ page }) => {
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(2000);

    // Type in the search input
    await page.locator('.search-input').fill('Alpha');
    // Trigger search by pressing Enter or waiting for input event
    await page.locator('.search-input').press('Enter');
    await page.waitForTimeout(1500);

    const tableText = await page.locator('table.account').textContent() ?? '';
    expect(tableText).toContain('AlphaFood');
    expect(tableText).toContain('AlphaSnack');
    // Gamma should be filtered out
    expect(tableText).not.toContain('GammaShopping');
  });

  test('should clear search and show all transactions', async ({ page }) => {
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(2000);

    // Search for something specific first
    await page.locator('.search-input').fill('Beta');
    await page.locator('.search-input').press('Enter');
    await page.waitForTimeout(1500);

    let tableText = await page.locator('table.account').textContent() ?? '';
    expect(tableText).toContain('BetaElectronics');

    // Clear the search
    await page.locator('.clear-button').click();
    await page.waitForTimeout(1500);

    // All transactions should be visible again
    tableText = await page.locator('table.account').textContent() ?? '';
    expect(tableText).toContain('AlphaFood');
    expect(tableText).toContain('GammaShopping');
  });

  test('should filter by date range in advanced filter', async ({ page }) => {
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(2000);

    // Set end date filter to today (all transactions should still appear)
    const today = todayISO();
    await page.locator('#quickEndDate').fill(today);
    await page.locator('.filter-btn-primary').first().click();
    await page.waitForTimeout(1500);

    const tableText = await page.locator('table.account').textContent() ?? '';
    // All transactions from today should still show
    expect(tableText).toContain('AlphaFood');
  });

  test('should filter out results with a past date range', async ({ page }) => {
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(2000);

    // Set date range to a past period (no transactions should match)
    await page.locator('#quickStartDate').fill('2020-01-01');
    await page.locator('#quickEndDate').fill('2020-01-31');
    await page.locator('.filter-btn-primary').first().click();
    await page.waitForTimeout(1500);

    // Check the transaction table specifically (body textContent includes hidden filter UI)
    const tableText = await page.locator('table.account').textContent() ?? '';
    expect(tableText).not.toContain('AlphaFood');
    expect(tableText).not.toContain('BetaElectronics');
  });

  test('should clear advanced filters', async ({ page }) => {
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(2000);

    // Apply a restrictive filter
    await page.locator('#quickStartDate').fill('2020-01-01');
    await page.locator('#quickEndDate').fill('2020-01-31');
    await page.locator('.filter-btn-primary').first().click();
    await page.waitForTimeout(1500);

    // Clear it
    await page.locator('.filter-btn-clear').first().click();
    await page.waitForTimeout(1500);

    // Transactions should reappear
    const tableText = await page.locator('table.account').textContent() ?? '';
    expect(tableText).toContain('AlphaFood');
  });
});
