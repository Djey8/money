import { test, expect } from '@playwright/test';
import { freshUser } from './fixtures/test-data';
import { registerAndRedirect, navigateTo, openMenu, clickMenuButton } from './helpers/auth.helper';

test.describe('Navigation', () => {
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

  test('should navigate to all main routes via menu', async ({ page }) => {
    const routes: { menuText: string; urlPart: string }[] = [
      { menuText: 'Home', urlPart: 'home' },
      { menuText: 'Transactions', urlPart: 'transactions' },
      { menuText: 'Daily', urlPart: 'daily' },
      { menuText: 'Splurge', urlPart: 'splurge' },
      { menuText: 'Smile', urlPart: 'smile' },
      { menuText: 'Fire', urlPart: 'fire' },
    ];

    for (const route of routes) {
      await openMenu(page);
      await clickMenuButton(page, route.menuText);
      await page.waitForURL(`**/${route.urlPart}`, { timeout: 5_000 });
      await expect(page.locator('#heading').last()).toBeVisible();
    }
  });

  test('should navigate to financial routes via menu', async ({ page }) => {
    const routes: { menuText: string; urlPart: string }[] = [
      { menuText: 'CASHFLOW', urlPart: 'cashflow' },
      { menuText: 'Income Statement', urlPart: 'income' },
      { menuText: 'Balance Sheet', urlPart: 'balance' },
      { menuText: 'Subscriptions', urlPart: 'subscription' },
      { menuText: 'Budget', urlPart: 'budget' },
      { menuText: 'GROW Projects', urlPart: 'grow' },
    ];

    for (const route of routes) {
      await openMenu(page);
      await clickMenuButton(page, route.menuText);
      await page.waitForURL(`**/${route.urlPart}`, { timeout: 5_000 });
      await expect(page.locator('#heading').last()).toBeVisible();
    }
  });

  test('should deep-link to each route directly', async ({ page }) => {
    const routes = ['home', 'transactions', 'daily', 'splurge', 'smile', 'fire',
      'cashflow', 'income', 'balance', 'subscription', 'grow', 'budget', 'plan',
      'smileprojects', 'fireemergencies', 'stats'];

    for (const route of routes) {
      await page.goto(`/#/${route}`);
      await page.waitForSelector('#heading', { timeout: 10_000 });
      await expect(page.locator('#heading').last()).toBeVisible();
    }
  });

  test('should open and close the menu', async ({ page }) => {
    await navigateTo(page, 'home');
    await openMenu(page);
    await expect(page.locator('#menuNavBar-Container').first()).toBeVisible();

    // Close menu
    await page.locator('#menuNavBar-Container #closebtn').first().click();
    await expect(page.locator('#menuNavBar-Container').first()).toBeHidden();
  });
});
