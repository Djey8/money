import { test, expect } from '@playwright/test';
import { freshUser } from './fixtures/test-data';
import { registerAndRedirect, navigateTo } from './helpers/auth.helper';

test.describe('Smile Projects', () => {
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

  test('should navigate to smile projects page', async ({ page }) => {
    await navigateTo(page, 'smileprojects');
    await page.waitForTimeout(1000);
    await expect(page.locator('#heading').last()).toBeVisible();
  });

  test('should open add smile project panel', async ({ page }) => {
    await navigateTo(page, 'smileprojects');
    await page.locator('#addbtn').click();
    await expect(page.locator('#addSmile-Container')).toBeVisible({ timeout: 5_000 });
  });

  test('should add a smile project with title and target', async ({ page }) => {
    await navigateTo(page, 'smileprojects');
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addSmile-Container', { state: 'visible' });

    const panel = page.locator('#addSmile-Container');
    await panel.locator('#title').fill('Dream Vacation');
    await panel.locator('#target').fill('3000');
    await panel.locator('#amount').fill('500');
    await panel.locator('#addbtn').click();

    await expect(page.locator('#addSmile-Container')).toBeHidden({ timeout: 10_000 });
  });

  test('should display the smile project after adding', async ({ page }) => {
    // First add a project
    await navigateTo(page, 'smileprojects');
    const uniqueTitle = `SmileGoal${Date.now()}`;
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addSmile-Container', { state: 'visible' });

    const panel = page.locator('#addSmile-Container');
    await panel.locator('#title').fill(uniqueTitle);
    await panel.locator('#target').fill('1000');
    await panel.locator('#amount').fill('250');
    await panel.locator('#addbtn').click();

    await expect(page.locator('#addSmile-Container')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    // Project should appear on the page
    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText).toContain(uniqueTitle);
  });

  test('should show progress percentage for a smile project', async ({ page }) => {
    // Add a project with known amounts
    await navigateTo(page, 'smileprojects');
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addSmile-Container', { state: 'visible' });

    const panel = page.locator('#addSmile-Container');
    await panel.locator('#title').fill('HalfwayProject');
    await panel.locator('#target').fill('1000');
    await panel.locator('#amount').fill('500');
    await panel.locator('#addbtn').click();

    await expect(page.locator('#addSmile-Container')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    // Should show a progress percentage (50%)
    const progressLabels = page.locator('#progressLable');
    const count = await progressLabels.count();
    expect(count).toBeGreaterThan(0);
    // At least one should show 50%
    const allText = await page.locator('#smileProjectsTable').textContent() ?? '';
    expect(allText).toContain('50');
  });
});
