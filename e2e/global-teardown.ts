import { execSync } from 'child_process';

/**
 * Playwright global teardown — runs after all e2e tests complete.
 * Cleans up any e2e test accounts remaining in CouchDB.
 */
export default async function globalTeardown() {
  console.log('\n[global-teardown] Cleaning up e2e test accounts...');
  try {
    execSync('node scripts/clean-e2e.js', { stdio: 'inherit' });
  } catch {
    console.warn('[global-teardown] e2e cleanup failed (CouchDB may not be running)');
  }
}
