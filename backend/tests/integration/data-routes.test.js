/**
 * Extended integration tests for data routes.
 *
 * Covers edge cases NOT already tested in database-api.test.js:
 *  - Various data types (primitive strings, numbers, booleans, deep nesting)
 *  - Read non-existent paths
 *  - Delete non-existent paths
 *  - Large payloads
 *  - text/plain content-type handling (raw string writes)
 *  - Empty body / invalid body
 *
 * Requires a running CouchDB instance.
 */
const request = require('supertest');
const { app, checkDb, registerTestUser } = require('./setup');

let dbAvailable = false;
let token;

beforeAll(async () => {
  dbAvailable = await checkDb();
  if (!dbAvailable) return;

  const user = await registerTestUser('_dataext');
  token = user.token;
});

function authed(method, path) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`);
}

// The `cond` argument is intentionally unused: it's evaluated at
// describe()-time (module load, before beforeAll ever runs), so a
// pre-computed `!dbAvailable` was always stale — every call site below
// looked skipped-when-DB-unreachable but was actually skipped
// unconditionally, forever. Checking the live `dbAvailable` closure
// variable inside the test body (deferred to Jest's run phase, after
// beforeAll has set it) is what actually makes the gate work.
const skipIf = (_cond, name, fn) =>
  it(name, async () => {
    if (!dbAvailable) {
      console.warn(`⚠ Skipping "${name}" — CouchDB not reachable`);
      return;
    }
    return fn();
  });

describe('Extended data routes', () => {
  it('should skip all tests if CouchDB is not available', () => {
    if (!dbAvailable) {
      console.warn('⚠ CouchDB not reachable — skipping extended data-routes tests');
    }
    expect(true).toBe(true);
  });

  // --- Various data types ----------------------------------------------------

  describe('Write/read various data types', () => {
    // A bare JSON primitive (`42`, `true`) as an entire request body is
    // rejected outright by express.json()'s default strict mode (only
    // objects/arrays are valid top-level JSON) — confirmed empirically,
    // this was never actually supported despite what the original version
    // of these two tests asserted (masked forever by the skipIf bug
    // above). Nesting the primitive inside a valid JSON object, like the
    // "deeply nested object" test below already does, is the real,
    // working round-trip path.
    skipIf(!dbAvailable, 'writes and reads a number', async () => {
      await authed('post', '/api/data/write/types/num').send({ value: 42 });
      const res = await authed('get', '/api/data/read/types/num/value');

      expect(res.status).toBe(200);
      expect(res.body.data).toBe(42);
    });

    skipIf(!dbAvailable, 'writes and reads a boolean', async () => {
      await authed('post', '/api/data/write/types/flag').send({ value: true });
      const res = await authed('get', '/api/data/read/types/flag/value');

      expect(res.status).toBe(200);
      expect(res.body.data).toBe(true);
    });

    skipIf(!dbAvailable, 'writes and reads a deeply nested object', async () => {
      const deep = { a: { b: { c: { d: { value: 'deep' } } } } };
      await authed('post', '/api/data/write/types/deep').send(deep);
      const res = await authed('get', '/api/data/read/types/deep/a/b/c/d/value');

      expect(res.status).toBe(200);
      expect(res.body.data).toBe('deep');
    });

    skipIf(!dbAvailable, 'writes and reads null', async () => {
      await authed('post', '/api/data/write/types/nullable')
        .send(null)
        .set('Content-Type', 'application/json');
      // null body may be treated as empty — verify graceful handling
      const res = await authed('get', '/api/data/read/types/nullable');
      expect(res.status).toBe(200);
    });

    skipIf(!dbAvailable, 'writes and reads a large array', async () => {
      const arr = Array.from({ length: 500 }, (_, i) => ({
        id: i,
        label: `item_${i}`,
        value: Math.random(),
      }));

      const writeRes = await authed('post', '/api/data/write/types/largeArr').send(arr);
      expect(writeRes.status).toBe(200);

      const readRes = await authed('get', '/api/data/read/types/largeArr');
      expect(readRes.status).toBe(200);
      expect(readRes.body.data).toHaveLength(500);
      expect(readRes.body.data[499]).toHaveProperty('id', 499);
    });
  });

  // --- Non-existent reads ----------------------------------------------------

  describe('Read non-existent paths', () => {
    skipIf(!dbAvailable, 'returns null for a path that was never written', async () => {
      const res = await authed('get', '/api/data/read/does/not/exist');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });

    skipIf(!dbAvailable, 'returns null for a single non-existent key', async () => {
      const res = await authed('get', '/api/data/read/nonexistent');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });

  // --- Delete edge cases -----------------------------------------------------

  describe('Delete edge cases', () => {
    skipIf(!dbAvailable, 'returns 404 when deleting a non-existent path', async () => {
      const res = await authed('delete', '/api/data/delete/no/such/path');

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Path not found');
    });

    skipIf(!dbAvailable, 'clears entire data object when path is empty', async () => {
      // Write some data first
      await authed('post', '/api/data/write/deltest/x').send('val');

      // Delete root
      const del = await authed('delete', '/api/data/delete/');
      expect(del.status).toBe(200);

      // Data should now be empty
      const read = await authed('get', '/api/data/read/deltest');
      expect(read.status).toBe(200);
      expect(read.body.data).toBeNull();
    });
  });

  // --- text/plain writes (raw strings) ---------------------------------------

  describe('text/plain content type', () => {
    skipIf(!dbAvailable, 'writes a raw string value via text/plain', async () => {
      const encrypted = 'U2FsdGVkX1+abc123encrypted==';
      await authed('post', '/api/data/write/encrypted/key')
        .send(encrypted)
        .set('Content-Type', 'text/plain');

      const res = await authed('get', '/api/data/read/encrypted/key');
      expect(res.status).toBe(200);
      expect(res.body.data).toBe(encrypted);
    });
  });

  // --- Empty / invalid body --------------------------------------------------

  describe('Invalid request bodies', () => {
    skipIf(!dbAvailable, 'returns 400 for empty body on write', async () => {
      const res = await authed('post', '/api/data/write/empty')
        .send('')
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
    });
  });

  // --- Large payload ---------------------------------------------------------

  describe('Large payload handling', () => {
    skipIf(!dbAvailable, 'writes payload near the 10 MB limit successfully', async () => {
      // ~ 1 MB payload — large enough to test, small enough to be fast
      const bigData = {
        items: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          description: 'x'.repeat(80),
          timestamp: new Date().toISOString(),
        })),
      };

      const res = await authed('post', '/api/data/write/bigpayload').send(bigData);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // --- Full document endpoint ------------------------------------------------

  describe('GET /api/data/document', () => {
    skipIf(!dbAvailable, 'returns createdAt and updatedAt timestamps', async () => {
      const res = await authed('get', '/api/data/document');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
      // Should NOT leak internal CouchDB fields
      expect(res.body).not.toHaveProperty('_id');
      expect(res.body).not.toHaveProperty('_rev');
    });
  });

  // --- Legacy write self-healing ids (regression) -----------------------------
  //
  // The Angular app's own interfaces (Transaction, Smile, Share, ...) never
  // carry an `id` field, so any legacy raw write of one of these
  // collections from an already-open browser session used to silently drop
  // every id the Pro API/MCP layer depends on — reproduced in production
  // against JFK's real account (PLAN.md, 2026-09-14). These writes must now
  // come back with ids intact.

  describe('Legacy write self-healing ids', () => {
    skipIf(
      !dbAvailable,
      'assigns stable ids to id-less transactions written via /write/transactions',
      async () => {
        await authed('post', '/api/data/write/transactions').send([
          { account: 'Daily', amount: -500, date: '2026-01-01', time: '09:00', category: '@Food' },
        ]);

        const res = await authed('get', '/api/data/read/transactions');
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].id).toEqual(expect.stringMatching(/^tx_/));
      },
    );

    skipIf(!dbAvailable, 'never touches an entry that already has an id', async () => {
      await authed('post', '/api/data/write/smile').send([{ id: 'smile_keep-me', title: 'Trip' }]);

      const res = await authed('get', '/api/data/read/smile');
      expect(res.body.data[0].id).toBe('smile_keep-me');
    });

    skipIf(
      !dbAvailable,
      'survives a stale browser overwrite: a write with mixed ids/no-ids still leaves every entry addressable',
      async () => {
        // First write: as if the collection had already been backfilled.
        await authed('post', '/api/data/write/fire').send([{ id: 'fire_original', title: 'F1' }]);

        // Second write: simulates a browser that never learned about ids —
        // it re-sends its own stale, id-less copy on top of the first.
        await authed('post', '/api/data/write/fire').send([{ title: 'F1' }, { title: 'F2' }]);

        const res = await authed('get', '/api/data/read/fire');
        expect(res.body.data).toHaveLength(2);
        for (const entry of res.body.data) {
          expect(entry.id).toEqual(expect.stringMatching(/^fire_/));
        }
      },
    );

    skipIf(
      !dbAvailable,
      'hands an id-less entry back the stored id of the entry with the same natural key',
      async () => {
        await authed('post', '/api/data/write/grow').send([
          { id: 'grow_keep', title: 'SOL' },
          { id: 'grow_other', title: 'IOTA' },
        ]);
        // The app re-sends its copy without ids (and in a different order).
        await authed('post', '/api/data/write/grow').send([
          { title: 'IOTA' },
          { title: 'SOL' },
          { title: 'New' },
        ]);

        const res = await authed('get', '/api/data/read/grow');
        const idsByTitle = Object.fromEntries(res.body.data.map((g) => [g.title, g.id]));
        expect(idsByTitle.SOL).toBe('grow_keep');
        expect(idsByTitle.IOTA).toBe('grow_other');
        expect(idsByTitle.New).toEqual(expect.stringMatching(/^grow_/));
        expect(idsByTitle.New).not.toMatch(/grow_keep|grow_other/);
      },
    );

    skipIf(!dbAvailable, 'backfills ids through /write/batch too', async () => {
      await authed('post', '/api/data/write/batch').send({
        writes: [
          { path: 'budget', data: [{ tag: 'Rent', amount: 100000, month: '2026-01' }] },
          { path: 'subscriptions', data: [{ tag: 'Spotify', amount: 999 }] },
        ],
      });

      const budget = await authed('get', '/api/data/read/budget');
      const subs = await authed('get', '/api/data/read/subscriptions');
      expect(budget.body.data[0].id).toEqual(expect.stringMatching(/^budget_/));
      expect(subs.body.data[0].id).toEqual(expect.stringMatching(/^subscriptions_/));
    });

    skipIf(!dbAvailable, 'does not touch a path with no id convention', async () => {
      await authed('post', '/api/data/write/income/expenses/daily').send([{ tag: 'Coffee' }]);

      const res = await authed('get', '/api/data/read/income/expenses/daily');
      expect(res.body.data[0]).not.toHaveProperty('id');
    });
  });

  describe('Stale-write guard (X-Base-Updated-At)', () => {
    skipIf(
      !dbAvailable,
      'accepts a write based on the current version and returns the new updatedAt',
      async () => {
        const base = (await authed('get', '/api/data/updatedAt')).body.updatedAt;
        const res = await authed('post', '/api/data/write/grow')
          .set('X-Base-Updated-At', base)
          .send([{ id: 'grow_a', title: 'A' }]);
        expect(res.status).toBe(200);
        expect(res.body.updatedAt).toEqual(expect.any(String));
        expect(res.body.updatedAt).not.toBe(base);

        const chained = await authed('post', '/api/data/write/batch')
          .set('X-Base-Updated-At', res.body.updatedAt)
          .send({ writes: [{ path: 'grow', data: [{ id: 'grow_a', title: 'B' }] }] });
        expect(chained.status).toBe(200);
        expect(chained.body.updatedAt).toEqual(expect.any(String));
      },
    );

    skipIf(
      !dbAvailable,
      'refuses a write based on an outdated version instead of overwriting newer data',
      async () => {
        await authed('post', '/api/data/write/grow').send([{ id: 'grow_a', title: 'Newer' }]);

        const single = await authed('post', '/api/data/write/grow')
          .set('X-Base-Updated-At', '2000-01-01T00:00:00.000Z')
          .send([{ id: 'grow_a', title: 'Stale' }]);
        expect(single.status).toBe(409);
        expect(single.body.conflict).toBe(true);

        const batch = await authed('post', '/api/data/write/batch')
          .set('X-Base-Updated-At', '2000-01-01T00:00:00.000Z')
          .send({ writes: [{ path: 'grow', data: [{ id: 'grow_a', title: 'Stale' }] }] });
        expect(batch.status).toBe(409);
        expect(batch.body.conflict).toBe(true);

        const res = await authed('get', '/api/data/read/grow');
        expect(res.body.data[0].title).toBe('Newer');
      },
    );

    skipIf(!dbAvailable, 'still accepts a write without the header (older clients)', async () => {
      const res = await authed('post', '/api/data/write/grow').send([{ id: 'grow_a', title: 'C' }]);
      expect(res.status).toBe(200);
    });
  });

  // --- Authentication required -----------------------------------------------

  describe('Authentication required', () => {
    it('rejects write without token', async () => {
      const res = await request(app).post('/api/data/write/test').send({ x: 1 });

      expect(res.status).toBe(401);
    });

    it('rejects read without token', async () => {
      const res = await request(app).get('/api/data/read/test');
      expect(res.status).toBe(401);
    });

    it('rejects delete without token', async () => {
      const res = await request(app).delete('/api/data/delete/test');
      expect(res.status).toBe(401);
    });

    it('rejects document endpoint without token', async () => {
      const res = await request(app).get('/api/data/document');
      expect(res.status).toBe(401);
    });

    it('rejects batch write without token', async () => {
      const res = await request(app)
        .post('/api/data/write/batch')
        .send({ writes: [{ path: 'x', data: 1 }] });

      expect(res.status).toBe(401);
    });
  });
});
