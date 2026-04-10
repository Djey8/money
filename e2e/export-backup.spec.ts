import { test, expect } from '@playwright/test';
import { freshUser, todayISO } from './fixtures/test-data';
import { registerAndRedirect, navigateTo, openAddTransaction } from './helpers/auth.helper';
import { AddTransactionPage } from './pages/add-transaction.page';
import * as path from 'path';
import * as fs from 'fs';

test.describe('CSV Export & Data Backup', () => {
  const user = freshUser();

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await registerAndRedirect(page, user);

    // Seed a transaction so export has data
    await navigateTo(page, 'transactions');
    await openAddTransaction(page);
    const addPage = new AddTransactionPage(page);
    await addPage.fill({
      account: 'Daily',
      amount: '42',
      category: '@ExportTest',
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

  test('should trigger CSV statistics export from settings', async ({ page }) => {
    // Open profile → settings
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('#settings-btn').click();
    await page.waitForSelector('#infoTransaction-Container', { state: 'visible', timeout: 5_000 });

    // Click backup/export menu item
    await page.locator('.settings-menu-item').filter({ hasText: /backup|export/i }).click();
    await page.waitForTimeout(500);

    // Listen for download event when clicking CSV export
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await page.locator('.backup-option').filter({ hasText: /CSV|statistic/i }).click();

    const download = await downloadPromise;
    // Verify a file was downloaded
    expect(download.suggestedFilename()).toBeTruthy();

    // Save and verify it's not empty
    const filePath = path.join('test-results', download.suggestedFilename());
    await download.saveAs(filePath);
    const stat = fs.statSync(filePath);
    expect(stat.size).toBeGreaterThan(0);

    // Cleanup
    fs.unlinkSync(filePath);
  });

  test('should trigger JSON full backup from settings', async ({ page }) => {
    // Open profile → settings
    await page.locator('#profile-pic').first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('#settings-btn').click();
    await page.waitForSelector('#infoTransaction-Container', { state: 'visible', timeout: 5_000 });

    // Click backup/export menu
    await page.locator('.settings-menu-item').filter({ hasText: /backup|export/i }).click();
    await page.waitForTimeout(500);

    // Click JSON backup option
    const downloadPromise = page.waitForEvent('download', { timeout: 10_000 });
    await page.locator('.backup-option').filter({ hasText: /JSON|backup/i }).click();

    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    expect(filename).toBeTruthy();

    // Verify filename matches migration-data-YYYY-MM-DD.json
    expect(filename).toMatch(/^migration-data-\d{4}-\d{2}-\d{2}\.json$/);

    // Save and verify content
    const filePath = path.join('test-results', filename);
    await download.saveAs(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    // Verify v2 structure with all settings in one file
    expect(parsed.version).toBe(2);
    expect(parsed.data).toBeTruthy();
    expect(parsed.data.settings).toBeTruthy();
    expect(parsed.data.settings.language).toBeTruthy();
    expect(parsed.data.settings.dateFormat).toBeTruthy();
    expect(parsed.data.settings.isEuropeanFormat).toBeDefined();
    expect(parsed.data.settings.encryption).toBeTruthy();

    // Cleanup
    fs.unlinkSync(filePath);
  });
});
