import { test, expect } from '@playwright/test';
import { freshUser, todayISO } from './fixtures/test-data';
import { registerAndRedirect, navigateTo, openAddTransaction } from './helpers/auth.helper';
import { AddTransactionPage } from './pages/add-transaction.page';

test.describe('Cashflow & Income Statement', () => {
  const user = freshUser();

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAndRedirect(page, user);

    // Seed income + expense transactions
    const transactions = [
      { account: 'Income', amount: '4000', category: '@Salary' },
      { account: 'Daily', amount: '150', category: '@Rent' },
      { account: 'Daily', amount: '60', category: '@Groceries' },
      { account: 'Splurge', amount: '40', category: '@Entertainment' },
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

  test('should display cashflow page with income and expenses', async ({ page }) => {
    await navigateTo(page, 'cashflow');
    await page.waitForTimeout(2000);

    // Cashflow section should display income and expense totals
    const bodyText = await page.locator('body').textContent() ?? '';
    // Should contain some monetary values (the salary we added)
    expect(bodyText).toEqual(expect.stringMatching(/4[.,]000|4000/));
  });

  test('should navigate to income statement page', async ({ page }) => {
    await navigateTo(page, 'income');
    await page.waitForTimeout(2000);
    await expect(page.locator('#heading').last()).toBeVisible();
  });

  test('should show revenue section on income statement', async ({ page }) => {
    await navigateTo(page, 'income');
    await page.waitForTimeout(2000);

    // Revenue section should be present
    const bodyText = await page.locator('body').textContent() ?? '';
    // We added a Salary income, so it should appear under revenue
    expect(bodyText).toContain('Salary');
  });

  test('should show expense categories on income statement', async ({ page }) => {
    await navigateTo(page, 'income');
    await page.waitForTimeout(2000);

    const bodyText = await page.locator('body').textContent() ?? '';
    // The expense categories we added should appear
    expect(bodyText).toContain('Rent');
    expect(bodyText).toContain('Groceries');
  });

  test('should display balance on cashflow page', async ({ page }) => {
    await navigateTo(page, 'cashflow');
    await page.waitForTimeout(2000);

    // The total/balance area should show a value
    const totalText = await page.locator('#total, #income, #expenses').first().textContent() ?? '';
    expect(totalText.trim()).not.toBe('');
  });
});
