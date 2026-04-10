import { test, expect } from '@playwright/test';
import { freshUser, todayISO, currentMonth } from './fixtures/test-data';
import { registerAndRedirect, navigateTo } from './helpers/auth.helper';

test.describe('Budget Management', () => {
  const user = freshUser();

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAndRedirect(page, user);

    // Add a transaction so there are categories to budget
    await navigateTo(page, 'transactions');
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addTransaction-Container', { state: 'visible' });
    await page.locator('#addTransaction-Container #account').selectOption('Daily');
    await page.locator('#addTransaction-Container #amount').fill('100');
    await page.locator('#addTransaction-Container #date').fill(todayISO());
    await page.locator('#addTransaction-Container #category').fill('@Groceries');
    await page.locator('#addTransaction-Container button#addbtn').click();
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

  test('should navigate to budget plan page', async ({ page }) => {
    await navigateTo(page, 'plan');
    await expect(page.locator('#heading').last()).toBeVisible();
  });

  test('should open add budget panel from plan page', async ({ page }) => {
    await navigateTo(page, 'plan');
    await page.locator('#addbtn').click();
    // The add-budget panel uses #addTransaction-Container
    await expect(page.locator('#addTransaction-Container')).toBeVisible({ timeout: 5_000 });
  });

  test('should add a budget entry', async ({ page }) => {
    await navigateTo(page, 'plan');
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addTransaction-Container', { state: 'visible' });

    // Fill budget form
    const panel = page.locator('#addTransaction-Container');
    await panel.locator('#month').fill(currentMonth());
    await panel.locator('#category').fill('@Groceries');
    await panel.locator('#amount').fill('250');
    await panel.locator('button#addbtn').click();

    // Panel should close after successful add
    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
  });
});
