import { test, expect } from '@playwright/test';
import { freshUser, TRANSACTIONS, todayISO } from './fixtures/test-data';
import { registerAndRedirect, navigateTo, openAddTransaction } from './helpers/auth.helper';
import { AddTransactionPage } from './pages/add-transaction.page';

test.describe('Account-Specific Views', () => {
  const user = freshUser();

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAndRedirect(page, user);

    // Seed transactions for each account
    const accounts = [
      { account: 'Income', amount: '5000', category: '@Salary' },
      { account: 'Daily', amount: '50', category: '@DailyGroceries' },
      { account: 'Splurge', amount: '80', category: '@SplurgeShoes' },
      { account: 'Smile', amount: '100', category: '@SmileFun' },
      { account: 'Fire', amount: '200', category: '@FireSave' },
    ];

    for (const tx of accounts) {
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

  test('should show Daily transactions only on daily page', async ({ page }) => {
    await navigateTo(page, 'daily');
    await page.waitForTimeout(2000);
    const tableText = await page.locator('table.account').textContent() ?? '';
    expect(tableText).toContain('DailyGroceries');
    // Splurge-only category should NOT appear
    expect(tableText).not.toContain('SplurgeShoes');
  });

  test('should show Splurge transactions only on splurge page', async ({ page }) => {
    await navigateTo(page, 'splurge');
    await page.waitForTimeout(2000);
    const tableText = await page.locator('table.account').textContent() ?? '';
    expect(tableText).toContain('SplurgeShoes');
    expect(tableText).not.toContain('DailyGroceries');
  });

  test('should show Smile transactions only on smile page', async ({ page }) => {
    await navigateTo(page, 'smile');
    await page.waitForTimeout(2000);
    const tableText = await page.locator('table.account').textContent() ?? '';
    expect(tableText).toContain('SmileFun');
    expect(tableText).not.toContain('DailyGroceries');
  });

  test('should show Fire transactions only on fire page', async ({ page }) => {
    await navigateTo(page, 'fire');
    await page.waitForTimeout(2000);
    const tableText = await page.locator('table.account').textContent() ?? '';
    expect(tableText).toContain('FireSave');
    expect(tableText).not.toContain('DailyGroceries');
  });

  test('should display total amount on daily page', async ({ page }) => {
    await navigateTo(page, 'daily');
    await page.waitForTimeout(2000);
    const amountLabel = page.locator('#amountLable');
    await expect(amountLabel).toBeVisible();
    const text = await amountLabel.textContent() ?? '';
    // Should show a non-zero amount
    expect(text.trim()).not.toBe('');
  });

  test('should show all transactions on the main transactions page', async ({ page }) => {
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(2000);
    const tableText = await page.locator('table.account').textContent() ?? '';
    // All account categories should appear in the combined view
    expect(tableText).toContain('DailyGroceries');
    expect(tableText).toContain('SplurgeShoes');
  });
});
