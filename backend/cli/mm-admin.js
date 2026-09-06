#!/usr/bin/env node
'use strict';

/**
 * Admin CLI for Money Manager's self-hosted backend. Talks to CouchDB
 * directly (not through the HTTP API), so it must be run on the server
 * itself with the same env vars as the backend (COUCHDB_URL,
 * COUCHDB_USER, COUCHDB_PASSWORD).
 *
 * Usage:
 *   node cli/mm-admin.js migrate --user <id> [--dry-run] [--currency EUR]
 *   node cli/mm-admin.js migrate --user <id> --rollback <backupFile>
 *
 * See docs/adr/0002-money-minor-units-migration.md. Only `migrate` is
 * implemented so far — `user create/list` and `token create/list/revoke`
 * (docs/adr/0006-api-scopes-and-access-control.md) land in a later slice.
 */

const { initializeDatabase, getUsersDb, getAuthDb } = require('../config/db');
const { runMigration } = require('./commands/migrate');

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    const isBooleanFlag = next === undefined || next.startsWith('--');
    if (isBooleanFlag) {
      options[key] = true;
    } else {
      options[key] = next;
      i += 1;
    }
  }
  return options;
}

function printUsage() {
  console.error('Usage:');
  console.error('  mm-admin migrate --user <id> [--dry-run] [--currency EUR]');
  console.error('  mm-admin migrate --user <id> --rollback <backupFile>');
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);

  if (command !== 'migrate') {
    printUsage();
    process.exitCode = 1;
    return;
  }

  await initializeDatabase();
  const deps = { usersDb: getUsersDb(), authDb: getAuthDb() };

  const result = await runMigration(deps, {
    userId: args.user,
    dryRun: Boolean(args['dry-run']),
    currency: typeof args.currency === 'string' ? args.currency : undefined,
    rollbackFile: typeof args.rollback === 'string' ? args.rollback : undefined,
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'dry-run' && result.nonRepresentable.length > 0) {
    console.warn(
      `\n${result.nonRepresentable.length} field(s) have sub-cent precision and will be rounded — review before running without --dry-run.`,
    );
  }
}

main().catch((err) => {
  console.error('mm-admin failed:', err.message);
  process.exitCode = 1;
});
