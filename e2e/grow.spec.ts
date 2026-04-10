import { test, expect } from '@playwright/test';
import { freshUser } from './fixtures/test-data';
import { registerAndRedirect, navigateTo } from './helpers/auth.helper';

test.describe('Grow & Investments', () => {
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

  test('should navigate to grow page', async ({ page }) => {
    await navigateTo(page, 'grow');
    await page.waitForTimeout(1000);
    await expect(page.locator('#heading').last()).toBeVisible();
  });

  test('should open add grow project panel', async ({ page }) => {
    await navigateTo(page, 'grow');
    await page.locator('#addbtn').click();
    await expect(page.locator('#addSmile-Container')).toBeVisible({ timeout: 5_000 });
  });

  test('should add a basic grow project', async ({ page }) => {
    await navigateTo(page, 'grow');
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addSmile-Container', { state: 'visible' });

    const panel = page.locator('#addSmile-Container');
    await panel.locator('#title').fill('AAPL');
    await panel.locator('#sub').fill('Apple Inc');
    await panel.locator('#status').fill('Active');
    await panel.locator('#description').fill('Tech stock investment');
    await panel.locator('#strategy').fill('Long term hold');
    await panel.locator('#risks').fill('Market volatility');
    await panel.locator('#profit').fill('100');
    await panel.locator('#addbtn').click();

    await expect(page.locator('#addSmile-Container')).toBeHidden({ timeout: 10_000 });
  });

  test('should display grow project after adding', async ({ page }) => {
    await navigateTo(page, 'grow');
    const uniqueKey = `GRW${Date.now()}`;
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addSmile-Container', { state: 'visible' });

    const panel = page.locator('#addSmile-Container');
    await panel.locator('#title').fill(uniqueKey);
    await panel.locator('#sub').fill('Test Project');
    await panel.locator('#status').fill('Active');
    await panel.locator('#description').fill('Test description');
    await panel.locator('#strategy').fill('Test strategy');
    await panel.locator('#risks').fill('Test risks');
    await panel.locator('#profit').fill('50');
    await panel.locator('#addbtn').click();

    await expect(page.locator('#addSmile-Container')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText).toContain('Test Project');
  });

  test('should add a grow project with share enabled', async ({ page }) => {
    await navigateTo(page, 'grow');
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addSmile-Container', { state: 'visible' });

    const panel = page.locator('#addSmile-Container');
    await panel.locator('#title').fill('MSFT');
    await panel.locator('#sub').fill('Microsoft Corp');
    await panel.locator('#status').fill('Active');
    await panel.locator('#description').fill('Cloud growth');
    await panel.locator('#strategy').fill('Hold');
    await panel.locator('#risks').fill('Low');
    await panel.locator('#profit').fill('200');

    // Enable asset and share toggles (role="switch" toggle rows, not checkboxes)
    await panel.locator('[role="switch"][aria-checked="false"]').first().click();
    await panel.locator('[role="switch"][aria-checked="false"]').first().click();
    await page.waitForTimeout(500);

    // Fill share fields (quantity and price)
    await panel.locator('#quantity').fill('10');
    await panel.locator('#price').fill('350');

    await panel.locator('#addbtn').click();
    await expect(page.locator('#addSmile-Container')).toBeHidden({ timeout: 10_000 });
  });
});
