import { test, expect } from '@playwright/test';
import { freshUser, TRANSACTIONS, todayISO } from './fixtures/test-data';
import { registerAndRedirect, navigateTo, openAddTransaction } from './helpers/auth.helper';
import { AddTransactionPage } from './pages/add-transaction.page';

test.describe('Core Transaction Flow', () => {
  const user = freshUser();

  test.beforeAll(async ({ browser }) => {
    // Register the user once for all tests in this suite
    const page = await browser.newPage();
    await registerAndRedirect(page, user);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/#/authentication');
    const loginEmail = page.locator('#EmailL');
    const loginPassword = page.locator('#passwordL');
    const loginBtn = page.locator('#loginbtn');
    await loginEmail.fill(user.email);
    await loginPassword.fill(user.password);
    await loginBtn.click();
    await page.waitForURL('**/');
    await page.waitForSelector('#heading', { timeout: 15_000 });
  });

  test('should add an income transaction', async ({ page }) => {
    await navigateTo(page, 'transactions');
    await openAddTransaction(page);

    const addPage = new AddTransactionPage(page);
    await addPage.fill({
      account: TRANSACTIONS.income.account,
      amount: TRANSACTIONS.income.amount,
      category: TRANSACTIONS.income.category,
      comment: TRANSACTIONS.income.comment,
      date: todayISO(),
    });
    await addPage.submit();

    // Panel should close after successful add
    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
  });

  test('should add a daily expense transaction', async ({ page }) => {
    await navigateTo(page, 'daily');
    await openAddTransaction(page);

    const addPage = new AddTransactionPage(page);
    await addPage.fill({
      account: TRANSACTIONS.daily.account,
      amount: TRANSACTIONS.daily.amount,
      category: TRANSACTIONS.daily.category,
      comment: TRANSACTIONS.daily.comment,
      date: todayISO(),
    });
    await addPage.submit();

    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
  });

  test('should display transaction in the transactions list', async ({ page }) => {
    // First add a transaction
    await navigateTo(page, 'transactions');
    await openAddTransaction(page);

    const addPage = new AddTransactionPage(page);
    const uniqueCategory = `@TestCat${Date.now()}`;
    await addPage.fill({
      account: 'Daily',
      amount: '99.99',
      category: uniqueCategory,
      date: todayISO(),
    });
    await addPage.submit();
    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });

    // Wait for the table to show the transaction
    await page.waitForTimeout(2000);
    // The transactions table should contain the category
    const tableText = await page.locator('table, .mat-mdc-table, mat-table').textContent();
    expect(tableText).toContain(uniqueCategory.replace('@', ''));
  });

  test('should update home totals after adding income', async ({ page }) => {
    // Add income
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

    // Go to home and check balance
    await navigateTo(page, 'home');
    await page.waitForTimeout(2000);

    // Balance should show a positive number
    const balanceText = await page.locator('.total-amount [class*="grid-value"]').textContent() ?? '';
    // Should not be "0" (we just added 5000 income)
    expect(balanceText.trim()).not.toBe('0');
  });

  test('should edit a transaction via the info panel', async ({ page }) => {
    // Add a transaction to edit
    await navigateTo(page, 'transactions');
    await openAddTransaction(page);

    const addPage = new AddTransactionPage(page);
    const originalCategory = `@Edit${Date.now()}`;
    await addPage.fill({
      account: 'Daily',
      amount: '50',
      category: originalCategory,
      date: todayISO(),
    });
    await addPage.submit();
    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    // Click the first row to open the info panel
    await page.locator('table.account tr.mat-mdc-row').first().click();
    await page.waitForSelector('#infoTransaction-Container', { state: 'visible', timeout: 5_000 });

    // Click edit button
    await page.locator('#infoTransaction-Container #editbtn').click();

    // Update the amount
    const amountInput = page.locator('#infoTransaction-Container #amount');
    await amountInput.fill('75');

    // Click update
    await page.locator('#infoTransaction-Container #addbtn').click();

    // Info panel should close or return to view mode
    await page.waitForTimeout(2000);

    // Verify the updated amount is reflected. The table should show 75.
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('75');
  });

  test('should delete a transaction via the info panel', async ({ page }) => {
    // Add a unique transaction to delete
    await navigateTo(page, 'transactions');
    await openAddTransaction(page);

    const addPage = new AddTransactionPage(page);
    const deleteCategory = `@Del${Date.now()}`;
    await addPage.fill({
      account: 'Daily',
      amount: '11.11',
      category: deleteCategory,
      date: todayISO(),
    });
    await addPage.submit();
    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    // Verify it was added
    let bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain(deleteCategory.replace('@', ''));

    // Click the first row to open the info panel
    await page.locator('table.account tr.mat-mdc-row').first().click();
    await page.waitForSelector('#infoTransaction-Container', { state: 'visible', timeout: 5_000 });

    // Click edit to enter edit mode (delete is only available in edit mode)
    await page.locator('#infoTransaction-Container #editbtn').click();

    // Click delete — this opens a confirm dialog
    await page.locator('#infoTransaction-Container #deletebtn').click();
    // Confirm the deletion in the dialog
    await page.locator('.confirm-btn--delete').click();
    await page.waitForTimeout(2000);

    // Info panel should close
    await expect(page.locator('#infoTransaction-Container')).toBeHidden({ timeout: 5_000 });
  });
});
