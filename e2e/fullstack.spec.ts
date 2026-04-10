import { test, expect, request } from '@playwright/test';
import { freshUser, TRANSACTIONS, todayISO } from './fixtures/test-data';
import { registerAndRedirect, navigateTo, openAddTransaction } from './helpers/auth.helper';
import { AddTransactionPage } from './pages/add-transaction.page';

/**
 * Full-stack integration test — exercises CouchDB + backend + frontend together.
 * Requires docker-compose.e2e.yml stack running (CouchDB + backend on :3000).
 *
 * Usage:
 *   podman compose -f docker-compose.e2e.yml up -d
 *   npx playwright test e2e/fullstack.spec.ts
 *   podman compose -f docker-compose.e2e.yml down -v
 */

// Check if backend API is available before running these tests
let backendAvailable = false;
test.beforeAll(async () => {
  try {
    const ctx = await request.newContext({ baseURL: 'http://localhost:3000' });
    const resp = await ctx.get('/health', { timeout: 3_000 });
    backendAvailable = resp.ok();
    await ctx.dispose();
  } catch {
    backendAvailable = false;
  }
});

test.describe('Selfhosted Full Stack', () => {
  const API_BASE = 'http://localhost:3000';
  const user = freshUser();
  let authToken: string;

  test('should register via UI, add data, verify via API, and verify in UI', async ({ page }) => {
    test.skip(!backendAvailable, 'Backend API not running — start docker-compose.e2e.yml');

    // ── Step 1: Register via UI ──
    await registerAndRedirect(page, user);
    await expect(page.locator('#heading').first()).toBeVisible();

    // Grab the JWT from localStorage (key: selfhosted_token)
    authToken = await page.evaluate(() => localStorage.getItem('selfhosted_token') ?? '');
    expect(authToken).toBeTruthy();

    // ── Step 2: Add a transaction via UI ──
    const uniqueCategory = `@FullStack${Date.now()}`;
    await navigateTo(page, 'transactions');
    await openAddTransaction(page);

    const addPage = new AddTransactionPage(page);
    await addPage.fill({
      account: 'Daily',
      amount: '123.45',
      category: uniqueCategory,
      date: todayISO(),
    });
    await addPage.submit();
    await expect(page.locator('#addTransaction-Container')).toBeHidden({ timeout: 10_000 });
    await page.waitForTimeout(2000);

    // ── Step 3: Verify data via backend API ──
    const apiCtx = await request.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: { Authorization: `Bearer ${authToken}` },
    });

    // Read the user's full document from the API
    const resp = await apiCtx.get('/api/data/document');
    expect(resp.ok()).toBeTruthy();
    const data = await resp.json();
    // The document should contain our transaction data
    const docStr = JSON.stringify(data);
    expect(docStr).toContain('123.45');
    expect(docStr).toContain(uniqueCategory);

    await apiCtx.dispose();

    // ── Step 4: Verify token still works via API (token verify endpoint) ──
    const verifyCtx = await request.newContext({ baseURL: API_BASE });
    const verifyResp = await verifyCtx.get('/api/auth/verify', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(verifyResp.ok()).toBeTruthy();
    const verifyBody = await verifyResp.json();
    expect(verifyBody.userId).toBeTruthy();
    expect(verifyBody.email).toBe(user.email);
    await verifyCtx.dispose();

    // ── Step 5: Verify data persists in UI after reload ──
    await page.reload();
    await page.waitForSelector('#heading', { timeout: 15_000 });
    await navigateTo(page, 'transactions');
    await page.waitForTimeout(3000);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain(uniqueCategory.replace('@', ''));
    // Amount may render with locale formatting (e.g. "123,45" instead of "123.45")
    expect(bodyText).toEqual(expect.stringMatching(/123[.,]45/));
  });

  test('should register via API and login via UI', async ({ page }) => {
    test.skip(!backendAvailable, 'Backend API not running — start docker-compose.e2e.yml');

    // ── Step 1: Register a new user directly via API ──
    const apiUser = freshUser();
    const apiCtx = await request.newContext({ baseURL: API_BASE });

    const regResp = await apiCtx.post('/api/auth/register', {
      data: {
        username: apiUser.username,
        email: apiUser.email,
        password: apiUser.password,
      },
    });
    expect(regResp.ok()).toBeTruthy();
    const regBody = await regResp.json();
    expect(regBody.token).toBeTruthy();
    await apiCtx.dispose();

    // ── Step 2: Login via UI with the API-registered user ──
    await page.goto('/#/authentication');
    await page.locator('#EmailL').fill(apiUser.email);
    await page.locator('#passwordL').fill(apiUser.password);
    await page.locator('#loginbtn').click();
    await page.waitForURL('**/');
    await page.waitForSelector('#heading', { timeout: 15_000 });

    // Should be on the home page
    await expect(page.locator('#heading').first()).toBeVisible();
  });
});
