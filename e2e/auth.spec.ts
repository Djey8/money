import { test, expect } from '@playwright/test';
import { RegistrationPage } from './pages/registration.page';
import { freshUser } from './fixtures/test-data';
import { registerAndRedirect, loginAndRedirect } from './helpers/auth.helper';

test.describe('Authentication Flow', () => {

  test('should show login form by default', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();
    await expect(reg.loginEmailInput).toBeVisible();
    await expect(reg.loginBtn).toBeVisible();
    // Register form should be hidden
    await expect(reg.usernameInput).toBeHidden();
  });

  test('should switch between login and register forms', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();

    // Switch to register
    await reg.switchToRegister();
    await expect(reg.usernameInput).toBeVisible();
    await expect(reg.emailInput).toBeVisible();
    await expect(reg.registerBtn).toBeVisible();

    // Switch back to login
    await reg.switchToLogin();
    await expect(reg.loginEmailInput).toBeVisible();
    await expect(reg.loginBtn).toBeVisible();
  });

  test('should register a new user and redirect to home', async ({ page }) => {
    const user = freshUser();
    await registerAndRedirect(page, user);

    // Should land on root with the app shell
    await expect(page.locator('#heading')).toBeVisible();
  });

  test('should login with registered user', async ({ page }) => {
    const user = freshUser();

    // First register
    await registerAndRedirect(page, user);

    // Now navigate to auth and login
    await page.goto('/#/authentication');
    const reg = new RegistrationPage(page);
    await reg.login(user.email, user.password);
    await page.waitForURL('**/');
    await expect(page.locator('#heading')).toBeVisible();
  });

  test('should show error for invalid login', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.login('nonexistent@test.com', 'wrongpassword');

    // Error message should appear in the login form
    await expect(reg.loginError).toBeVisible({ timeout: 5_000 });
  });

  test('should show error for empty registration fields', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.switchToRegister();

    // Try to register with empty fields
    await reg.registerBtn.click();
    await expect(reg.registerError).toBeVisible({ timeout: 5_000 });
  });

  test('should show error for short password', async ({ page }) => {
    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.switchToRegister();

    await reg.register('user', `short${Date.now()}@test.com`, '12345');
    await expect(reg.registerError).toBeVisible({ timeout: 5_000 });
  });

  test('should reject duplicate email registration', async ({ page }) => {
    const user = freshUser();

    // Register first user
    await registerAndRedirect(page, user);

    // Try to register again with the same email
    const reg = new RegistrationPage(page);
    await reg.goto();
    await reg.switchToRegister();
    await reg.register('other', user.email, user.password);
    await expect(reg.registerError).toBeVisible({ timeout: 5_000 });
  });
});
