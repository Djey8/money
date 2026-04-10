/**
 * Shared test data fixtures for E2E tests.
 */

/** Fresh user for registration tests — unique per test run to avoid conflicts. */
export function freshUser() {
  const id = Date.now();
  return {
    username: `e2euser${id}`,
    email: `e2e${id}@test.com`,
    password: 'Test123!',
  };
}

/** A reusable user that persists across tests within a spec file. */
export const TEST_USER = {
  username: 'testuser',
  email: `testuser_${Date.now()}@test.com`,
  password: 'Password1!',
};

/** Sample transaction data for add-transaction tests. */
export const TRANSACTIONS = {
  income: {
    account: 'Income',
    amount: '3000',
    category: '@Salary',
    comment: 'Monthly salary',
  },
  daily: {
    account: 'Daily',
    amount: '45.50',
    category: '@Groceries',
    comment: 'Weekly shopping',
  },
  splurge: {
    account: 'Splurge',
    amount: '120',
    category: '@Electronics',
    comment: 'New headphones',
  },
};

/** Sample subscription data. */
export const SUBSCRIPTION = {
  name: 'Netflix',
  account: 'Daily',
  amount: '15.99',
  category: '@Entertainment',
  comment: 'Monthly streaming',
};

/** Today's date in YYYY-MM-DD format. */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Current month in YYYY-MM format. */
export function currentMonth(): string {
  return todayISO().slice(0, 7);
}
