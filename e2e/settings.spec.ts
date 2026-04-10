import { test, expect } from '@playwright/test';
import { freshUser, TRANSACTIONS, todayISO } from './fixtures/test-data';
import { registerAndRedirect, navigateTo, openAddTransaction } from './helpers/auth.helper';
import { AddTransactionPage } from './pages/add-transaction.page';

test.describe('Settings', () => {
  const user = freshUser();

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAndRedirect(page, user);
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

  test('should open settings panel via profile', async ({ page }) => {
    await navigateTo(page, 'home');
    // Click the app-shell profile pic (force to bypass child component overlay)
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForTimeout(1000);
    // The profile or settings panel should be visible
    await expect(page.locator('#profile-Container')).toBeVisible();
  });

  test('should show selfhosted mode badge', async ({ page }) => {
    await navigateTo(page, 'home');
    // The mode badge should show selfhosted mode since we're using e2e config
    const modeBadge = page.locator('.mode-badge');
    // Check if mode badge exists (it's on the root app component)
    await page.goto('/');
    await page.waitForSelector('.mode-badge', { timeout: 10_000 });
    const badgeText = await modeBadge.textContent();
    expect(badgeText?.toLowerCase()).toContain('self');
  });

  test('should display username after registration', async ({ page }) => {
    // After login, the profile should show the username
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForTimeout(1000);
    const profileText = await page.locator('app-profile').textContent();
    expect(profileText).toContain(user.username);
  });

  test('should change currency in settings', async ({ page }) => {
    // Open profile → settings
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('#settings-btn').click();
    await page.waitForSelector('#infoTransaction-Container', { state: 'visible', timeout: 5_000 });

    // Click currency menu item
    await page.locator('.settings-menu-item').filter({ hasText: 'currency' }).click();
    await page.waitForTimeout(500);

    // Click the Dollar currency option
    await page.locator('.format-option').filter({ hasText: 'Dollar' }).click();
    await page.waitForTimeout(500);

    // Go back to settings main view
    await page.locator('#languagebtn').click();
    await page.waitForTimeout(500);

    // The currency display in settings should now show $
    const currencyValue = await page.locator('.profile-value').filter({ hasText: '$' }).textContent();
    expect(currencyValue).toContain('$');

    // Close settings
    await page.locator('#infoTransaction-Container #closebtn').click();
    await page.waitForTimeout(500);

    // Add a transaction and verify currency symbol appears
    await navigateTo(page, 'transactions');
    await openAddTransaction(page);
    const addPage = new AddTransactionPage(page);
    await addPage.fill({
      account: 'Daily',
      amount: '25',
      category: '@CurrTest',
      date: todayISO(),
    });
    await addPage.submit();
    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    // The table should display the $ symbol
    const tableText = await page.locator('table.account').textContent();
    expect(tableText).toContain('$');
  });

  test('should change date format in settings', async ({ page }) => {
    // Open profile → settings
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('#settings-btn').click();
    await page.waitForSelector('#infoTransaction-Container', { state: 'visible', timeout: 5_000 });

    // Click date format menu item
    await page.locator('.settings-menu-item').filter({ hasText: 'date format' }).click();
    await page.waitForTimeout(500);

    // Select yyyy-MM-dd format
    await page.locator('.format-option').filter({ hasText: 'yyyy-MM-dd' }).click();
    await page.waitForTimeout(500);

    // Go back to settings main
    await page.locator('#languagebtn').click();
    await page.waitForTimeout(500);

    // Close settings
    await page.locator('#infoTransaction-Container #closebtn').click();
    await page.waitForTimeout(500);

    // Navigate to transactions — dates should now be in yyyy-MM-dd format
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(2000);

    // The date column should contain dates in yyyy-MM-dd format (e.g. 2026-)
    const bodyText = await page.locator('body').textContent() ?? '';
    // Current year prefix should appear in the date column
    const yearPrefix = new Date().getFullYear().toString();
    expect(bodyText).toContain(yearPrefix + '-');
  });
});
