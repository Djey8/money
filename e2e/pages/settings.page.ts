import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object for the Settings panel.
 * Overlay in app.component.html, opened via profile > settings.
 */
export class SettingsPage {
  readonly page: Page;
  readonly panel: Locator;

  constructor(page: Page) {
    this.page = page;
    this.panel = page.locator('app-settings');
  }

  /** Check if the settings panel is visible. */
  async isVisible(): Promise<boolean> {
    return this.panel.locator('[id*="settings"], .settings-container, [class*="settings"]').first().isVisible();
  }
}
