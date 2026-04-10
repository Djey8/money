import { test, expect } from '@playwright/test';
import { freshUser } from './fixtures/test-data';
import { registerAndRedirect, navigateTo } from './helpers/auth.helper';

test.describe('Fire Emergencies', () => {
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

  test('should navigate to fire emergencies page', async ({ page }) => {
    await navigateTo(page, 'fireemergencies');
    await page.waitForTimeout(1000);
    await expect(page.locator('#heading').last()).toBeVisible();
  });

  test('should open add fire emergency panel', async ({ page }) => {
    await navigateTo(page, 'fireemergencies');
    await page.locator('#addbtn').click();
    await expect(page.locator('#addFire-Container')).toBeVisible({ timeout: 5_000 });
  });

  test('should add a fire emergency fund', async ({ page }) => {
    await navigateTo(page, 'fireemergencies');
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addFire-Container', { state: 'visible' });

    // Using simple form creates a default bucket with same title as fire emergency
    const panel = page.locator('#addFire-Container');
    await panel.locator('#title').fill('Car Repair Fund');
    await panel.locator('#target').fill('2000');
    await panel.locator('#amount').fill('300');
    await panel.locator('#addbtn').click();

    await expect(page.locator('#addFire-Container')).toBeHidden({ timeout: 10_000 });
  });

  test('should display the fire emergency after adding', async ({ page }) => {
    await navigateTo(page, 'fireemergencies');
    const uniqueTitle = `FireFund${Date.now()}`;
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addFire-Container', { state: 'visible' });

    const panel = page.locator('#addFire-Container');
    await panel.locator('#title').fill(uniqueTitle);
    await panel.locator('#target').fill('5000');
    await panel.locator('#amount').fill('1000');
    await panel.locator('#addbtn').click();

    await expect(page.locator('#addFire-Container')).toBeHidden({ timeout: 10_000 });
    // Re-navigate to fire emergencies to see the updated data after add-fire navigates
    await navigateTo(page, 'fireemergencies');
    await page.waitForTimeout(2000);

    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText).toContain(uniqueTitle);
  });

  test('should show progress percentage for fire emergency', async ({ page }) => {
    await navigateTo(page, 'fireemergencies');
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addFire-Container', { state: 'visible' });

    const panel = page.locator('#addFire-Container');
    await panel.locator('#title').fill('QuarterFund');
    await panel.locator('#target').fill('4000');
    await panel.locator('#amount').fill('1000');
    await panel.locator('#addbtn').click();

    await expect(page.locator('#addFire-Container')).toBeHidden({ timeout: 10_000 });
    // Re-navigate to fire emergencies to see the updated data after add-fire navigates
    await navigateTo(page, 'fireemergencies');
    await page.waitForTimeout(2000);

    // Should show 25% progress
    const allText = await page.locator('body').textContent() ?? '';
    expect(allText).toContain('25');
  });

  test('should add fire emergency with multiple buckets', async ({ page }) => {
    await navigateTo(page, 'fireemergencies');
    await page.locator('#addbtn').click();
    await page.waitForSelector('#addFire-Container', { state: 'visible' });

    const panel = page.locator('#addFire-Container');
    
    // Fill basic info
    await panel.locator('#title').fill('Home Repairs');
    await panel.locator('#sub').fill('Major home maintenance');
    
    // Expand buckets section
    const bucketsToggle = panel.locator('.section-toggle').filter({ hasText: /buckets/i }).first();
    await bucketsToggle.click();
    await page.waitForTimeout(300);
    
    // Add first bucket
    const addBucketBtn = panel.locator('button').filter({ hasText: /add bucket/i }).first();
    await addBucketBtn.click();
    await page.waitForTimeout(200);
    
    await panel.locator('input[placeholder*="bucket"]').first().fill('Roof');
    await panel.locator('input[placeholder*="target"]').first().fill('5000');
    const submitBucketBtn = panel.locator('button').filter({ hasText: /add bucket/i }).last();
    await submitBucketBtn.click();
    await page.waitForTimeout(200);
    
    // Add second bucket
    await addBucketBtn.click();
    await page.waitForTimeout(200);
    await panel.locator('input[placeholder*="bucket"]').first().fill('Plumbing');
    await panel.locator('input[placeholder*="target"]').first().fill('3000');
    await submitBucketBtn.click();
    
    // Submit the form
    await panel.locator('#addbtn').click();
    await expect(page.locator('#addFire-Container')).toBeHidden({ timeout: 10_000 });
    
    // Verify the fire emergency was created
    await navigateTo(page, 'fireemergencies');
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText).toContain('Home Repairs');
  });
});
