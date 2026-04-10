import { test, expect } from '@playwright/test';
import { freshUser, SUBSCRIPTION, todayISO } from './fixtures/test-data';
import { registerAndRedirect, navigateTo } from './helpers/auth.helper';

test.describe('Subscription Management', () => {
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

  test('should navigate to subscription page', async ({ page }) => {
    await navigateTo(page, 'subscription');
    await expect(page.locator('#heading').last()).toBeVisible();
  });

  test('should open add subscription panel', async ({ page }) => {
    await navigateTo(page, 'subscription');
    await page.locator('#addbtn').click();
    await expect(page.locator('#addTransaction-Container')).toBeVisible({ timeout: 5_000 });
  });

  test('should add a subscription', async ({ page }) => {
    await navigateTo(page, 'subscription');
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addTransaction-Container', { state: 'visible' });

    const panel = page.locator('#addTransaction-Container');
    await panel.locator('#name').fill(SUBSCRIPTION.name);
    await panel.locator('#account').selectOption(SUBSCRIPTION.account);
    await panel.locator('#amount').fill(SUBSCRIPTION.amount);
    // There are two #date inputs (start + end), use nth
    await panel.locator('input#date').first().fill(todayISO());
    await panel.locator('#category').fill(SUBSCRIPTION.category);
    await panel.locator('#comment').fill(SUBSCRIPTION.comment);
    await panel.locator('button#addbtn').click();

    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
  });

  test('should display subscription in the list after adding', async ({ page }) => {
    const uniqueName = `Sub_${Date.now()}`;
    await navigateTo(page, 'subscription');
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addTransaction-Container', { state: 'visible' });

    const panel = page.locator('#addTransaction-Container');
    await panel.locator('#name').fill(uniqueName);
    await panel.locator('#account').selectOption('Daily');
    await panel.locator('#amount').fill('9.99');
    await panel.locator('input#date').first().fill(todayISO());
    await panel.locator('#category').fill('@Streaming');
    await panel.locator('button#addbtn').click();

    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    // The subscription should appear on the page
    const pageText = await page.textContent('body');
    expect(pageText).toContain(uniqueName);
  });
});
