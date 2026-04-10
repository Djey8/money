import { test, expect } from '@playwright/test';
import { freshUser, todayISO } from './fixtures/test-data';
import { registerAndRedirect, navigateTo, openAddTransaction } from './helpers/auth.helper';
import { AddTransactionPage } from './pages/add-transaction.page';

test.describe('Balance Sheet', () => {
  const user = freshUser();

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAndRedirect(page, user);

    // Seed some income so the balance sheet has data
    await navigateTo(page, 'transactions');
    await openAddTransaction(page);
    const addPage = new AddTransactionPage(page);
    await addPage.fill({
      account: 'Income',
      amount: '5000',
      category: '@Salary',
      date: todayISO(),
    });
    await addPage.submit();
    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });

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

  test('should navigate to balance sheet page', async ({ page }) => {
    await navigateTo(page, 'balance');
    await page.waitForTimeout(1000);
    await expect(page.locator('#heading').last()).toBeVisible();
  });

  test('should display assets section', async ({ page }) => {
    await navigateTo(page, 'balance');
    await page.waitForTimeout(2000);

    // Assets box should be present
    await expect(page.locator('#assetsBox')).toBeVisible();
  });

  test('should display liabilities section', async ({ page }) => {
    await navigateTo(page, 'balance');
    await page.waitForTimeout(2000);

    // Liabilities box should be present
    await expect(page.locator('#liabilitiesBox')).toBeVisible();
  });

  test('should show balance value', async ({ page }) => {
    await navigateTo(page, 'balance');
    await page.waitForTimeout(2000);

    // Balance box should show a value
    const balanceBox = page.locator('.balanceBox').first();
    await expect(balanceBox).toBeVisible();
    const text = await balanceBox.textContent() ?? '';
    // Should contain some numeric content
    expect(text.trim()).not.toBe('');
  });

  test('should add an asset from balance sheet', async ({ page }) => {
    await navigateTo(page, 'balance');
    await page.waitForTimeout(1000);

    // Click the add button — opens a Choose dialog first
    await page.locator('#addbtn').first().click();
    // Multiple Choose dialogs exist; target the one that becomes visible
    const visibleMenu = page.locator('#menuNavBar-Container:not([hidden])');
    await expect(visibleMenu).toBeVisible({ timeout: 5_000 });
    // Select "Asset" from the Choose dialog
    await visibleMenu.locator('.menubtn').first().click();
    await page.waitForSelector('#addFire-Container', { state: 'visible', timeout: 5_000 });

    const panel = page.locator('#addFire-Container');
    await panel.locator('#title').fill('Emergency Cash');
    await panel.locator('#amount').fill('2000');
    await panel.locator('#addbtn').click();

    await expect(page.locator('#addFire-Container')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    // The asset should appear on the page
    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText).toContain('Emergency Cash');
  });

  test('should display cashflow table on balance sheet', async ({ page }) => {
    await navigateTo(page, 'balance');
    await page.waitForTimeout(2000);

    // Cashflow table should exist showing account balances
    const cashflowTable = page.locator('#cashflowTable');
    await expect(cashflowTable).toBeVisible();
  });
});
