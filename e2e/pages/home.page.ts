import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object for the Home dashboard at /#/home.
 */
export class HomePage {
  readonly page: Page;

  readonly heading: Locator;
  readonly dailyTile: Locator;
  readonly splurgeTile: Locator;
  readonly smileTile: Locator;
  readonly fireTile: Locator;
  readonly balanceTile: Locator;
  readonly menuIcon: Locator;
  readonly profilePic: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('#heading');
    this.dailyTile = page.locator('.grid-item').nth(0);
    this.splurgeTile = page.locator('.grid-item').nth(1);
    this.smileTile = page.locator('.grid-item').nth(2);
    this.fireTile = page.locator('.grid-item').nth(3);
    this.balanceTile = page.locator('.total-amount');
    this.menuIcon = page.locator('#menu-icon');
    this.profilePic = page.locator('#profile-pic').first();
  }

  async goto() {
    await this.page.goto('/#/home');
  }

  /** Get the displayed value text from an account tile. */
  async getDailyValue(): Promise<string> {
    return (await this.dailyTile.locator('[class*="grid-value"]').textContent()) ?? '';
  }

  async getSplurgeValue(): Promise<string> {
    return (await this.splurgeTile.locator('[class*="grid-value"]').textContent()) ?? '';
  }

  async getSmileValue(): Promise<string> {
    return (await this.smileTile.locator('[class*="grid-value"]').textContent()) ?? '';
  }

  async getFireValue(): Promise<string> {
    return (await this.fireTile.locator('[class*="grid-value"]').textContent()) ?? '';
  }

  async getBalance(): Promise<string> {
    return (await this.balanceTile.locator('[class*="grid-value"]').textContent()) ?? '';
  }

  async openMenu() {
    await this.menuIcon.click();
  }
}
