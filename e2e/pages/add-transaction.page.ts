import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object for the Add Transaction panel.
 * This panel is an overlay in app.component.html, not a separate route.
 */
export class AddTransactionPage {
  readonly page: Page;

  readonly accountSelect: Locator;
  readonly amountInput: Locator;
  readonly dateInput: Locator;
  readonly timeInput: Locator;
  readonly categoryInput: Locator;
  readonly commentInput: Locator;
  readonly addBtn: Locator;
  readonly closeBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    const panel = page.locator('#addTransaction-Container');
    this.accountSelect = panel.locator('#account');
    this.amountInput = panel.locator('#amount');
    this.dateInput = panel.locator('#date');
    this.timeInput = panel.locator('#time');
    this.categoryInput = panel.locator('#category');
    this.commentInput = panel.locator('#comment');
    this.addBtn = panel.locator('#addbtn');
    this.closeBtn = panel.locator('#closebtn');
  }

  async fill(data: { account: string; amount: string; category: string; comment?: string; date?: string }) {
    await this.accountSelect.selectOption(data.account);
    await this.amountInput.fill(data.amount);
    if (data.date) {
      await this.dateInput.fill(data.date);
    }
    await this.categoryInput.fill(data.category);
    if (data.comment) {
      await this.commentInput.fill(data.comment);
    }
  }

  async submit() {
    // Dismiss onboarding overlay if still blocking
    const skipBtn = this.page.locator('.onboarding-skip');
    if (await skipBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await skipBtn.click();
      await this.page.waitForSelector('.onboarding-backdrop', { state: 'hidden', timeout: 3_000 }).catch(() => {});
    }
    await this.addBtn.click();
  }

  async close() {
    await this.closeBtn.click();
  }
}
