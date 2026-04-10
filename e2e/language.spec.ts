import { test, expect } from '@playwright/test';
import { freshUser } from './fixtures/test-data';
import { registerAndRedirect, navigateTo } from './helpers/auth.helper';

test.describe('Language Switching', () => {
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

  /**
   * Helper: open Settings > Language section
   */
  async function openLanguageSettings(page: import('@playwright/test').Page) {
    // Ensure profile panel is closed before trying to open it
    await expect(page.locator('#profile-Container')).toBeHidden({ timeout: 3_000 }).catch(() => {});
    // Use .last() because multiple toolbars may be stacked (home + navigated page)
    await page.locator('#profile-pic').last().click({ force: true });
    // Wait for profile panel to appear (uses *ngIf, so it must be in the DOM)
    await expect(page.locator('#profile-Container')).toBeVisible({ timeout: 5_000 });
    await page.locator('#settings-btn').click();
    await page.waitForSelector('#infoTransaction-Container', { state: 'visible', timeout: 5_000 });

    // Click language menu item (match English, German "Sprache", or other language labels)
    await page.locator('.settings-menu-item').filter({ hasText: /language|sprache|idioma|langue|语言/i }).click();
    await page.waitForTimeout(500);
  }

  test('should switch to German', async ({ page }) => {
    await openLanguageSettings(page);

    // Click Deutsch option
    await page.locator('.language-option').filter({ hasText: 'Deutsch' }).click();
    await page.waitForTimeout(500);

    // Go back to main settings view
    await page.locator('#languagebtn').click();
    await page.waitForTimeout(500);

    // Close settings
    await page.locator('#infoTransaction-Container #closebtn').click();
    await page.waitForTimeout(500);

    // Navigate to transactions — heading should be in German
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(1000);
    const headingText = await page.locator('#heading').last().textContent() ?? '';
    // German: "Transaktionen" instead of "Transactions"
    expect(headingText.toLowerCase()).toContain('transaktionen');
  });

  test('should switch to Spanish', async ({ page }) => {
    await openLanguageSettings(page);

    await page.locator('.language-option').filter({ hasText: 'Español' }).click();
    await page.waitForTimeout(500);

    await page.locator('#languagebtn').click();
    await page.waitForTimeout(500);
    await page.locator('#infoTransaction-Container #closebtn').click();
    await page.waitForTimeout(500);

    await navigateTo(page, 'transactions');
    await page.waitForTimeout(1000);
    const headingText = await page.locator('#heading').last().textContent() ?? '';
    // Spanish: "Transacciones"
    expect(headingText.toLowerCase()).toContain('transacciones');
  });

  test('should switch to French', async ({ page }) => {
    await openLanguageSettings(page);

    await page.locator('.language-option').filter({ hasText: 'Français' }).click();
    await page.waitForTimeout(500);

    await page.locator('#languagebtn').click();
    await page.waitForTimeout(500);
    await page.locator('#infoTransaction-Container #closebtn').click();
    await page.waitForTimeout(500);

    await navigateTo(page, 'transactions');
    await page.waitForTimeout(1000);
    const headingText = await page.locator('#heading').last().textContent() ?? '';
    // French: "Transactions" (same word in French)
    expect(headingText.toLowerCase()).toContain('transactions');
  });

  test('should switch to Chinese', async ({ page }) => {
    await openLanguageSettings(page);

    await page.locator('.language-option').filter({ hasText: '中文' }).click();
    await page.waitForTimeout(500);

    await page.locator('#languagebtn').click();
    await page.waitForTimeout(500);
    await page.locator('#infoTransaction-Container #closebtn').click();
    await page.waitForTimeout(500);

    await navigateTo(page, 'transactions');
    await page.waitForTimeout(1000);
    const headingText = await page.locator('#heading').last().textContent() ?? '';
    // Chinese: should contain Chinese characters
    expect(headingText).toEqual(expect.stringMatching(/[\u4e00-\u9fff]/));
  });

  test('should switch back to English', async ({ page }) => {
    // First switch to German
    await openLanguageSettings(page);
    await page.locator('.language-option').filter({ hasText: 'Deutsch' }).click();
    await page.waitForTimeout(500);
    await page.locator('#languagebtn').click();
    await page.waitForTimeout(500);
    await page.locator('#infoTransaction-Container #closebtn').click();
    // Wait for settings panel to fully close before reopening
    await expect(page.locator('#infoTransaction-Container')).toBeHidden({ timeout: 5_000 });

    // Navigate away and back to reset UI state before reopening profile
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(1000);

    // Now switch back to English
    await openLanguageSettings(page);
    await page.locator('.language-option').filter({ hasText: 'English' }).click();
    await page.waitForTimeout(500);
    await page.locator('#languagebtn').click();
    await page.waitForTimeout(500);
    await page.locator('#infoTransaction-Container #closebtn').click();
    await page.waitForTimeout(500);

    await navigateTo(page, 'transactions');
    await page.waitForTimeout(1000);
    const headingText = await page.locator('#heading').last().textContent() ?? '';
    expect(headingText.toLowerCase()).toContain('transactions');
  });
});
