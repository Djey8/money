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
 *   node cli/mm-admin.js user create --email <e> --password <p>
 *   node cli/mm-admin.js user list
 *   node cli/mm-admin.js token create --user <id> --name "<name>" --scopes transactions:rw,reports:r [--expires-in-days 90]
 *   node cli/mm-admin.js token list --user <id>
 *   node cli/mm-admin.js token revoke --token-id <id>
 *
 * See docs/adr/0002-money-minor-units-migration.md (migrate) and
 * docs/adr/0006-api-scopes-and-access-control.md (user/token).
 */

const { initializeDatabase, getUsersDb, getAuthDb } = require('../config/db');
const { runMigration } = require('./commands/migrate');
const { createUser, listUsers } = require('./commands/user');
const { createToken, listTokens, revokeToken } = require('./commands/token');

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
  console.error('  mm-admin user create --email <e> --password <p>');
  console.error('  mm-admin user list');
  console.error(
    '  mm-admin token create --user <id> --name "<name>" --scopes transactions:rw,reports:r [--expires-in-days 90]',
  );
  console.error('  mm-admin token list --user <id>');
  console.error('  mm-admin token revoke --token-id <id>');
}

function print(result) {
  console.log(JSON.stringify(result, null, 2));
}

async function handleMigrate(deps, args) {
  const result = await runMigration(deps, {
    userId: args.user,
    dryRun: Boolean(args['dry-run']),
    currency: typeof args.currency === 'string' ? args.currency : undefined,
    rollbackFile: typeof args.rollback === 'string' ? args.rollback : undefined,
  });
  print(result);
  if (result.status === 'dry-run' && result.nonRepresentable.length > 0) {
    console.warn(
      `\n${result.nonRepresentable.length} field(s) have sub-cent precision and will be rounded — review before running without --dry-run.`,
    );
  }
}

async function handleUser(deps, verb, args) {
  if (verb === 'create') {
    print(await createUser(deps, { email: args.email, password: args.password }));
    return;
  }
  if (verb === 'list') {
    print(await listUsers(deps));
    return;
  }
  printUsage();
  process.exitCode = 1;
}

async function handleToken(deps, verb, args) {
  if (verb === 'create') {
    const scopes = typeof args.scopes === 'string' ? args.scopes.split(',') : [];
    const result = await createToken(deps, {
      userId: args.user,
      name: args.name,
      scopes,
      expiresInDays: args['expires-in-days'] ? Number(args['expires-in-days']) : undefined,
    });
    print(result);
    console.warn('\nSave this token now — it will not be shown again.');
    return;
  }
  if (verb === 'list') {
    print(await listTokens(deps, { userId: args.user }));
    return;
  }
  if (verb === 'revoke') {
    print(await revokeToken(deps, { tokenId: args['token-id'] }));
    return;
  }
  printUsage();
  process.exitCode = 1;
}

async function main() {
  const [command, second, ...rest] = process.argv.slice(2);

  if (!command) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  await initializeDatabase();
  const deps = { usersDb: getUsersDb(), authDb: getAuthDb() };

  if (command === 'migrate') {
    await handleMigrate(deps, parseArgs([second, ...rest].filter((a) => a !== undefined)));
    return;
  }
  if (command === 'user') {
    await handleUser(deps, second, parseArgs(rest));
    return;
  }
  if (command === 'token') {
    await handleToken(deps, second, parseArgs(rest));
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('mm-admin failed:', err.message);
  process.exitCode = 1;
});
