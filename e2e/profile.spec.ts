import { test, expect } from '@playwright/test';
import { freshUser } from './fixtures/test-data';
import { registerAndRedirect, navigateTo } from './helpers/auth.helper';

test.describe('Profile & User Info', () => {
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

  test('should display correct username in profile', async ({ page }) => {
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForSelector('#profile-Container', { state: 'visible', timeout: 5_000 });

    const profileName = await page.locator('#profileName').textContent() ?? '';
    expect(profileName).toContain(user.username);
  });

  test('should display correct email in profile', async ({ page }) => {
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForSelector('#profile-Container', { state: 'visible', timeout: 5_000 });

    const profileEmail = await page.locator('#profileMail').textContent() ?? '';
    expect(profileEmail).toContain(user.email);
  });

  test('should close profile panel', async ({ page }) => {
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForSelector('#profile-Container', { state: 'visible', timeout: 5_000 });

    await page.locator('#profile-Container #closebtn').click();
    await expect(page.locator('#profile-Container')).toBeHidden({ timeout: 5_000 });
  });

  test('should navigate from profile to settings', async ({ page }) => {
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForSelector('#profile-Container', { state: 'visible', timeout: 5_000 });

    await page.locator('#settings-btn').click();
    await page.waitForSelector('#infoTransaction-Container', { state: 'visible', timeout: 5_000 });
  });

  test('should show sign out confirmation dialog', async ({ page }) => {
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForSelector('#profile-Container', { state: 'visible', timeout: 5_000 });

    // Click sign out button
    await page.locator('.profilebtn2').click();
    await page.waitForTimeout(500);

    // Confirmation dialog should appear
    await expect(page.locator('.confirmation-dialog')).toBeVisible();
  });

  test('should cancel sign out and stay logged in', async ({ page }) => {
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForSelector('#profile-Container', { state: 'visible', timeout: 5_000 });

    await page.locator('.profilebtn2').click();
    await page.waitForTimeout(500);

    // Click cancel
    await page.locator('.cancel-btn').click();
    await page.waitForTimeout(500);

    // Should still be on the app (not redirected to auth)
    await expect(page.locator('#heading').first()).toBeVisible();
  });
});
