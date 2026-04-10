import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object for the Registration / Login page at /#/authentication.
 */
export class RegistrationPage {
  readonly page: Page;

  // Register form
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly registerBtn: Locator;
  readonly goToLoginBtn: Locator;

  // Login form
  readonly loginEmailInput: Locator;
  readonly loginPasswordInput: Locator;
  readonly loginBtn: Locator;
  readonly goToRegisterBtn: Locator;

  // Error — scoped to register form and login form separately
  readonly registerError: Locator;
  readonly loginError: Locator;

  constructor(page: Page) {
    this.page = page;
    const registerForm = page.locator('.register-container');
    const loginForm = page.locator('.login-container');
    // Register fields
    this.usernameInput = page.locator('#username');
    this.emailInput = page.locator('#Email');
    this.passwordInput = page.locator('#password');
    this.registerBtn = page.locator('#registerbtn');
    this.goToLoginBtn = page.locator('#goToLoginbtn');
    // Login fields
    this.loginEmailInput = page.locator('#EmailL');
    this.loginPasswordInput = page.locator('#passwordL');
    this.loginBtn = page.locator('#loginbtn');
    this.goToRegisterBtn = page.locator('#backbtn');
    // Error — scoped per form with actual IDs from the template
    this.registerError = registerForm.locator('#reg-error');
    this.loginError = loginForm.locator('#login-error');
  }

  async goto() {
    await this.page.goto('/#/authentication');
  }

  async register(username: string, email: string, password: string) {
    await this.usernameInput.fill(username);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.registerBtn.click();
  }

  async login(email: string, password: string) {
    await this.loginEmailInput.fill(email);
    await this.loginPasswordInput.fill(password);
    await this.loginBtn.click();
  }

  async switchToRegister() {
    await this.goToRegisterBtn.click();
  }

  async switchToLogin() {
    await this.goToLoginBtn.click();
  }
}
