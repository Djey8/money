import { type Page, expect } from '@playwright/test';
import { RegistrationPage } from '../pages/registration.page';

/**
 * Dismiss the onboarding tour overlay if it appears.
 * The onboarding auto-starts after first registration.
 */
export async function dismissOnboarding(page: Page) {
  const skipBtn = page.locator('.onboarding-skip');
  // Onboarding starts after loadTier1() completes + 600ms setTimeout.
  // On slow CI this can take several seconds, so use a generous timeout.
  if (await skipBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForSelector('.onboarding-backdrop', { state: 'hidden', timeout: 3_000 }).catch(() => {});
  }
}

/**
 * Register a new user and wait for the redirect to the root page.
 * Returns the credentials used.
 */
export async function registerAndRedirect(page: Page, user: { username: string; email: string; password: string }) {
  const reg = new RegistrationPage(page);
  await reg.goto();
  await reg.switchToRegister();
  await reg.register(user.username, user.email, user.password);
  // After successful registration, the app does window.location.href = "/"
  // which triggers a full page reload. Wait for the root URL.
  await page.waitForURL('**/');
  // Wait for the app shell to stabilize
  await page.waitForSelector('#heading', { timeout: 15_000 });
  // Dismiss the onboarding overlay that appears for new users
  await dismissOnboarding(page);
}

/**
 * Login an existing user and wait for the redirect to the root page.
 */
export async function loginAndRedirect(page: Page, email: string, password: string) {
  const reg = new RegistrationPage(page);
  await reg.goto();
  // Login form is the default view (isRegister = false)
  await reg.login(email, password);
  await page.waitForURL('**/');
  await page.waitForSelector('#heading', { timeout: 15_000 });
}

/**
 * Navigate to a hash route and wait for the page to load.
 */
export async function navigateTo(page: Page, route: string) {
  await page.goto(`/#/${route}`);
  await page.waitForSelector('#heading', { timeout: 10_000 });
}

/**
 * Open the Add Transaction panel from a page that has the add button.
 */
export async function openAddTransaction(page: Page) {
  // Dismiss onboarding if it's currently blocking
  await dismissOnboarding(page);
  await page.locator('#addbtn').click();
  await page.waitForSelector('#addTransaction-Container', { state: 'visible', timeout: 5_000 });
}

/**
 * Open the main menu.
 */
export async function openMenu(page: Page) {
  await page.locator('button[aria-label="Menu"], button[aria-label="Full menu"]').first().click();
  await page.waitForSelector('#menuNavBar-Container', { state: 'visible', timeout: 5_000 });
}

/**
 * Click a menu button by its visible text.
 * Uses .first() because the menu component has duplicate containers.
 */
export async function clickMenuButton(page: Page, text: string) {
  await page.locator('#menuNavBar-Container .menubtn').filter({ hasText: text }).first().click();
}

/**
 * Delete the current user's account via the backend API.
 * Call this in afterAll/afterEach to clean up e2e test users.
 */
export async function deleteAccount(page: Page) {
  const cookies = await page.context().cookies();
  const accessCookie = cookies.find(c => c.name === 'access_token');
  const token = accessCookie?.value;
  if (!token) return; // not logged in — nothing to clean up

  const apiUrl = 'http://localhost:3000/api';
  const response = await page.request.delete(`${apiUrl}/auth/delete-account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) {
    console.warn(`[e2e cleanup] Failed to delete account: ${response.status()}`);
  }
}
