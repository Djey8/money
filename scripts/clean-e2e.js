#!/usr/bin/env node
/**
 * Cleanup script for e2e test accounts.
 * Deletes all users from CouchDB whose email starts with "e2e".
 *
 * Usage:
 *   node scripts/clean-e2e.js
 *
 * Environment variables (with defaults for local docker-compose):
 *   COUCHDB_URL      - CouchDB URL          (default: http://localhost:5984)
 *   COUCHDB_USER     - CouchDB admin user    (default: admin)
 *   COUCHDB_PASSWORD  - CouchDB admin password (default: password)
 *   AUTH_DB           - Auth database name     (default: auth)
 *   USERS_DB          - Users database name    (default: users)
 */

const http = require('http');
const url = require('url');

const COUCHDB_URL = process.env.COUCHDB_URL || 'http://localhost:5984';
const COUCHDB_USER = process.env.COUCHDB_USER || 'admin';
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'password';
const AUTH_DB = process.env.AUTH_DB || 'auth';
const USERS_DB = process.env.USERS_DB || 'users';

function couchRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(path, COUCHDB_URL);
    const auth = Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`).toString('base64');

    const options = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function findE2eUsers() {
  // Use Mango query to find all auth docs where email starts with "e2e"
  const result = await couchRequest('POST', `/${AUTH_DB}/_find`, {
    selector: {
      email: { $regex: '^e2e' },
    },
    fields: ['_id', '_rev', 'email'],
    limit: 10000,
  });

  if (result.status !== 200) {
    console.error('Failed to query auth DB:', result.body);
    return [];
  }

  return result.body.docs || [];
}

async function deleteDoc(db, id, rev) {
  const encodedId = encodeURIComponent(id);
  const encodedRev = encodeURIComponent(rev);
  return couchRequest('DELETE', `/${db}/${encodedId}?rev=${encodedRev}`);
}

async function main() {
  console.log(`Connecting to CouchDB at ${COUCHDB_URL}...`);

  // Find all e2e users in auth DB
  const e2eUsers = await findE2eUsers();
  console.log(`Found ${e2eUsers.length} e2e user(s) to clean up.`);

  if (e2eUsers.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  let deleted = 0;
  let errors = 0;

  for (const user of e2eUsers) {
    console.log(`  Deleting: ${user.email} (${user._id})`);

    // Delete from users DB (data)
    try {
      const userDoc = await couchRequest('GET', `/${USERS_DB}/${encodeURIComponent(user._id)}`);
      if (userDoc.status === 200) {
        const result = await deleteDoc(USERS_DB, userDoc.body._id, userDoc.body._rev);
        if (result.status === 200) {
          console.log(`    ✓ Deleted data from ${USERS_DB}`);
        } else {
          console.error(`    ✗ Failed to delete from ${USERS_DB}:`, result.body);
          errors++;
        }
      } else if (userDoc.status === 404) {
        console.log(`    - No data doc in ${USERS_DB} (already gone)`);
      }
    } catch (err) {
      console.error(`    ✗ Error deleting from ${USERS_DB}:`, err.message);
      errors++;
    }

    // Delete from auth DB (credentials)
    try {
      const result = await deleteDoc(AUTH_DB, user._id, user._rev);
      if (result.status === 200) {
        console.log(`    ✓ Deleted credentials from ${AUTH_DB}`);
        deleted++;
      } else {
        console.error(`    ✗ Failed to delete from ${AUTH_DB}:`, result.body);
        errors++;
      }
    } catch (err) {
      console.error(`    ✗ Error deleting from ${AUTH_DB}:`, err.message);
      errors++;
    }
  }

  console.log(`\nDone. Deleted ${deleted} account(s), ${errors} error(s).`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
